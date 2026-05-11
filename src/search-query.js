// Default Graylog search query. Keep it broad enough to catch network-relevant syslog, but avoid
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
  fcs OR
  crc OR
  "frame check" OR
  "frame check sequence" OR
  "input error" OR
  "input errors" OR
  "output error" OR
  "output errors" OR
  "rx error" OR
  "rx errors" OR
  "tx error" OR
  "tx errors" OR
  sfp OR
  backhaul OR
  radwin OR
  tarana OR
  blinq OR
  telrad OR
  siae OR
  olt OR
  script OR
  "address-list" OR
  login OR
  authentication OR
  configuration
)`;
