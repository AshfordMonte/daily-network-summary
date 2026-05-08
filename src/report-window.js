// Computes the report timerange for APIs and a local-time version for Slack.

export function calculateReportWindow(hours) {
  const toDate = new Date();
  const fromDate = new Date(toDate.getTime() - hours * 60 * 60 * 1000);

  return {
    from: fromDate.toISOString(),
    to: toDate.toISOString()
  };
}

export function formatReportWindowForDisplay(window, timezone) {
  return {
    from: formatDateForDisplay(window.from, timezone),
    to: formatDateForDisplay(window.to, timezone),
    timezone
  };
}

function formatDateForDisplay(value, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short'
  }).formatToParts(new Date(value));

  const partMap = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${partMap.year}-${partMap.month}-${partMap.day} ${partMap.hour}:${partMap.minute}:${partMap.second} ${partMap.timeZoneName}`;
}
