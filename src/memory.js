// Local 30-day trend memory for recurring network events.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const HISTORY_VERSION = 1;
const MAX_NOTABLE_TRENDS = 12;

function normalizeForKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '<ip>')
    .replace(/\b[0-9a-f]{2}(?::[0-9a-f]{2}){5}\b/gi, '<mac>')
    .replace(/\b[0-9a-f]{2}(?:-[0-9a-f]{2}){5}\b/gi, '<mac>')
    .replace(/\b\d{4,}\b/g, '<num>')
    .replace(/[^a-z0-9<>&]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toTimestamp(value) {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function dateKey(value) {
  const timestamp = toTimestamp(value);
  return timestamp > 0 ? new Date(timestamp).toISOString().slice(0, 10) : 'unknown';
}

function daysBetween(from, to) {
  const fromTimestamp = toTimestamp(from);
  const untilTimestamp = toTimestamp(to);
  if (fromTimestamp <= 0 || untilTimestamp <= 0) {
    return null;
  }

  return Math.max(0, Math.round((untilTimestamp - fromTimestamp) / 86_400_000));
}

function siteScope(entry) {
  const context = entry.infrastructureContext || {};
  if (context.link) {
    return `link:${context.link.parentSite}->${context.link.childSite}`;
  }

  if (context.site) {
    return `site:${context.site}`;
  }

  if (entry.sourceSite) {
    return `site:${entry.sourceSite}`;
  }

  const knownSite = entry.knownSites?.[0]?.name || entry.siteHints?.[0]?.name;
  if (knownSite) {
    return `site:${knownSite}`;
  }

  return null;
}

function zabbixHostLabel(event) {
  return (
    event.displayHost ||
    event.primaryHost ||
    event.hostNames?.find(Boolean) ||
    event.hostIdentities?.[0]?.name ||
    event.hostIdentities?.[0]?.technicalName ||
    'unknown'
  );
}

function graylogMemoryEvent(entry, category) {
  const scope = siteScope(entry) || `source:${normalizeForKey(entry.source) || 'unknown'}`;
  const label = `${entry.source || 'unknown'} ${entry.message || ''}`.trim();
  const key = ['graylog', category, scope, normalizeForKey(entry.message)].join('|');

  return {
    key,
    source: 'graylog',
    category,
    severity: entry.severity,
    status: null,
    scope,
    label: label.slice(0, 220),
    timestamp: entry.timestamp || null
  };
}

function zabbixMemoryEvent(event, category) {
  const scope = siteScope(event) || `host:${normalizeForKey(zabbixHostLabel(event))}`;
  const label = `${zabbixHostLabel(event)} ${event.name || ''}`.trim();
  const key = ['zabbix', category, scope, normalizeForKey(event.name)].join('|');

  return {
    key,
    source: 'zabbix',
    category,
    severity: event.severityName || event.severity,
    status: event.status || null,
    scope,
    label: label.slice(0, 220),
    timestamp: event.startedAt || event.resolvedAt || null
  };
}

function collectCurrentEvents(aggregate) {
  const currentEvents = [];

  for (const [category, entries] of Object.entries(aggregate.categories || {})) {
    for (const entry of entries || []) {
      currentEvents.push({
        entry,
        memoryEvent: graylogMemoryEvent(entry, category)
      });
    }
  }

  for (const event of aggregate.zabbix?.events || []) {
    currentEvents.push({
      entry: event,
      memoryEvent: zabbixMemoryEvent(event, 'changed')
    });
  }

  for (const event of aggregate.zabbix?.longstandingActive || []) {
    currentEvents.push({
      entry: event,
      memoryEvent: zabbixMemoryEvent(event, 'longstanding_active')
    });
  }

  return currentEvents;
}

function historyEventTime(record, event) {
  return record.window?.to || record.createdAt || event.timestamp;
}

function buildHistoryIndex(records) {
  const index = new Map();

  for (const record of records) {
    for (const event of record.events || []) {
      const existingEvents = index.get(event.key) || [];
      existingEvents.push({
        record,
        event,
        seenAt: historyEventTime(record, event)
      });
      index.set(event.key, existingEvents);
    }
  }

  return index;
}

function trendStatus(memoryEvent, occurrences) {
  if (occurrences.length === 0) {
    return 'new';
  }

  if (memoryEvent.category === 'longstanding_active') {
    return 'chronic_unchanged';
  }

  const seenDays = new Set(occurrences.map((occurrence) => dateKey(occurrence.seenAt))).size;
  if (seenDays >= 3 || occurrences.length >= 3) {
    return 'recurring';
  }

  return 'previously_seen';
}

function buildTrend(memoryEvent, occurrences, currentWindowEnd) {
  const sortedOccurrences = [...occurrences].sort(
    (a, b) => toTimestamp(a.seenAt) - toTimestamp(b.seenAt)
  );
  const firstSeen = sortedOccurrences[0]?.seenAt || null;
  const lastSeen = sortedOccurrences[sortedOccurrences.length - 1]?.seenAt || null;
  const seenDays = new Set(sortedOccurrences.map((occurrence) => dateKey(occurrence.seenAt)));

  return {
    status: trendStatus(memoryEvent, occurrences),
    seenCount: occurrences.length,
    seenDays: occurrences.length > 0 ? seenDays.size : 0,
    firstSeen,
    lastSeen,
    daysSinceFirstSeen: firstSeen ? daysBetween(firstSeen, currentWindowEnd) : null
  };
}

function createTrendSummary(currentEvents, historyRecords) {
  const counts = {
    new: 0,
    previouslySeen: 0,
    recurring: 0,
    chronicUnchanged: 0
  };
  const notable = [];

  for (const { entry, memoryEvent } of currentEvents) {
    const trend = entry.trend;
    if (!trend) {
      continue;
    }

    if (trend.status === 'new') {
      counts.new += 1;
    } else if (trend.status === 'previously_seen') {
      counts.previouslySeen += 1;
    } else if (trend.status === 'recurring') {
      counts.recurring += 1;
    } else if (trend.status === 'chronic_unchanged') {
      counts.chronicUnchanged += 1;
    }

    if (['new', 'recurring', 'chronic_unchanged'].includes(trend.status)) {
      notable.push({
        status: trend.status,
        label: memoryEvent.label,
        scope: memoryEvent.scope,
        seenCount: trend.seenCount,
        seenDays: trend.seenDays,
        firstSeen: trend.firstSeen,
        lastSeen: trend.lastSeen
      });
    }
  }

  return {
    enabled: true,
    recordsLoaded: historyRecords.length,
    counts,
    notable: notable.slice(0, MAX_NOTABLE_TRENDS)
  };
}

function pruneRecords(records, retentionDays, now = new Date()) {
  const cutoff = now.getTime() - retentionDays * 86_400_000;
  return records.filter((record) => {
    const recordTimestamp = toTimestamp(record.window?.to || record.createdAt);
    return recordTimestamp === 0 || recordTimestamp >= cutoff;
  });
}

export async function loadReportHistory(filePath, { retentionDays = 30 } = {}) {
  const resolvedPath = resolve(filePath);

  try {
    const content = await readFile(resolvedPath, 'utf8');
    const records = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .filter((record) => record.version === HISTORY_VERSION);

    return pruneRecords(records, retentionDays);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

export function annotateAggregateWithHistory(aggregate, historyRecords) {
  const currentEvents = collectCurrentEvents(aggregate);
  if (historyRecords.length === 0) {
    aggregate.trendMemory = {
      enabled: true,
      recordsLoaded: 0,
      baselineOnly: true,
      counts: {
        new: 0,
        previouslySeen: 0,
        recurring: 0,
        chronicUnchanged: 0
      },
      notable: []
    };
    return aggregate;
  }

  const historyIndex = buildHistoryIndex(historyRecords);
  const currentWindowEnd = aggregate.window?.to || new Date().toISOString();

  for (const { entry, memoryEvent } of currentEvents) {
    const occurrences = historyIndex.get(memoryEvent.key) || [];
    entry.trend = buildTrend(memoryEvent, occurrences, currentWindowEnd);
  }

  aggregate.trendMemory = createTrendSummary(currentEvents, historyRecords);
  return aggregate;
}

export function createHistoryRecord(aggregate, { createdAt = new Date().toISOString() } = {}) {
  return {
    version: HISTORY_VERSION,
    runId: `${aggregate.window?.from || ''}|${aggregate.window?.to || ''}`,
    createdAt,
    window: aggregate.window,
    displayWindow: aggregate.displayWindow,
    totals: {
      graylog: aggregate.totals,
      zabbix: aggregate.zabbix?.totals || null
    },
    events: collectCurrentEvents(aggregate).map(({ memoryEvent }) => memoryEvent)
  };
}

export async function saveReportHistory(filePath, records, newRecord, { retentionDays = 30 } = {}) {
  const resolvedPath = resolve(filePath);
  const prunedRecords = pruneRecords(records, retentionDays);
  const nextRecords = [
    ...prunedRecords.filter((record) => record.runId !== newRecord.runId),
    newRecord
  ].sort(
    (a, b) => toTimestamp(a.window?.to || a.createdAt) - toTimestamp(b.window?.to || b.createdAt)
  );
  const content = `${nextRecords.map((record) => JSON.stringify(record)).join('\n')}\n`;

  await mkdir(dirname(resolvedPath), { recursive: true });
  await writeFile(resolvedPath, content, 'utf8');

  return nextRecords;
}
