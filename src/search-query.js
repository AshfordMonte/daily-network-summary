// Keep this query broad enough to catch network-relevant syslog, but avoid
// expensive leading wildcards that can make OpenSearch fail on larger indexes.
export const DEFAULT_SEARCH_QUERY = `(
  bgp OR
  ospf OR
  neighbor OR
  adjacency OR
  reboot OR
  watchdog OR
  kernel OR
  failure OR
  crash OR
  "link down" OR
  "link up" OR
  interface OR
  sfp OR
  login OR
  authentication OR
  configuration
)`;
