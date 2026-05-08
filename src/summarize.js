// Sends the compact network payload to OpenAI and returns the Slack-ready text.

import OpenAI from 'openai';

const DEFAULT_MODEL = 'gpt-4.1-mini';
const DEFAULT_MAX_OUTPUT_TOKENS = 900;
const REASONING_MODEL_MAX_OUTPUT_TOKENS = 1800;

const SUMMARY_INSTRUCTIONS = `You are summarizing daily syslog events for an ISP network engineer.

Context:
- The network uses Graylog for syslog collection.
- Zabbix problem/event context may be included with availability, reachability, packet loss, interface, power, and host problem data.
- Zabbix events are split into daily changed events and a small capped longstandingActive list.
- Graylog is the source of device log, routing log, authentication, and configuration-change context.
- Zabbix is the source of radio/backhaul health, customer-facing access radio/OLT health, reachability, packet loss, bandwidth/interface utilization, temperature, power, and interface status context.
- Treat Graylog and Zabbix as complementary report inputs, not as systems that must confirm or contradict each other.
- The environment includes MikroTik routers, Netonix switches, backhauls, and core infrastructure.
- Most tower sites are connected by wireless point-to-point backhaul links.
- Some tower/office backhauls are fiber. Roy, Cox, and Stonewall can have fiber backhauls to the main office.
- OSPF drops on tower/backhaul paths are often caused by power issues, storm-related interference, RF path degradation, or a tower/site going offline.
- Radwin, Tarana, Blinq, and Telrad interfaces are customer-facing wireless sectors, not tower-to-tower backhauls.
- OLT interfaces are customer-facing fiber access, not tower-to-tower backhauls.
- BH, backhaul, SIAE, p2p, ptp, 18 GHz, 60 GHz, ALFOplus, and clear to-site interface names usually indicate tower/office backhaul links.
- "Above 50 dB" in Zabbix radio/backhaul context is a normal watch threshold for link health. Mention it as a watch item, not an outage by itself.
- Existing real-time Slack alerts already handle urgent BGP and OSPF events.
- This report is a daily morning digest.
- Do not exaggerate impact.
- Do not claim an outage unless the logs clearly support it.
- Treat power, weather/RF interference, and tower reachability as likely follow-up checks, not proven root causes.
- Prefer short, direct, actionable language.

Focus on:
- BGP instability
- OSPF adjacency or neighbor changes
- router/switch reboots
- watchdogs, kernel failures, crashes
- backhaul/core interface flaps
- repeated errors from the same device
- suspicious authentication or config activity
- correlations between OSPF drops and wireless backhaul/interface flaps at tower sites
- daily changed Zabbix events first; longstandingActive Zabbix problems only when they are high/disaster severity or meaningful radio/backhaul health context
- knownPath and knownSites fields when present; use those to translate loopback IPs into site names
- interfaceContext when present; use it to distinguish customer-facing access sectors/OLTs from tower/office backhauls
- topologyNeighbors when present; use them only as background topology context, not as proof that the neighbor had an outage

Ignore or minimize:
- DHCP noise
- DNS noise
- NTP noise
- routine firewall drops
- one-off informational logs
- duplicated messages unless count is meaningful

Output format:
*Daily Network Syslog Summary*
Window: \`<displayWindow.from> to <displayWindow.to>\`

*Overall*
- 1 to 2 bullets

*Routing*
- 0 to 3 bullets, or "No notable routing events."
- Skip "No notable BGP" bullets unless BGP events were present and need contrast.

*Device Health*
- 0 to 2 bullets covering reboots/crashes/watchdogs, Zabbix reachability, temperature, power, or host health.
- If there are no such events, say "No notable device health or availability events."
- Do not place login failures, authentication failures, config edits, firewall script errors, or address-list/script failures here unless they clearly caused device health impact.

*Wireless / Backhaul*
- 0 to 2 bullets covering Graylog interface logs plus Zabbix radio/backhaul/access-sector/OLT health, packet loss, bandwidth, or link status.
- If there are no such events, say "No notable wireless or backhaul events."

*Security / Admin*
- 0 to 1 bullets, or "No notable security/admin events."
- Put login failures, authentication failures, suspicious management access, and config/admin changes here.

*Other Notable Events*
- 0 to 1 bullets for operationally useful events that do not fit the sections above, such as firewall script errors or address-list/script failures.
- If there are no such events, omit this section entirely.

*Most Active Devices*
- 0 to 2 bullets naming devices/sites with the most meaningful activity, otherwise "No standout active devices."

Formatting rules:
- Use Slack mrkdwn, not markdown headings.
- Use single asterisks for bold text, for example *MikroTik-Blanco-T&J*. Do not use double asterisks.
- Keep one blank line between sections.
- Keep bullets short enough to scan quickly.
- Do not use a lead-in bullet that ends with a colon. Fold examples into the same bullet instead.
- Do not create nested lists; every bullet must stand on its own.
- Use device names and interface names exactly as provided.
- Never say "No notable..." in a section that also contains a real event for that same section.
- Prefer a short positive finding over a contradictory no-event statement.
- Prefer "no broad outage pattern is evident in the report data" over "no widespread outages reported."
- If an event includes knownPath, describe the relationship as *knownPath.from* :left_right_arrow: *knownPath.to* instead of using only the loopback IP.
- If interfaceContext.role is customer_access, describe it as a local customer-facing wireless sector or fiber OLT event. Do not infer an upstream/backhaul neighbor from topology.
- If interfaceContext.role is backhaul, describe it as a tower/office backhaul event and use knownPath when available.
- If an event only has topologyNeighbors, do not say the neighbor should have reported an outage. For a single local interface flap, describe only the local interface unless interfaceContext says it is backhaul.
- Do not write "no matching Zabbix outage/problem" or otherwise compare the tools just to prove one did not confirm the other.
- Mention a Graylog/Zabbix relationship only when both clearly describe the same site, device, interface, or backhaul event.
- Authentication/login failures belong in Security / Admin, not Device Health.
- Firewall script errors and address-list/script failures belong in Other Notable Events unless they are clearly part of a config/admin change.
- Treat zabbix.events as new/changed problems in the report window. Use them mainly in Device Health or Wireless / Backhaul.
- Treat zabbix.longstandingActive as chronic background context. Do not headline it unless it is high/disaster severity or a meaningful radio/backhaul health issue.
- Do not say "multiple longstanding Zabbix warnings remain" unless one of those warnings is important enough to name specifically.
- Do not dump every Zabbix problem; summarize only the Zabbix events that are operationally useful for the digest.
- Bold device names, site names, and important interface names with Slack mrkdwn.
- For site-to-site or device-to-device relationships, use exactly *Site A* :left_right_arrow: *Site B* when it improves scanning.
- Never start a bullet or relationship phrase with :left_right_arrow:.
- You may use common Slack emoji codes sparingly if they improve scanning.
- Do not include a Suggested Follow-Up section.
- Do not add a final recap, conclusion, recommendation paragraph, or next-steps paragraph after Most Active Devices.
Keep the final answer short enough for Slack.
Do not include markdown tables.
Do not include raw JSON.`;

