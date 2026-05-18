// Site names and loopbacks are specific to the local HC Wireless topology.

export const LOOPBACK_SITE_MAP = {
  '10.56.3.52': 'JCWT-DP-SW',
  '10.56.206.22': 'AA02-35-SW1',
  '10.100.104.2': 'AB01-42-SW1',
  '10.100.104.3': 'AA01-33-AG-SW1',
  '10.100.104.4': 'AB01-16-SW1',
  '10.255.1.3': 'JCWT',
  '10.255.1.10': 'Cox',
  '10.255.1.11': 'Polk',
  '10.255.1.12': 'Cypress Mill',
  '10.255.1.14': 'Bentley',
  '10.255.1.15': 'Cole',
  '10.255.1.16': 'Crown',
  '10.255.1.17': 'Majestic Hills',
  '10.255.1.18': 'Koch',
  '10.255.1.19': 'Legacy Hills',
  '10.255.1.21': 'T&J',
  '10.255.1.22': 'Schumann',
  '10.255.1.23': 'Cypress Creek RV',
  '10.255.1.25': 'Preserves',
  '10.255.1.26': 'Southold',
  '10.255.1.27': 'Grape Creek',
  '10.255.1.28': 'Stonewall Main',
  '10.255.2.1': 'StonewallFW1',
  '10.255.2.2': 'AA02-39-FW1',
  '10.255.2.3': 'AA02-37-R1',
  '10.255.2.4': 'AA02-26-DHCP1',
  '10.255.2.5': 'AA02-30-VPN1',
  '10.255.2.9': 'Roy',
  '23.151.240.82': 'Dude Server'
};

export const TOPOLOGY_LINKS = [
  ['JC Main', 'Roy'],
  ['JC Main', 'JCWT'],
  ['JC Main', 'Cox'],
  ['JC Main', 'Stonewall Main'],
  ['Roy', 'Bentley'],
  ['Roy', 'Crown'],
  ['Roy', 'Cypress Mill'],
  ['Cox', 'Polk'],
  ['Cox', 'Cole'],
  ['Cox', 'Koch'],
  ['Polk', 'Majestic Hills'],
  ['Polk', 'T&J'],
  ['T&J', 'Schumann'],
  ['T&J', 'Preserves'],
  ['Koch', 'Legacy Hills'],
  ['Stonewall Main', 'Southold'],
  ['Southold', 'Grape Creek']
];

export const SITE_DEPENDENCY_TREE = {
  'JC Main': ['Roy', 'JCWT', 'Cox', 'Stonewall Main'],
  Roy: ['Bentley', 'Crown', 'Cypress Mill'],
  Cox: ['Polk', 'Cole', 'Koch'],
  Polk: ['Majestic Hills', 'T&J'],
  'T&J': ['Schumann', 'Preserves'],
  Koch: ['Legacy Hills'],
  'Stonewall Main': ['Southold'],
  Southold: ['Grape Creek']
};

export const DECOMMISSIONED_INFRASTRUCTURE = [
  {
    id: 'roy-jcwt-legacy-wireless-backhaul',
    name: 'Roy <-> JCWT legacy wireless backhaul',
    sites: ['Roy', 'JCWT'],
    patterns: [
      /\bjc[-_\s]?wt[-_\s]?(?:to|toward)[-_\s]?roy\b/i,
      /\broy[-_\s]?(?:to|toward)[-_\s]?jc[-_\s]?wt\b/i,
      /\bjcwt[-_\s]?roy\b/i,
      /\broy[-_\s]?jcwt\b/i,
      /\bwater\s*tower\b.*\broy\b/i,
      /\broy\b.*\bwater\s*tower\b/i
    ]
  }
];

const SITE_ALIASES = {
  JCMain: 'JC Main',
  'JC-Main': 'JC Main',
  'JC Main': 'JC Main',
  JCCore: 'JC Main',
  'JC Core': 'JC Main',
  CoreRouter: 'JC Main',
  'Core Router': 'JC Main',
  BlancoCox: 'Cox',
  BlancoCole: 'Cole',
  BlancoPolk: 'Polk',
  BlancoSchumann: 'Schumann',
  'Blanco-T&J': 'T&J',
  'Blanco-TJ': 'T&J',
  TJ: 'T&J',
  CypressMill: 'Cypress Mill',
  GrapeCreek: 'Grape Creek',
  StonewallCoreRTR: 'Stonewall Main',
  Majestic: 'Majestic Hills',
  Legacy: 'Legacy Hills',
  JCWT: 'JCWT',
  'JC-WT': 'JCWT',
  JCRoy: 'Roy',
  'JC-Roy': 'Roy',
  JohnsonCityCrown: 'Crown',
  JohnsonCityBentley: 'Bentley',
  JohnsonCityCypressMill: 'Cypress Mill'
};

