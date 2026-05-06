// Graylog API versions vary. Keep endpoint paths here so they can be changed
// without touching the query and normalization logic below.
const SEARCH_MESSAGES_ENDPOINT_PATH = '/api/search/messages';

// Older Graylog deployments often expose this legacy endpoint.
const LEGACY_ABSOLUTE_SEARCH_ENDPOINT_PATH = '/api/search/universal/absolute';

export const DEFAULT_GRAYLOG_FIELDS = [
  'timestamp',
  'source',
  'message',
  'facility',
  'level',
  'gl2_remote_ip',
  'application_name'
];

function toIsoString(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid Graylog timestamp: ${value}`);
  }

  return date.toISOString();
}

function buildHeaders(graylogToken, { hasBody = false } = {}) {
  const basicToken = Buffer.from(`${graylogToken}:token`).toString('base64');

  const headers = {
    Authorization: `Basic ${basicToken}`,
    Accept: 'application/json',
    'X-Requested-By': 'graylog-ai-digest'
  };

  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
}

function normalizeMessageRow(row) {
  const sourceRow =
    row?.message && typeof row.message === 'object'
      ? row.message
      : row?.fields && typeof row.fields === 'object'
        ? row.fields
        : row;

  return {
    timestamp: String(sourceRow?.timestamp || ''),
    source: String(sourceRow?.source || sourceRow?.gl2_source_input || 'unknown'),
    message: String(sourceRow?.message || ''),
    level: sourceRow?.level ?? null,
    facility: sourceRow?.facility ?? null,
    remoteIp: sourceRow?.gl2_remote_ip ?? sourceRow?.remote_ip ?? sourceRow?.remoteIp ?? null
  };
}

function scriptingApiRowToObject(row, schema = []) {
  const message = {};

  for (const [index, column] of schema.entries()) {
    const field = column?.field || column?.name;
    if (field) {
      message[field] = row[index];
    }
  }

  return message;
}

function extractMessageRows(payload) {
  if (Array.isArray(payload?.datarows) && Array.isArray(payload?.schema)) {
    return payload.datarows.map((row) => scriptingApiRowToObject(row, payload.schema));
  }

  if (Array.isArray(payload?.messages)) {
    return payload.messages;
  }

  if (Array.isArray(payload?.results?.messages)) {
    return payload.results.messages;
  }

  if (Array.isArray(payload?.results)) {
    return payload.results;
  }

  if (Array.isArray(payload?.rows)) {
    return payload.rows;
  }

  return [];
}

function buildSearchBody({ query, from, to, limit, fields, streamIds }) {
  const body = {
    query,
    fields,
    from: 0,
    size: limit,
    timerange: {
      type: 'absolute',
      from: toIsoString(from),
      to: toIsoString(to)
    },
    sort: 'timestamp',
    sort_order: 'desc'
  };

  if (streamIds.length > 0) {
    body.streams = streamIds;
  }

  return body;
}

function buildLegacyAbsoluteSearchUrl({ graylogUrl, query, from, to, limit, fields, streamIds }) {
  const endpoint = new URL(LEGACY_ABSOLUTE_SEARCH_ENDPOINT_PATH, graylogUrl);

  endpoint.searchParams.set('query', query);
  endpoint.searchParams.set('from', toLegacyAbsoluteTimestamp(from));
  endpoint.searchParams.set('to', toLegacyAbsoluteTimestamp(to));
  endpoint.searchParams.set('limit', String(limit));
  endpoint.searchParams.set('fields', fields.join(','));
  endpoint.searchParams.set('decorate', 'false');

  for (const streamId of streamIds) {
    endpoint.searchParams.append('filter', `streams:${streamId}`);
  }

  return endpoint;
}

function toLegacyAbsoluteTimestamp(value) {
  return toIsoString(value).replace('T', ' ').replace('Z', '');
}

async function parseJsonResponse(response) {
  const responseBody = await response.text();
  const payload = responseBody ? JSON.parse(responseBody) : {};

  return {
    responseBody,
    messages: extractMessageRows(payload).map(normalizeMessageRow)
  };
}

export async function searchGraylogMessages({
  query,
  from,
  to,
  limit,
  fields = DEFAULT_GRAYLOG_FIELDS,
  streamIds = [],
  graylogUrl = process.env.GRAYLOG_URL,
  graylogToken = process.env.GRAYLOG_TOKEN
}) {
  if (!graylogUrl) {
    throw new Error('GRAYLOG_URL is required to query Graylog.');
  }

  if (!graylogToken) {
    throw new Error('GRAYLOG_TOKEN is required to query Graylog.');
  }

  const endpoint = new URL(SEARCH_MESSAGES_ENDPOINT_PATH, graylogUrl);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: buildHeaders(graylogToken, { hasBody: true }),
    body: JSON.stringify(
      buildSearchBody({
        query,
        from,
        to,
        limit,
        fields,
        streamIds
      })
    )
  });

  if (response.ok) {
    const { messages } = await parseJsonResponse(response);
    return messages;
  }

  const responseBody = await response.text();
  if (response.status !== 404 && response.status !== 415) {
    throw new Error(
      `Graylog search failed: ${response.status} ${response.statusText} - ${responseBody.slice(
        0,
        600
      )}`
    );
  }

  const legacyEndpoint = buildLegacyAbsoluteSearchUrl({
    graylogUrl,
    query,
    from,
    to,
    limit,
    fields,
    streamIds
  });

  const legacyResponse = await fetch(legacyEndpoint, {
    method: 'GET',
    headers: buildHeaders(graylogToken)
  });

  if (!legacyResponse.ok) {
    const legacyResponseBody = await legacyResponse.text();
    throw new Error(
      `Graylog search failed. Primary ${SEARCH_MESSAGES_ENDPOINT_PATH} returned ${response.status}; legacy ${LEGACY_ABSOLUTE_SEARCH_ENDPOINT_PATH} returned ${legacyResponse.status} ${legacyResponse.statusText} - ${legacyResponseBody.slice(
        0,
        600
      )}`
    );
  }

  const { messages } = await parseJsonResponse(legacyResponse);
  return messages;
}
