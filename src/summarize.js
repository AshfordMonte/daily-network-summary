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
- Zabbix is the source of radio backhaul health, reachability, packet loss, bandwidth/interface utilization, temperature, power, and interface status context.
- The environment includes MikroTik routers, Netonix switches, backhauls, and core infrastructure.
- Most tower sites are connected by wireless point-to-point backhaul links.
- OSPF drops on tower/backhaul paths are often caused by power issues, storm-related interference, RF path degradation, or a tower/site going offline.
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
- correlations between Graylog syslog events and Zabbix problems in the same window
- daily changed Zabbix events first; longstandingActive Zabbix problems only when they are high/disaster severity or explain Graylog events
- knownPath and knownSites fields when present; use those to translate loopback IPs into site names
- topologyNeighbors when present; use them as context for likely adjacent backhaul paths, not as proof of the failed link

Ignore or minimize:
- DHCP noise
- DNS noise
- NTP noise
- routine firewall drops
- one-off informational logs
- duplicated messages unless count is meaningful

Output format:
*Daily Network Syslog Summary*
Window: \`<from> to <to>\`

*Overall*
- 1 to 2 bullets

*Routing*
- 0 to 3 bullets, or "No notable routing events."
- Skip "No notable BGP" bullets unless BGP events were present and need contrast.

*Device Health*
- 0 to 2 bullets covering reboots/crashes/watchdogs, Zabbix reachability, temperature, power, or host health.
- If there are no such events, say "No notable device health or availability events."

*Interfaces / Backhaul*
- 0 to 2 bullets covering Graylog interface logs plus Zabbix radio/backhaul/interface health, packet loss, bandwidth, or link status.
- If there are no such events, say "No notable interface or backhaul events."

*Security / Admin*
- 0 to 1 bullets, or "No notable security/admin events."

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
- If an event includes knownPath, describe the relationship as *knownPath.from* :left_right_arrow: *knownPath.to* instead of using only the loopback IP.
- If Zabbix shows an active or resolved outage/packet-loss/interface problem that lines up with syslog, mention that correlation briefly.
- If Zabbix has no matching problem for a noisy syslog flap, you may say "no matching Zabbix outage" only when it is useful.
- Treat zabbix.events as new/changed problems in the report window. Use them mainly in Device Health or Interfaces / Backhaul.
- Treat zabbix.longstandingActive as chronic background context. Do not headline it unless it is high/disaster severity, directly correlates with Graylog activity, or is a meaningful radio/backhaul health issue.
- Do not say "multiple longstanding Zabbix warnings remain" unless one of those warnings is important enough to name specifically.
- Do not dump every Zabbix problem; summarize only the events that explain or change the meaning of the Graylog digest.
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