const IP_ADDRESS_PATTERN = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;

const CUSTOMER_ACCESS_PATTERNS = [
  { pattern: /\bradwin[a-z0-9-]*\b/i, technology: 'Radwin', medium: 'wireless' },
  { pattern: /\bhbs[a-z0-9_-]*\b/i, technology: 'Radwin', medium: 'wireless' },
  { pattern: /\btarana[a-z0-9-]*\b/i, technology: 'Tarana', medium: 'wireless' },
  { pattern: /\bblinq[a-z0-9-]*\b/i, technology: 'Blinq', medium: 'wireless' },
  { pattern: /\btelrad[a-z0-9-]*\b/i, technology: 'Telrad', medium: 'wireless' },
  { pattern: /\bolt[a-z0-9-]*\b/i, technology: 'OLT', medium: 'fiber' }
];

const BACKHAUL_PATTERNS = [
  { pattern: /\b(?:bh|backhaul)\b/i, technology: null, medium: 'wireless_or_fiber' },
  { pattern: /\bsiae\b/i, technology: 'SIAE', medium: 'wireless' },
  { pattern: /(?:^|[^a-z0-9])p2p(?:[^a-z0-9]|$)/i, technology: null, medium: 'wireless_or_fiber' },
  { pattern: /(?:^|[^a-z0-9])ptp(?:[^a-z0-9]|$)/i, technology: null, medium: 'wireless_or_fiber' },
  { pattern: /\b(?:18|60)\s*ghz\b/i, technology: null, medium: 'wireless' },
  { pattern: /\balfoplus\d*\b/i, technology: 'SIAE ALFOplus', medium: 'wireless' }
];

function compactName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function canonicalSiteName(value) {
  if (!value) {
    return null;
  }

  const exactAlias = SITE_ALIASES[value];
  if (exactAlias) {
    return exactAlias;
  }

  const compactValue = compactName(value);
  const match = SITE_NAME_LOOKUP.find((site) => site.compact === compactValue);
  return match?.canonicalName || null;
}

const SITE_NAMES = [
  ...new Set([
    ...Object.values(LOOPBACK_SITE_MAP),
    ...TOPOLOGY_LINKS.flat(),
    ...Object.keys(SITE_ALIASES),
    ...Object.values(SITE_ALIASES)
  ])
];

const SITE_NAME_LOOKUP = SITE_NAMES
  .map((name) => ({
    name,
    canonicalName: SITE_ALIASES[name] || name,
    compact: compactName(name)
  }))
  .sort((a, b) => b.compact.length - a.compact.length);

