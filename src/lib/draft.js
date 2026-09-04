function draftStandup(activity) {
  const lines = [`*Standup — ${activity.user}*`, ''];

  lines.push('*Yesterday:*');
  if (activity.commits.length === 0 && activity.pullRequests.length === 0) {
    lines.push('- No tracked GitHub activity found');
  } else {
    for (const pr of activity.pullRequests) {
      lines.push(`- Opened/updated PR: <${pr.url}|${pr.title}> (${pr.repo})`);
    }
    const commitRepos = groupBy(activity.commits, (c) => c.repo);
    for (const [repo, commits] of Object.entries(commitRepos)) {
      lines.push(`- ${commits.length} commit(s) in ${repo}: ${commits[0].message}${commits.length > 1 ? ', ...' : ''}`);
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
