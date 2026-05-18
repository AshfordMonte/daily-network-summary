// Main CLI entry point. It gathers data, builds the compact payload, summarizes it,
// and posts one Slack message.

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { buildAggregate } from './classify.js';
import { formatSlackMessage } from './format.js';
import { DEFAULT_GRAYLOG_FIELDS, searchGraylogMessages } from './graylog.js';
import {
  annotateAggregateWithHistory,
  createHistoryRecord,
  loadReportHistory,
  saveReportHistory
} from './memory.js';
import { getMockMessages, getMockZabbixContext } from './mock-data.js';
import { calculateReportWindow, formatReportWindowForDisplay } from './report-window.js';
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
      fetchedIncludingFiltered: 0,
      decommissionedFiltered: 0,
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
  if (!config.zabbix.enabled) {
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

async function loadHistoryContext(config) {
  if (!config.history.enabled) {
    return [];
  }

  try {
    return await loadReportHistory(config.history.path, {
      retentionDays: config.history.retentionDays
    });
  } catch (error) {
    console.warn(`[graylog-ai-digest] History warning: ${error.message}`);
    return [];
  }
}

async function saveHistoryContext(config, historyRecords, aggregate) {
  if (!config.history.enabled) {
    return;
  }

  try {
    const nextRecords = await saveReportHistory(
      config.history.path,
      historyRecords,
      createHistoryRecord(aggregate),
      {
        retentionDays: config.history.retentionDays
      }
    );
    console.log(`[graylog-ai-digest] History records saved: ${nextRecords.length}`);
  } catch (error) {
    console.warn(`[graylog-ai-digest] History save warning: ${error.message}`);
  }
}

export async function main() {
  const config = loadConfig();
  const window = calculateReportWindow(config.reportWindowHours);
  const displayWindow = formatReportWindowForDisplay(window, config.graylog.timezone);

  console.log(
    `[graylog-ai-digest] Report window: ${displayWindow.from} to ${displayWindow.to}`
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

  // Graylog data is aggregated before Zabbix is attached so each source keeps
  // its own shape inside the OpenAI payload.
  const aggregate = buildAggregate(enrichedMessages, {
    title: config.reportTitle,
    window: {
      from: window.from,
      to: window.to,
      timezone: config.graylog.timezone
    },
    displayWindow
  });
  aggregate.zabbix = await loadZabbixContext(config, window);
  const historyRecords = await loadHistoryContext(config);

  if (config.history.enabled) {
    annotateAggregateWithHistory(aggregate, historyRecords);
  } else {
    aggregate.trendMemory = {
      enabled: false
    };
  }

  console.log(`[graylog-ai-digest] Raw messages: ${aggregate.totals.rawMessages}`);
  console.log(`[graylog-ai-digest] Analyzed messages: ${aggregate.totals.analyzedMessages}`);
  console.log(
    `[graylog-ai-digest] Severity counts: high=${aggregate.totals.high}, medium=${aggregate.totals.medium}, low=${aggregate.totals.low}, noise=${aggregate.totals.noise}`
  );
  console.log(
    `[graylog-ai-digest] Zabbix changed events: ${aggregate.zabbix.totals.changedSent}/${aggregate.zabbix.totals.changed} active=${aggregate.zabbix.totals.active}, resolved=${aggregate.zabbix.totals.resolved}, highOrWorse=${aggregate.zabbix.totals.highOrWorse}, longstandingActiveSent=${aggregate.zabbix.totals.longstandingActiveSent}/${aggregate.zabbix.totals.longstandingActive}`
  );
  if (
    aggregate.totals.decommissionedFiltered > 0 ||
    aggregate.zabbix.totals.decommissionedFiltered > 0
  ) {
    console.log(
      `[graylog-ai-digest] Decommissioned events filtered: graylog=${aggregate.totals.decommissionedFiltered}, zabbix=${aggregate.zabbix.totals.decommissionedFiltered}`
    );
  }
  if (aggregate.trendMemory?.enabled) {
    console.log(
      `[graylog-ai-digest] History loaded: ${aggregate.trendMemory.recordsLoaded} records; trends new=${aggregate.trendMemory.counts.new}, recurring=${aggregate.trendMemory.counts.recurring}, chronic=${aggregate.trendMemory.counts.chronicUnchanged}`
    );
  }

  const summary = await summarizeNetworkEvents(aggregate, config.openai);
  const slackMessage = formatSlackMessage(summary);
  const slackResult = await postToSlack(slackMessage, config.slackWebhookUrl);

  console.log(`[graylog-ai-digest] Slack post result: ${slackResult.status}`);
  await saveHistoryContext(config, historyRecords, aggregate);
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((error) => {
    console.error(`[graylog-ai-digest] Fatal error: ${error.message}`);
    process.exitCode = 1;
  });
}
