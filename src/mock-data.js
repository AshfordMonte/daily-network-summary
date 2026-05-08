// Small sample payloads for testing OpenAI and Slack without live Graylog/Zabbix.

export function getMockMessages(from, to) {
  return [
    {
      timestamp: from,
      source: 'core-router-01',
      message: 'BGP session to 203.0.113.1 down - hold timer expired',
      level: 3,
      facility: 'daemon',
      remoteIp: '10.0.0.1'
    },
    {
      timestamp: from,
      source: 'core-router-01',
      message: 'BGP session to 203.0.113.1 established',
      level: 5,
      facility: 'daemon',
      remoteIp: '10.0.0.1'
    },
    {
      timestamp: from,
      source: 'edge-router-02',
      message: 'OSPF neighbor 10.10.10.2 on ether3 down: inactivity timer',
      level: 3,
      facility: 'routing',
      remoteIp: '10.0.0.2'
    },
    {
      timestamp: from,
      source: 'Mikrotik-JohnsonCity-Crown',
      message: 'interface ether3-RadwinSE link down',
      level: 4,
      facility: 'interface',
      remoteIp: '10.255.1.16'
    },
    {
      timestamp: to,
      source: 'Mikrotik-JohnsonCity-Crown',
      message: 'interface ether3-RadwinSE link up',
      level: 5,
      facility: 'interface',
      remoteIp: '10.255.1.16'
    },
    {
      timestamp: from,
      source: 'MikroTik-Blanco-T&J',
      message: 'interface ether4-Polk-BH-Ethernet link down',
      level: 4,
      facility: 'interface',
      remoteIp: '10.255.1.21'
    },
    {
      timestamp: from,
      source: 'mikrotik-core-03',
      message: 'kernel failure in previous boot, possible watchdog reboot',
      level: 2,
      facility: 'kernel',
      remoteIp: '10.0.0.3'
    },
    {
      timestamp: to,
      source: 'netonix-backhaul-01',
      message: 'Port 5 link down, SFP warning: low receive optical power',
      level: 4,
      facility: 'switch',
      remoteIp: '10.0.0.4'
    },
    {
      timestamp: to,
      source: 'netonix-backhaul-01',
      message: 'Port 5 link up at 1000M full duplex',
      level: 5,
      facility: 'switch',
      remoteIp: '10.0.0.4'
    },
    {
      timestamp: to,
      source: 'core-router-01',
      message: 'failed login for admin from 198.51.100.22 via ssh',
      level: 4,
      facility: 'auth',
      remoteIp: '198.51.100.22'
    },
    {
      timestamp: to,
      source: 'core-router-01',
      message: 'failed login for admin from 198.51.100.23 via ssh',
      level: 4,
      facility: 'auth',
      remoteIp: '198.51.100.23'
    },
    {
      timestamp: to,
      source: 'dhcp-relay-01',
      message: 'DHCP lease renewed for 192.0.2.55',
      level: 6,
      facility: 'daemon',
      remoteIp: '10.0.0.5'
    }
  ];
}

export function getMockZabbixContext(from, to) {
  return {
    enabled: true,
    window: {
      from,
      to
    },
    totals: {
      fetched: 3,
      events: 2,
      changed: 2,
      changedSent: 2,
      active: 1,
      resolved: 1,
      highOrWorse: 1,
      longstandingActive: 1,
      longstandingActiveSent: 1,
      longstandingHighOrWorse: 0
    },
    events: [
      {
        eventId: 'mock-zbx-1',
        source: 'mock',
        status: 'resolved',
        startedAt: from,
        resolvedAt: to,
        severity: 4,
        severityName: 'high',
        hostNames: ['Mikrotik-JohnsonCity-Crown'],
        name: 'ICMP ping unavailable on Crown',
        opdata: '',
        acknowledged: false,
        suppressed: false,
        tags: [{ tag: 'scope', value: 'availability' }],
        siteHints: [{ name: 'Crown' }]
      },
      {
        eventId: 'mock-zbx-2',
        source: 'mock',
        status: 'active',
        startedAt: to,
        resolvedAt: null,
        severity: 3,
        severityName: 'average',
        hostNames: ['MikroTik-Blanco-T&J'],
        name: 'Interface ether4-Polk-BH-Ethernet has high packet loss',
        opdata: 'loss: 18%',
        acknowledged: false,
        suppressed: false,
        tags: [{ tag: 'scope', value: 'interface' }],
        siteHints: [{ name: 'T&J' }, { name: 'Polk' }],
        interfaceContext: {
          role: 'backhaul',
          service: 'tower_backhaul',
          medium: 'wireless_or_fiber',
          technology: null,
          interfaceName: 'ether4-Polk-BH-Ethernet',
          customerFacing: false,
          backhaul: true,
          note: 'tower-to-tower or office backhaul link'
        }
      }
    ],
    longstandingActive: [
      {
        eventId: 'mock-zbx-3',
        source: 'mock',
        status: 'active',
        startedAt: new Date(new Date(from).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        resolvedAt: null,
        severity: 2,
        severityName: 'warning',
        hostNames: ['Radio-Blanco-Polk'],
        name: 'Radio receive signal low',
        opdata: 'rx: -76 dBm',
        acknowledged: false,
        suppressed: false,
        tags: [{ tag: 'scope', value: 'radio' }],
        siteHints: [{ name: 'Polk' }],
        interfaceContext: {
          role: 'backhaul',
          service: 'tower_backhaul',
          medium: 'wireless',
          technology: null,
          interfaceName: null,
          customerFacing: false,
          backhaul: true,
          note: 'tower-to-tower or office backhaul link'
        }
      }
    ]
  };
}
