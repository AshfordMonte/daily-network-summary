// Fetches Zabbix problem/event data and trims it into digest-friendly context.

import {
  classifyInterfaceContext,
  findKnownLoopbacks,
  findKnownSiteNames,
  inferSiteFromSource
} from './site-map.js';

const SEVERITY_NAMES = {
  0: 'not_classified',
  1: 'information',
  2: 'warning',
  3: 'average',
  4: 'high',
  5: 'disaster'
};

const MAX_ZABBIX_FETCH_LIMIT = 200;
const MAX_CHANGED_EVENTS = 40;
const MAX_LONGSTANDING_ACTIVE = 8;

function toUnixSeconds(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid Zabbix timestamp: ${value}`);
  }

  return Math.floor(date.getTime() / 1000);
}

function fromUnixSeconds(value) {
  const timestamp = Number.parseInt(value, 10);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return null;
  }

  return new Date(timestamp * 1000).toISOString();
}

function normalizeZabbixUrl(url) {
  if (!url) {
    throw new Error('ZABBIX_URL is required when Zabbix is enabled.');
  }

  if (url.endsWith('/api_jsonrpc.php')) {
    return url;
  }

  return `${url.replace(/\/+$/, '')}/api_jsonrpc.php`;
}

function getEventHosts(event) {
  return Array.isArray(event.hosts) ? event.hosts : [];
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function getHostIdentities(event) {
  return getEventHosts(event)
    .map((host) => ({
      hostid: host.hostid || null,
      name: host.name || '',
      technicalName: host.host || ''
    }))
    .filter((host) => host.name || host.technicalName);
}

function getHostNames(event) {
  return uniqueValues(
    getHostIdentities(event).flatMap((host) => [host.name, host.technicalName])
  );
}

function getPrimaryHostName(hostNames) {
  const nonGenericNames = hostNames.filter(
    (hostName) => !/\b(?:target|template|unknown)\b/i.test(hostName)
  );

  return (
    nonGenericNames.find((hostName) =>
      /\b(?:mikrotik|netonix|router|switch|radio|olt|ccr|crs|rb|johnsoncity|blanco|stonewall|aa\d|ab\d)\b|-/i.test(
        hostName
      )
    ) ||
    nonGenericNames[0] ||
    hostNames[0] ||
    null
  );
}

function getTags(event) {
  return Array.isArray(event.tags)
    ? event.tags.map((tag) => ({
        tag: tag.tag,
        value: tag.value
      }))
    : [];
}

function getSiteHints(event) {
  const hostNames = getHostNames(event);
  const text = `${event.name || ''} ${event.opdata || ''} ${hostNames.join(' ')}`;
  const sourceSites = hostNames.map(inferSiteFromSource).filter(Boolean);
  const knownSites = [
    ...sourceSites.map((name) => ({ name })),
    ...findKnownLoopbacks(text),
    ...findKnownSiteNames(text)
  ];
  const seen = new Set();

  return knownSites.filter((site) => {
    const key = `${site.ip || ''}|${site.name}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function normalizeEvent(event, source) {
  const severity = Number.parseInt(event.severity, 10);
  const startedAt = fromUnixSeconds(event.clock);
  const resolvedAt = fromUnixSeconds(event.r_clock);
  const isResolved = Boolean(resolvedAt || (event.r_eventid && event.r_eventid !== '0'));
  const hostNames = getHostNames(event);
  const hostIdentities = getHostIdentities(event);
  const tags = getTags(event);

  return {
    eventId: event.eventid,
    source,
    status: isResolved ? 'resolved' : 'active',
    startedAt,
    resolvedAt,
    severity: Number.isFinite(severity) ? severity : null,
    severityName: SEVERITY_NAMES[severity] || 'unknown',
    primaryHost: getPrimaryHostName(hostNames),
    hostNames,
    hostIdentities,
    name: event.name || event.relatedObject?.description || 'Unnamed Zabbix problem',
    opdata: event.opdata || '',
    acknowledged: event.acknowledged === '1',
    suppressed: event.suppressed === '1',
    tags,
    siteHints: getSiteHints(event),
    interfaceContext: classifyInterfaceContext({
      name: event.name || event.relatedObject?.description,
      opdata: event.opdata,
      hostNames
    })
  };
}

function sortBySeverityThenTime(a, b) {
  const severityDifference = (b.severity ?? -1) - (a.severity ?? -1);
  if (severityDifference !== 0) {
    return severityDifference;
  }

  return new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime();
}

function isWithinWindow(value, windowStart, windowEnd) {
  if (!value) {
    return false;
  }

  const timestamp = new Date(value).getTime();
  return timestamp >= windowStart.getTime() && timestamp <= windowEnd.getTime();
}

function changedInWindow(event, windowStart, windowEnd) {
  return (
    isWithinWindow(event.startedAt, windowStart, windowEnd) ||
    isWithinWindow(event.resolvedAt, windowStart, windowEnd)
  );
}

function isLongstandingActive(event, windowStart, windowEnd) {
  return event.status === 'active' && !changedInWindow(event, windowStart, windowEnd);
}

function dedupeEvents(events) {
  const seen = new Set();
  const deduped = [];

  for (const event of events) {
    const key = event.eventId || `${event.startedAt}|${event.hostNames.join(',')}|${event.name}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(event);
  }

  return deduped;
}

export class ZabbixClient {
  constructor({ url, apiToken }) {
    this.url = normalizeZabbixUrl(url);
    this.apiToken = apiToken;
    this.requestId = 1;
  }

  async request(method, params = {}) {
    if (!this.apiToken) {
      throw new Error('ZABBIX_API_TOKEN is required when Zabbix is enabled.');
    }

    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
        id: this.requestId++
      })
    });

    const responseBody = await response.text();
    if (!response.ok) {
      throw new Error(
        `Zabbix API request failed: ${response.status} ${response.statusText} - ${responseBody.slice(
          0,
          600
        )}`
      );
    }

    const payload = responseBody ? JSON.parse(responseBody) : {};
    if (payload.error) {
      throw new Error(
        `Zabbix API ${method} failed: ${payload.error.message || 'API error'} ${
          payload.error.data || ''
        }`.trim()
      );
    }

    return payload.result || [];
  }
}

export async function fetchZabbixContext({ url, apiToken, from, to, limit = 200 }) {
  const client = new ZabbixClient({ url, apiToken });
  const timeFrom = toUnixSeconds(from);
  const timeTill = toUnixSeconds(to);
  const windowStart = new Date(from);
  const windowEnd = new Date(to);
  const fetchLimit = Math.min(limit, MAX_ZABBIX_FETCH_LIMIT);

  const commonSelection = {
    output: 'extend',
    selectHosts: ['hostid', 'host', 'name'],
    selectTags: 'extend',
    selectAcknowledges: ['userid', 'clock', 'message', 'action'],
    sortfield: ['eventid'],
    sortorder: 'DESC',
    limit: fetchLimit
  };

  const [problems, problemEvents] = await Promise.all([
    client.request('problem.get', {
      ...commonSelection,
      recent: true
    }),
    client.request('event.get', {
      ...commonSelection,
      source: 0,
      object: 0,
      value: 1,
      problem_time_from: timeFrom,
      problem_time_till: timeTill
    })
  ]);

  // Changed events drive the report. Longstanding active items are kept small
  // so chronic warnings do not drown out what changed in this window.
  const allEvents = dedupeEvents([
    ...problems.map((event) => normalizeEvent(event, 'problem.get')),
    ...problemEvents.map((event) => normalizeEvent(event, 'event.get'))
  ]).sort(sortBySeverityThenTime);

  const allChangedEvents = allEvents.filter((event) =>
    changedInWindow(event, windowStart, windowEnd)
  );

  const allLongstandingActive = allEvents.filter((event) =>
    isLongstandingActive(event, windowStart, windowEnd)
  );
  const changedEvents = allChangedEvents.slice(0, MAX_CHANGED_EVENTS);
  const longstandingActive = allLongstandingActive.slice(0, MAX_LONGSTANDING_ACTIVE);

  return {
    enabled: true,
    window: {
      from,
      to
    },
    totals: {
      fetched: allEvents.length,
      events: changedEvents.length,
      changed: allChangedEvents.length,
      changedSent: changedEvents.length,
      active: changedEvents.filter((event) => event.status === 'active').length,
      resolved: changedEvents.filter((event) => event.status === 'resolved').length,
      highOrWorse: changedEvents.filter((event) => (event.severity ?? 0) >= 4).length,
      longstandingActive: allLongstandingActive.length,
      longstandingActiveSent: longstandingActive.length,
      longstandingHighOrWorse: longstandingActive.filter((event) => (event.severity ?? 0) >= 4)
        .length
    },
    events: changedEvents,
    longstandingActive
  };
}
