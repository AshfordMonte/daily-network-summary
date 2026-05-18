// Classifies raw Graylog messages and builds the compact payload sent to OpenAI.

const CATEGORY_PATTERNS = {
  // Add vendor-specific MikroTik, Netonix, radio, or core-router phrases here
  // as your Graylog vocabulary becomes clearer.
  routing: [
    /\bbgp\b/i,
    /\bospf\b/i,
    /\broute(?:d|s|ing)?\b/i,
    /\badjacenc(?:y|ies)\b/i,
    /\bneighbor\b/i,
    /\bhold timer\b/i
  ],
  device_health: [
    /\breboot(?:ed|ing)?\b/i,
    /\bwatchdog\b/i,
    /\bkernel\b/i,
    /\b(?:kernel|hardware|power|fan|memory|cpu|disk|storage)\b.*\bfailure\b/i,
    /\bcrash(?:ed)?\b/i,
    /\bpanic\b/i,
    /\bhardware\b/i,
    /\btemperature\b/i,
    /\bvoltage\b/i,
    /\bfan\b/i,
    /\bpower supply\b/i,
    /\bmemory\b/i,
    /\bcpu\b/i
  ],
  interface: [
    /\blink\s+(?:down|up)\b/i,
    /\binterface\b/i,
    /\bport\b/i,
    /\bether\d*\b/i,
    /\bsfp\b/i,
    /\bfcs\b/i,
    /\bcrc\b/i,
    /\bframe check(?: sequence)?\b/i,
    /\b(?:input|output|rx|tx)\s+errors?\b/i,
    /\bcarrier\b/i,
    /\bflap(?:ped|ping)?\b/i,
    /\bbackhaul\b/i,
    /\bradwin\b/i,
    /\btarana\b/i,
    /\bblinq\b/i,
    /\btelrad\b/i,
    /\bsiae\b/i,
    /\bolt\b/i
  ],
  security_admin: [
    /\blogin\b/i,
    /\blogout\b/i,
    /\bauthentication\b/i,
    /\bfailed password\b/i,
    /\bfailed login\b/i,
    /\binvalid user\b/i,
    /\bssh\b/i,
    /\bconfig(?:uration)?\b/i
  ],
  noise: [
    /\bdhcp\b/i,
    /\bdns\b/i,
    /\bntp\b/i,
    /\bsnmp\b/i,
    /\bfirewall drop\b/i,
    /\bdropped packet\b/i,
    /\bconnection tracking\b/i,
    /\bconntrack\b/i,
    /\baccepted connection\b/i,
    /\bpoll(?:ing)?\b/i
  ]
};

const HIGH_SEVERITY_PATTERNS = [
  /\bbgp\b.*\b(?:down|closed|reset|hold timer expired|hold time expired|timeout)\b/i,
  /\bbgp\b.*\bsession\b.*\bdown\b/i,
  /\bospf\b.*\b(?:down|dead|lost|timeout|full\s*->\s*down)\b/i,
  /\badjacenc(?:y|ies)\b.*\bdown\b/i,
  /\bneighbor\b.*\b(?:down|lost|dead)\b/i,
  /\bwatchdog\b.*\breboot/i,
  /\breboot(?:ed|ing)?\b/i,
  /\bkernel\b.*\b(?:failure|panic|crash)\b/i,
  /\bcrash(?:ed)?\b/i,
  /\bconfig(?:uration)?\b.*\b(?:changed|modified|committed|saved)\b/i
];

const MEDIUM_SEVERITY_PATTERNS = [
  /\blink\s+down\b/i,
  /\blink\s+up\b/i,
  /\bflap(?:ped|ping)?\b/i,
  /\bsfp\b.*\b(?:warning|alarm|low|high|fault)\b/i,
  /\b(?:fcs|crc|frame check(?: sequence)?|input errors?|output errors?|rx errors?|tx errors?)\b/i,
  /\b(?:failed login|failed password|authentication failure|login failure)\b/i,
  /\bhardware\b.*\b(?:warning|error|failure)\b/i,
  /\b(?:script|address-list|firewall)\b.*\b(?:error|failed|failure)\b/i,
  /\broute\b.*\b(?:changed|removed|added|withdrawn)\b/i
];

const LOW_SEVERITY_PATTERNS = [
  /\blogin\b/i,
  /\blogout\b/i,
  /\blink\s+up\b/i,
  /\binfo(?:rmational)?\b/i
];

const SEVERITY_WEIGHT = {
  high: 3,
  medium: 2,
  low: 1
};

