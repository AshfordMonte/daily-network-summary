const SLACK_MESSAGE_LIMIT = 3900;
const DEFAULT_TITLE = 'Daily Network Syslog Summary';
const SECTION_HEADINGS = [
  'Overall',
  'Routing',
  'Device Health',
  'Interfaces / Backhaul',
  'Security / Admin',
  'Most Active Devices'
];

const SECTION_ALIASES = {
  'noisy devices': 'Most Active Devices'
};

function stripOuterBold(value) {
  return value.replace(/^\*+|\*+$/g, '').trim();
}

function boldFirstLine(text) {
  const lines = text.split(/\r?\n/);
  const firstContentLine = lines.findIndex((line) => line.trim().length > 0);

  if (firstContentLine === -1) {
    return `*${process.env.REPORT_TITLE || DEFAULT_TITLE}*\nNo summary returned.`;
  }

  let title = stripOuterBold(lines[firstContentLine].replace(/^#+\s*/, ''));
  const configuredTitle = process.env.REPORT_TITLE?.trim();

  if (configuredTitle && title === DEFAULT_TITLE) {
    title = configuredTitle;
  }

  lines[firstContentLine] = `*${title}*`;

  return lines.join('\n').trim();
}

function normalizeText(text) {
  return String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\*\*([^*\n]+)\*\*/g, '*$1*')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

function styleWindowLine(line) {
  const match = line.match(/^Window:\s*(.+)$/i);
  if (!match) {
    return line;
  }

  const windowText = match[1].replace(/^`|`$/g, '').trim();
  return `Window: \`${windowText}\``;
}

function styleSectionHeading(line) {
  const unstyledLine = stripOuterBold(line.replace(/^#+\s*/, '').replace(/:$/, ''));
  const normalizedHeading = SECTION_ALIASES[unstyledLine.toLowerCase()] || unstyledLine;
  const matchedHeading = SECTION_HEADINGS.find(
    (heading) => heading.toLowerCase() === normalizedHeading.toLowerCase()
  );

  return matchedHeading ? `*${matchedHeading}*` : line;
}

function fixArrowPlacement(line) {
  return line
    .replace(/\b(between|on|at|with)\s+:left_right_arrow:\s+/gi, '$1 ')
    .replace(/^-\s+:left_right_arrow:\s+/, '- ')
    .replace(/\s+:left_right_arrow:\s+:left_right_arrow:\s+/g, ' :left_right_arrow: ');
}

function styleLines(text) {
  return text
    .split('\n')
    .map((line) => styleSectionHeading(styleWindowLine(fixArrowPlacement(line.trim()))))
    .join('\n');
}

function compactSectionSpacing(text) {
  const lines = text.split('\n');
  const compactLines = [];

  for (const line of lines) {
    const isHeading = SECTION_HEADINGS.some((heading) => line === `*${heading}*`);
    const previousLine = compactLines[compactLines.length - 1];

    if (line === '') {
      if (previousLine !== '' && previousLine !== undefined) {
        compactLines.push(line);
      }
      continue;
    }

    if (isHeading && compactLines.length > 0 && previousLine !== '') {
      compactLines.push('');
    }

    compactLines.push(line);
  }

  return compactLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function isSectionHeading(line) {
  return SECTION_HEADINGS.some((heading) => line === `*${heading}*`);
}

function removeTrailingRecap(text) {
  const lines = text.split('\n');

  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }

  const lastLine = lines[lines.length - 1]?.trim() || '';
  const looksLikeRecap =
    !lastLine.startsWith('- ') &&
    !lastLine.startsWith('*Daily Network Syslog Summary*') &&
    !lastLine.startsWith('Window:') &&
    !isSectionHeading(lastLine) &&
    /^(overall|in summary|summary|recommend|recommended|next steps?|as a next step)\b/i.test(
      lastLine
    );

  if (looksLikeRecap) {
    lines.pop();
  }

  return lines.join('\n').trim();
}

export function formatSlackMessage(summaryText) {
  const formatted = removeTrailingRecap(
    compactSectionSpacing(styleLines(boldFirstLine(normalizeText(summaryText))))
  );

  if (formatted.length <= SLACK_MESSAGE_LIMIT) {
    return formatted;
  }

  return `${formatted.slice(0, SLACK_MESSAGE_LIMIT - 40).trim()}\n\n_Trimmed for Slack length._`;
}
