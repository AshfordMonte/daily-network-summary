import dotenv from 'dotenv';

dotenv.config();

const DEFAULTS = {
  REPORT_WINDOW_HOURS: 24,
  GRAYLOG_SEARCH_LIMIT: 1000,
  ZABBIX_PROBLEM_LIMIT: 200,
  OPENAI_MODEL: 'gpt-4.1-mini',
  GRAYLOG_TIMEZONE: 'America/Chicago',
  REPORT_TITLE: 'Daily Network Syslog Summary'
};

function parseBoolean(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

function parsePositiveInteger(name, fallback) {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue === '') {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

function optionalEnv(name, fallback = '') {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

function parseStreamIds(value) {
  const streamIds = String(value || '')
    .split(',')
    .map((streamId) => streamId.trim())
    .filter(Boolean);

  const invalidStreamIds = streamIds.filter((streamId) => !/^[a-f0-9]{24}$/i.test(streamId));
  if (invalidStreamIds.length > 0) {
    throw new Error(
      `GRAYLOG_STREAM_IDS must contain Graylog stream ObjectIds, not stream names or numbers. Invalid value(s): ${invalidStreamIds.join(
        ', '
      )}`
    );
  }

  return streamIds;
}

export function loadConfig() {
  const mockMode = parseBoolean(process.env.MOCK_MODE);

  const config = {
    mockMode,
    reportWindowHours: parsePositiveInteger(
      'REPORT_WINDOW_HOURS',
      DEFAULTS.REPORT_WINDOW_HOURS
    ),
    reportTitle: optionalEnv('REPORT_TITLE', DEFAULTS.REPORT_TITLE),
    graylog: {
      url: optionalEnv('GRAYLOG_URL').replace(/\/+$/, ''),
      token: optionalEnv('GRAYLOG_TOKEN'),
      timezone: optionalEnv('GRAYLOG_TIMEZONE', DEFAULTS.GRAYLOG_TIMEZONE),
      searchLimit: parsePositiveInteger(
        'GRAYLOG_SEARCH_LIMIT',
        DEFAULTS.GRAYLOG_SEARCH_LIMIT
      ),
      streamIds: parseStreamIds(process.env.GRAYLOG_STREAM_IDS)
    },
    zabbix: {
      enabled: parseBoolean(process.env.ZABBIX_ENABLED),
      url: optionalEnv('ZABBIX_URL'),
      apiToken: optionalEnv('ZABBIX_API_TOKEN'),
      problemLimit: parsePositiveInteger(
        'ZABBIX_PROBLEM_LIMIT',
        DEFAULTS.ZABBIX_PROBLEM_LIMIT
      )
    },
    openai: {
      apiKey: requireEnv('OPENAI_API_KEY'),
      model: optionalEnv('OPENAI_MODEL', DEFAULTS.OPENAI_MODEL),
      reasoningEffort: optionalEnv('OPENAI_REASONING_EFFORT')
    },
    slackWebhookUrl: requireEnv('SLACK_WEBHOOK_URL')
  };

  if (!mockMode) {
    config.graylog.url = requireEnv('GRAYLOG_URL').replace(/\/+$/, '');
    config.graylog.token = requireEnv('GRAYLOG_TOKEN');
  }

  if (config.zabbix.enabled) {
    config.zabbix.url = requireEnv('ZABBIX_URL');
    config.zabbix.apiToken = requireEnv('ZABBIX_API_TOKEN');
  }

  return config;
}