const MAX_EVENT_ENTRIES = 80;
const MAX_REPEATED_PATTERNS = 20;
const MAX_MESSAGE_LENGTH = 300;

function matchesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function truncateMessage(message, maxLength = MAX_MESSAGE_LENGTH) {
  const cleanMessage = String(message || '').replace(/\s+/g, ' ').trim();
  if (cleanMessage.length <= maxLength) {
    return cleanMessage;
  }

  return `${cleanMessage.slice(0, maxLength - 3)}...`;
}

function normalizeForGrouping(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '<ip>')
    .replace(/\b[0-9a-f]{2}(?::[0-9a-f]{2}){5}\b/gi, '<mac>')
    .replace(/\b[0-9a-f]{2}(?:-[0-9a-f]{2}){5}\b/gi, '<mac>')
    .replace(/\b\d{4,}\b/g, '<num>')
    .replace(/\s+/g, ' ')
    .trim();
}

function patternMessage(normalizedMessage) {
  return `Pattern: ${normalizedMessage}`;
}

function mergeKnownSites(existingSites = [], newSites = []) {
  const seen = new Set(existingSites.map((site) => `${site.ip || ''}|${site.name}`));
  const mergedSites = [...existingSites];

  for (const site of newSites) {
    const key = `${site.ip || ''}|${site.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      mergedSites.push(site);
    }
  }

  return mergedSites;
}

function mergeStrings(existingValues = [], newValues = []) {
  return [...new Set([...existingValues, ...newValues].filter(Boolean))];
}

function chooseInfrastructureContext(existingContext, newContext) {
  if (!existingContext) {
    return newContext || null;
  }

  if (!newContext) {
    return existingContext;
  }

  if (!existingContext.link && newContext.link) {
    return newContext;
  }

  return existingContext;
}

function shouldIncludeInfrastructureContext(category, group) {
  if (!group.infrastructureContext) {
    return false;
  }

  if (category === 'security_admin' || category === 'unknown') {
    return false;
  }

  return group.categories.some((groupCategory) =>
    ['routing', 'device_health', 'interface'].includes(groupCategory)
  );
}

function shouldIncludeTopologyContext(category, group) {
  return (
    shouldIncludeInfrastructureContext(category, group) ||
    (category !== 'security_admin' &&
      category !== 'unknown' &&
      Array.isArray(group.topologyNeighbors) &&
      group.topologyNeighbors.length > 0)
  );
}

function classifySeverity(text, categories) {
  if (matchesAny(text, HIGH_SEVERITY_PATTERNS)) {
    return 'high';
  }

  if (matchesAny(text, MEDIUM_SEVERITY_PATTERNS)) {
    return 'medium';
  }

  if (categories.includes('noise')) {
    return 'low';
  }

  if (matchesAny(text, LOW_SEVERITY_PATTERNS)) {
    return 'low';
  }

  return 'low';
}

export function classifyMessage(message) {
  const text = `${message?.source || ''} ${message?.message || ''}`;

  const matchedCategories = Object.entries(CATEGORY_PATTERNS)
    .filter(([category, patterns]) => category !== 'noise' && matchesAny(text, patterns))
    .map(([category]) => category);

  const isNoise = matchesAny(text, CATEGORY_PATTERNS.noise);
  const categories = matchedCategories.length > 0 ? matchedCategories : [];

  if (isNoise && categories.length === 0) {
    categories.push('noise');
  }

  if (categories.length === 0) {
    categories.push('unknown');
  }

  return {
    categories,
    severity: classifySeverity(text, categories),
    isNoise: categories.includes('noise')
  };
}

function createEmptyCategories() {
  return {
    routing: [],
    device_health: [],
    interface: [],
    security_admin: [],
    unknown: []
  };
}

function sortByUsefulness(a, b) {
  const severityDifference = SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
  if (severityDifference !== 0) {
    return severityDifference;
  }

  const countDifference = b.count - a.count;
  if (countDifference !== 0) {
    return countDifference;
  }

  return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
}

function getWindowConfig(config) {
  if (config?.window) {
    return config.window;
  }

  return {
    from: config?.from,
    to: config?.to,
    timezone: config?.timezone
  };
}

export function buildAggregate(messages, config = {}) {
  const window = getWindowConfig(config);
  const aggregate = {
    title: config.title,
    window,
    displayWindow: config.displayWindow || window,
    totals: {
      rawMessages: messages.length,
      analyzedMessages: 0,
      high: 0,
      medium: 0,
      low: 0,
      noise: 0,
      decommissionedFiltered: 0
    },
    categories: createEmptyCategories(),
    topSources: [],
    repeatedMessages: []
  };

  const sourceCounts = new Map();
  const groupedMessages = new Map();

  // Group similar messages before summarization so repeated flaps/logins do not
  // waste the OpenAI payload budget.
  for (const message of messages) {
    const source = message.source || 'unknown';

    if (message.infrastructureContext?.decommissioned) {
      aggregate.totals.decommissionedFiltered += 1;
      continue;
    }

    sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);

    const classification = classifyMessage(message);
    if (classification.isNoise) {
      aggregate.totals.noise += 1;
    } else {
      aggregate.totals.analyzedMessages += 1;
      aggregate.totals[classification.severity] += 1;
    }

    const normalizedMessage = normalizeForGrouping(message.message);
    const groupKey = `${normalizeForGrouping(source)}|${normalizedMessage}`;
    const existingGroup = groupedMessages.get(groupKey);
    const compactMessage = truncateMessage(message.message);

    if (existingGroup) {
      existingGroup.count += 1;
      existingGroup.lastTimestamp = message.timestamp || existingGroup.lastTimestamp;
      existingGroup.rawMessages.add(compactMessage);
      existingGroup.knownSites = mergeKnownSites(existingGroup.knownSites, message.knownSites);
      existingGroup.knownPath = existingGroup.knownPath || message.knownPath || null;
      existingGroup.interfaceContext =
        existingGroup.interfaceContext || message.interfaceContext || null;
      existingGroup.infrastructureContext = chooseInfrastructureContext(
        existingGroup.infrastructureContext,
        message.infrastructureContext
      );
      existingGroup.topologyNeighbors = mergeStrings(
        existingGroup.topologyNeighbors,
        message.topologyNeighbors
      );

      if (existingGroup.rawMessages.size > 1) {
        existingGroup.message = patternMessage(existingGroup.normalizedMessage);
      }

      continue;
    }

    groupedMessages.set(groupKey, {
      timestamp: message.timestamp,
      lastTimestamp: message.timestamp,
      source,
      severity: classification.severity,
      categories: classification.categories,
      normalizedMessage,
      message: compactMessage,
      sourceSite: message.sourceSite || null,
      knownSites: message.knownSites || [],
      knownPath: message.knownPath || null,
      interfaceContext: message.interfaceContext || null,
      infrastructureContext: message.infrastructureContext || null,
      topologyNeighbors: message.topologyNeighbors || [],
      rawMessages: new Set([compactMessage]),
      count: 1
    });
  }

  const sortedGroups = [...groupedMessages.values()].sort(sortByUsefulness);
  let eventEntryCount = 0;

  // Keep the payload intentionally small and biased toward high/medium events.
  for (const group of sortedGroups) {
    if (group.categories.includes('noise')) {
      continue;
    }

    for (const category of group.categories) {
      if (!aggregate.categories[category] || eventEntryCount >= MAX_EVENT_ENTRIES) {
        continue;
      }

      aggregate.categories[category].push({
        timestamp: group.timestamp,
        source: group.source,
        severity: group.severity,
        message: group.message,
        sourceSite: group.sourceSite,
        knownSites: group.knownSites,
        knownPath: group.knownPath,
        interfaceContext: group.interfaceContext,
        infrastructureContext: shouldIncludeInfrastructureContext(category, group)
          ? group.infrastructureContext
          : null,
        topologyNeighbors: shouldIncludeTopologyContext(category, group)
          ? group.topologyNeighbors
          : [],
        count: group.count
      });
      eventEntryCount += 1;
    }
  }

  aggregate.topSources = [...sourceCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([source, count]) => ({ source, count }));

  aggregate.repeatedMessages = sortedGroups
    .filter((group) => group.count > 1)
    .slice(0, MAX_REPEATED_PATTERNS)
    .map((group) => ({
      source: group.source,
      severity: group.severity,
      categories: group.categories,
      message: group.message,
      sourceSite: group.sourceSite,
      knownSites: group.knownSites,
      knownPath: group.knownPath,
      interfaceContext: group.interfaceContext,
      infrastructureContext: group.categories.some((groupCategory) =>
        ['routing', 'device_health', 'interface'].includes(groupCategory)
      )
        ? group.infrastructureContext
        : null,
      topologyNeighbors: group.categories.some((groupCategory) =>
        ['routing', 'device_health', 'interface'].includes(groupCategory)
      )
        ? group.topologyNeighbors
        : [],
      count: group.count
    }));

  return aggregate;
}
