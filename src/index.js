import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { buildAggregate } from './classify.js';
import { formatSlackMessage } from './format.js';
import { DEFAULT_GRAYLOG_FIELDS, searchGraylogMessages } from './graylog.js';
import { getMockMessages, getMockZabbixContext } from './mock-data.js';
import { calculateReportWindow } from './report-window.js';
import { DEFAULT_SEARCH_QUERY } from './search-query.js';
import { postToSlack } from './slack.js';
import { summarizeNetworkEvents } from './summarize.js';
import { enrichMessageWithSiteHints } from './site-map.js';
import { fetchZabbixContext } from './zabbix.js';

function emptyZabbixContext(enabled = false) {
  return {
    enabled,
    events: [],
    longstandingActive: [],
    totals: {
      fetched: 0,
      events: 0,
      changed: 0,
      changedSent: 0,
      active: 0,
      resolved: 0,
      highOrWorse: 0,
      longstandingActive: 0,
      longstandingActiveSent: 0,
      longstandingHighOrWorse: 0
    }
  };
}

async function loadZabbixContext(config, window) {
  if (!config.zabbix.enabled && !config.mockMode) {
    return emptyZabbixContext(false);
  }

  if (config.mockMode && !config.zabbix.enabled) {
    return emptyZabbixContext(false);
  }

  if (config.mockMode) {
    return getMockZabbixContext(window.from, window.to);
  }

  try {
    return await fetchZabbixContext({
      url: config.zabbix.url,
      apiToken: config.zabbix.apiToken,
      from: window.from,
      to: window.to,
      limit: config.zabbix.problemLimit
    });
  } catch (error) {
    console.warn(`[graylog-ai-digest] Zabbix warning: ${error.message}`);
    return {
      ...emptyZabbixContext(true),
      unavailable: true,
      error: error.message
    };
  }
}

export async function main() {
  const config = loadConfig();
  const window = calculateReportWindow(config.reportWindowHours);

  console.log(
    `[graylog-ai-digest] Report window: ${window.from} to ${window.to} (${config.graylog.timezone})`
  );

  const messages = config.mockMode
    ? getMockMessages(window.from, window.to)
    : await searchGraylogMessages({
        query: DEFAULT_SEARCH_QUERY,
        from: window.from,
        to: window.to,
        limit: config.graylog.searchLimit,
        fields: DEFAULT_GRAYLOG_FIELDS,
        streamIds: config.graylog.streamIds,
        graylogUrl: config.graylog.url,
        graylogToken: config.graylog.token
      });

  if (config.mockMode) {
    console.log('[graylog-ai-digest] MOCK_MODE=true; skipped Graylog query.');
  }

  const enrichedMessages = messages.map(enrichMessageWithSiteHints);

  const aggregate = buildAggregate(enrichedMessages, {
    title: config.reportTitle,
    window: {
      from: window.from,
      to: window.to,
      timezone: config.graylog.timezone
    }
  });
  aggregate.zabbix = await loadZabbixContext(config, window);

  console.log(`[graylog-ai-digest] Raw messages: ${aggregate.totals.rawMessages}`);
  console.log(`[graylog-ai-digest] Analyzed messages: ${aggregate.totals.analyzedMessages}`);
  console.log(
    `[graylog-ai-digest] Severity counts: high=${aggregate.totals.high}, medium=${aggregate.totals.medium}, low=${aggregate.totals.low}, noise=${aggregate.totals.noise}`
  );
  console.log(
    `[graylog-ai-digest] Zabbix changed events: ${aggregate.zabbix.totals.changedSent}/${aggregate.zabbix.totals.changed} active=${aggregate.zabbix.totals.active}, resolved=${aggregate.zabbix.totals.resolved}, highOrWorse=${aggregate.zabbix.totals.highOrWorse}, longstandingActiveSent=${aggregate.zabbix.totals.longstandingActiveSent}/${aggregate.zabbix.totals.longstandingActive}`
  );

  const summary = await summarizeNetworkEvents(aggregate, config.openai);
  const slackMessage = formatSlackMessage(summary);
  const slackResult = await postToSlack(slackMessage, config.slackWebhookUrl);

  console.log(`[graylog-ai-digest] Slack post result: ${slackResult.status}`);
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((error) => {
    console.error(`[graylog-ai-digest] Fatal error: ${error.message}`);
    process.exitCode = 1;
  });
}