function uniqueSites(sites) {
  const seen = new Set();

  return sites.filter((site) => {
    const key = `${site.ip || ''}|${site.name}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function uniqueSiteNames(siteNames) {
  return [...new Set(siteNames.filter(Boolean))];
}

function getParentSite(siteName) {
  return (
    Object.entries(SITE_DEPENDENCY_TREE).find(([, childSites]) =>
      childSites.includes(siteName)
    )?.[0] || null
  );
}

function getChildSites(siteName) {
  return SITE_DEPENDENCY_TREE[siteName] || [];
}

function getDownstreamSites(siteName) {
  const downstreamSites = [];
  const pendingSites = [...getChildSites(siteName)];

  while (pendingSites.length > 0) {
    const childSite = pendingSites.shift();
    downstreamSites.push(childSite);
    pendingSites.push(...getChildSites(childSite));
  }

  return downstreamSites;
}

function findSiteMentions(text) {
  const compactText = compactName(text);
  if (!compactText) {
    return [];
  }

  const mentions = SITE_NAME_LOOKUP.map((site) => ({
    name: site.canonicalName,
    index: compactText.indexOf(site.compact)
  }))
    .filter((site) => site.index >= 0)
    .sort((a, b) => a.index - b.index);

  return uniqueSites(mentions);
}

function getDirectDependencyLink(siteA, siteB) {
  if (!siteA || !siteB || siteA === siteB) {
    return null;
  }

  if (getParentSite(siteA) === siteB) {
    return {
      parentSite: siteB,
      childSite: siteA
    };
  }

  if (getParentSite(siteB) === siteA) {
    return {
      parentSite: siteA,
      childSite: siteB
    };
  }

  return null;
}

function buildLinkDependencyContext(siteA, siteB) {
  const directLink = getDirectDependencyLink(siteA, siteB);
  if (!directLink) {
    return null;
  }

  const downstreamSites = getDownstreamSites(directLink.childSite);

  return {
    from: directLink.parentSite,
    to: directLink.childSite,
    parentSite: directLink.parentSite,
    childSite: directLink.childSite,
    downstreamSites,
    branchSites: [directLink.childSite, ...downstreamSites]
  };
}

function buildSiteDependencyContext(siteName) {
  if (!siteName) {
    return null;
  }

  const childSites = getChildSites(siteName);
  const downstreamSites = getDownstreamSites(siteName);

  return {
    site: siteName,
    parentSite: getParentSite(siteName),
    childSites,
    downstreamSites
  };
}

function buildDependencyContext({ sourceSite, knownSites = [], text = '' }) {
  const mentionedSites = findSiteMentions(text).map((site) => site.name);
  const knownSiteNames = knownSites.map((site) => site.name);
  const matchedSites = uniqueSiteNames([
    canonicalSiteName(sourceSite) || sourceSite,
    ...mentionedSites,
    ...knownSiteNames
  ]);
  const site = canonicalSiteName(sourceSite) || sourceSite || matchedSites[0] || null;
  const remoteSite = matchedSites.find((candidate) => candidate !== site) || null;
  const link = buildLinkDependencyContext(site, remoteSite);
  const siteContext = buildSiteDependencyContext(site);
  const decommissioned = getDecommissionedInfrastructureContext({
    matchedSites,
    text
  });

  if (!siteContext && !link && matchedSites.length === 0) {
    return null;
  }

  return {
    ...siteContext,
    matchedSites,
    link,
    decommissioned
  };
}

function getDecommissionedInfrastructureContext({ matchedSites = [], text = '' }) {
  const matchedSiteSet = new Set(matchedSites);
  const match = DECOMMISSIONED_INFRASTRUCTURE.find((item) => {
    const hasAllSites = item.sites.every((site) => matchedSiteSet.has(site));
    return hasAllSites && item.patterns.some((pattern) => pattern.test(text));
  });

  return match
    ? {
        id: match.id,
        name: match.name,
        sites: match.sites
      }
    : null;
}

function matchInterfacePattern(text, patterns) {
  return patterns.find(({ pattern }) => pattern.test(text));
}

function extractInterfaceName(text) {
  const patterns = [
    /\b(?:interface|port)\s+([a-z0-9._:%/+&-]+)/i,
    /\b((?:ether|sfp|vlan|bridge|bond|lag|p2p|ptp|v\d+)[a-z0-9._:%/+&-]*)\b/i
  ];

  for (const pattern of patterns) {
    const match = String(text || '').match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function getInterfaceText(value) {
  if (!value || typeof value !== 'object') {
    return String(value || '');
  }

  return [
    value.source,
    value.message,
    value.remoteIp,
    value.name,
    value.opdata,
    ...(Array.isArray(value.hostNames) ? value.hostNames : [])
  ]
    .filter(Boolean)
    .join(' ');
}

function hasSiteToSiteHint(text) {
  if (!/(?:^|[^a-z0-9])(?:to|toward)[-_ ]?[a-z0-9]+/i.test(text)) {
    return false;
  }

  return findKnownSiteNames(text).length >= 2;
}

export function findKnownLoopbacks(text) {
  const matches = String(text || '').match(IP_ADDRESS_PATTERN) || [];

  return uniqueSites(
    matches
      .filter((ip) => LOOPBACK_SITE_MAP[ip])
      .map((ip) => ({
        ip,
        name: LOOPBACK_SITE_MAP[ip]
      }))
  );
}

export function findKnownSiteNames(text) {
  return findSiteMentions(text).map((site) => ({ name: site.name }));
}

export function inferSiteFromSource(source) {
  const compactSource = compactName(source);
  if (!compactSource) {
    return null;
  }

  const match = SITE_NAME_LOOKUP.find((site) => compactSource.includes(site.compact));
  return match?.canonicalName || null;
}

export function classifyInterfaceContext(value) {
  const text = getInterfaceText(value);
  const interfaceName = extractInterfaceName(text);
  const customerAccessMatch = matchInterfacePattern(text, CUSTOMER_ACCESS_PATTERNS);

  if (customerAccessMatch) {
    return {
      role: 'customer_access',
      service: customerAccessMatch.medium === 'fiber' ? 'fiber_olt' : 'wireless_sector',
      medium: customerAccessMatch.medium,
      technology: customerAccessMatch.technology,
      interfaceName,
      customerFacing: true,
      backhaul: false,
      note:
        customerAccessMatch.medium === 'fiber'
          ? 'customer-facing fiber OLT'
          : 'customer-facing tower radio sector'
    };
  }

  const backhaulMatch = matchInterfacePattern(text, BACKHAUL_PATTERNS);
  if (backhaulMatch || hasSiteToSiteHint(text)) {
    return {
      role: 'backhaul',
      service: 'tower_backhaul',
      medium: backhaulMatch?.medium || 'wireless_or_fiber',
      technology: backhaulMatch?.technology || null,
      interfaceName,
      customerFacing: false,
      backhaul: true,
      note: 'tower-to-tower or office backhaul link'
    };
  }

  return interfaceName
    ? {
        role: 'interface',
        service: 'unknown_interface',
        medium: null,
        technology: null,
        interfaceName,
        customerFacing: false,
        backhaul: false,
        note: 'interface event with unknown service role'
      }
    : null;
}

function sortTopologySitesForSource(sourceSite, sites) {
  if (!sourceSite) {
    return sites;
  }

  const directNeighbors = new Set(getTopologyNeighbors(sourceSite));
  return [...sites].sort((a, b) => {
    const aIsNeighbor = directNeighbors.has(a.name) ? 1 : 0;
    const bIsNeighbor = directNeighbors.has(b.name) ? 1 : 0;
    return bIsNeighbor - aIsNeighbor;
  });
}

export function getTopologyNeighbors(siteName) {
  return TOPOLOGY_LINKS.filter(([a, b]) => a === siteName || b === siteName).map(([a, b]) =>
    a === siteName ? b : a
  );
}

export function getSiteDependencyContext(siteName) {
  return buildSiteDependencyContext(canonicalSiteName(siteName) || siteName);
}

export function getLinkDependencyContext(siteA, siteB) {
  return buildLinkDependencyContext(
    canonicalSiteName(siteA) || siteA,
    canonicalSiteName(siteB) || siteB
  );
}

export function getInfrastructureContext(value = {}) {
  const text = getInterfaceText(value);
  const sourceSite = value.sourceSite || inferSiteFromSource(value.source);
  const knownSites = [
    ...(Array.isArray(value.knownSites) ? value.knownSites : []),
    ...(Array.isArray(value.siteHints) ? value.siteHints : []),
    ...findKnownLoopbacks(`${text} ${value.remoteIp || ''}`),
    ...findKnownSiteNames(text)
  ];

  return buildDependencyContext({
    sourceSite,
    knownSites: uniqueSites(knownSites),
    text
  });
}

export function isDecommissionedInfrastructure(value = {}) {
  return Boolean(
    value.infrastructureContext?.decommissioned || getInfrastructureContext(value)?.decommissioned
  );
}

export function enrichMessageWithSiteHints(message) {
  const sourceSite = inferSiteFromSource(message.source);
  const interfaceContext = classifyInterfaceContext(message);
  const topologyNeighbors =
    sourceSite && interfaceContext?.role !== 'customer_access'
      ? getTopologyNeighbors(sourceSite)
      : [];
  const knownSites = uniqueSites(
    [
      ...findKnownLoopbacks(`${message.message || ''} ${message.remoteIp || ''}`),
      ...findKnownSiteNames(`${message.source || ''} ${message.message || ''}`)
    ].filter((site) => site.name !== sourceSite)
  );
  const remoteSite =
    interfaceContext?.role === 'customer_access'
      ? null
      : sortTopologySitesForSource(sourceSite, knownSites)[0];

  return {
    ...message,
    sourceSite,
    knownSites,
    topologyNeighbors,
    interfaceContext,
    infrastructureContext: getInfrastructureContext({
      ...message,
      sourceSite,
      knownSites
    }),
    knownPath:
      sourceSite && remoteSite
        ? {
            from: sourceSite,
            to: remoteSite.name,
            toIp: remoteSite.ip || null,
            isDirectTopologyLink: topologyNeighbors.includes(remoteSite.name)
          }
        : null
  };
}