function extractOutputText(response) {
  if (response.output_text) {
    return response.output_text.trim();
  }

  const textParts = [];
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) {
        textParts.push(content.text);
      }
    }
  }

  return textParts.join('\n').trim();
}

function isReasoningModel(model) {
  return /^(gpt-5|o\d|o4)/i.test(model);
}

function buildResponseParams({ model, compactPayload, reasoningEffort }) {
  const params = {
    model,
    instructions: SUMMARY_INSTRUCTIONS,
    input: JSON.stringify(compactPayload, null, 2),
    max_output_tokens: DEFAULT_MAX_OUTPUT_TOKENS
  };

  if (isReasoningModel(model)) {
    params.max_output_tokens = REASONING_MODEL_MAX_OUTPUT_TOKENS;
    params.reasoning = {
      effort: reasoningEffort || process.env.OPENAI_REASONING_EFFORT || 'minimal'
    };
    params.text = {
      verbosity: 'low'
    };
  }

  return params;
}

function describeEmptyResponse(response) {
  const outputTypes = (response.output || []).map((item) => item.type).join(', ') || 'none';
  const incompleteReason = response.incomplete_details?.reason || 'none';
  const status = response.status || 'unknown';
  const outputTokens = response.usage?.output_tokens ?? 'unknown';
  const reasoningTokens =
    response.usage?.output_tokens_details?.reasoning_tokens ?? 'unknown';

  return `status=${status}, incompleteReason=${incompleteReason}, outputTypes=${outputTypes}, outputTokens=${outputTokens}, reasoningTokens=${reasoningTokens}`;
}

export async function summarizeNetworkEvents(compactPayload, options = {}) {
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required to summarize events.');
  }

  const model = options.model || process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const client = new OpenAI({ apiKey });
  const response = await client.responses.create(
    buildResponseParams({
      model,
      compactPayload,
      reasoningEffort: options.reasoningEffort
    })
  );

  const summary = extractOutputText(response);
  if (!summary) {
    throw new Error(`OpenAI returned an empty summary (${describeEmptyResponse(response)}).`);
  }

  return summary;
}
