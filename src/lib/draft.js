function stripTicketPrefix(text, key) {
  const prefixPattern = new RegExp(`^\\[?${key}\\]?[:\\-]?\\s+`, 'i');
  const stripped = text.replace(prefixPattern, '').trim();
  return stripped.length > 0 ? stripped : text;
}

// Conventional-commit prefixes (feat:, fix(scope):, chore!:, ...) read as
// git jargon in a standup message meant for humans — strip them and
// capitalize what's left. Only affects the drafted text, never the
// underlying commit/PR data.
const CONVENTIONAL_COMMIT_PREFIX = /^(feat|fix|chore|docs|refactor|test|style|perf|build|ci)(\([^)]*\))?!?:\s*/i;

function humanize(text) {
  const withoutPrefix = text.replace(CONVENTIONAL_COMMIT_PREFIX, '').trim();
  if (withoutPrefix.length === 0) return text;
  return withoutPrefix.charAt(0).toUpperCase() + withoutPrefix.slice(1);
}

function draftTicketLines(ticket) {
  const lines = [`- *${ticket.key}*${ticket.jira ? ` — ${ticket.jira.status}` : ''}`];

  if (ticket.prs.length > 0) {
    const pr = ticket.prs[0];
    lines.push(`  - PR: <${pr.url}|${pr.title}>`);
    lines.push(`  - ${humanize(stripTicketPrefix(pr.title, ticket.key))}`);
  } else if (ticket.commits.length > 0) {
    const commit = ticket.commits[0];
    lines.push(`  - Commit: <${commit.url}|${commit.repo}>`);
    lines.push(`  - ${humanize(stripTicketPrefix(commit.message, ticket.key))}`);
  } else if (ticket.jira) {
    lines.push(`  - ${ticket.jira.summary}`);
  }

  return lines;
}

function draftStandup(activity) {
  const lines = [`*Standup — ${activity.user}*`, ''];
  lines.push('*Yesterday:*');

  const tickets = activity.tickets || [];
  const untrackedPRs = activity.pullRequests.filter((pr) => !pr.ticketKeys || pr.ticketKeys.length === 0);
  const untrackedCommits = activity.commits.filter((c) => !c.ticketKeys || c.ticketKeys.length === 0);

  if (tickets.length === 0 && untrackedPRs.length === 0 && untrackedCommits.length === 0) {
    lines.push('- No tracked GitHub activity found');
  } else {
    for (const ticket of tickets) {
      lines.push(...draftTicketLines(ticket));
    }
    for (const pr of untrackedPRs) {
      lines.push(`- Opened/updated PR: <${pr.url}|${pr.title}> (${pr.repo})`);
    }
    const commitRepos = groupBy(untrackedCommits, (c) => c.repo);
    for (const [repo, commits] of Object.entries(commitRepos)) {
      lines.push(`- ${commits.length} commit(s) in ${repo}: ${humanize(commits[0].message)}${commits.length > 1 ? ', ...' : ''}`);
    }
  }

  if (activity.reviews.length > 0) {
    lines.push('');
    lines.push('*Reviews:*');
    for (const r of activity.reviews) {
      lines.push(`- Reviewed <${r.url}|${r.title}> (${r.repo})`);
    }
  }

  lines.push('');
  lines.push('*Today:*');
  lines.push('- ');
  lines.push('');
  lines.push('*Blockers:*');
  lines.push('- None');

  return lines.join('\n');
}

function groupBy(items, keyFn) {
  return items.reduce((acc, item) => {
    const key = keyFn(item);
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});
}

module.exports = { draftStandup };
