const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startOfYesterdayISO, parseActivity } = require('../src/lib/github');

// Dates are constructed in local time (no "Z" suffix) since startOfYesterdayISO
// computes "yesterday" using local-time day boundaries, not UTC.
test('startOfYesterdayISO returns the calendar day before the given date', () => {
  assert.equal(startOfYesterdayISO(new Date(2026, 2, 5, 14, 30)), '2026-03-04');
});

test('startOfYesterdayISO handles month/year boundaries', () => {
  assert.equal(startOfYesterdayISO(new Date(2026, 0, 1)), '2025-12-31');
});

test('parseActivity maps GitHub search-API shapes into our activity shape', () => {
  const authoredPRs = {
    items: [
      {
        title: 'Add feature',
        html_url: 'https://github.com/juan-rome/repo/pull/1',
        repository_url: 'https://api.github.com/repos/juan-rome/repo',
        state: 'open',
      },
    ],
  };
  const reviewedPRs = {
    items: [
      {
        title: 'Review this',
        html_url: 'https://github.com/juan-rome/other/pull/2',
        repository_url: 'https://api.github.com/repos/juan-rome/other',
      },
    ],
  };
  const commits = {
    items: [
      {
        commit: { message: 'fix: handle null case\n\nmore detail here' },
        repository: { full_name: 'juan-rome/repo' },
        html_url: 'https://github.com/juan-rome/repo/commit/abc',
      },
    ],
  };

  const result = parseActivity('juan-rome', authoredPRs, reviewedPRs, commits);

  assert.equal(result.user, 'juan-rome');
  assert.deepEqual(result.pullRequests, [
    {
      title: 'Add feature',
      url: 'https://github.com/juan-rome/repo/pull/1',
      repo: 'juan-rome/repo',
      state: 'open',
    },
  ]);
  assert.deepEqual(result.reviews, [
    {
      title: 'Review this',
      url: 'https://github.com/juan-rome/other/pull/2',
      repo: 'juan-rome/other',
    },
  ]);
  // Only the first line of a multi-line commit message is kept.
  assert.deepEqual(result.commits, [
    {
      message: 'fix: handle null case',
      repo: 'juan-rome/repo',
      url: 'https://github.com/juan-rome/repo/commit/abc',
    },
  ]);
});

test('parseActivity handles no activity', () => {
  const empty = { items: [] };
  const result = parseActivity('juan-rome', empty, empty, empty);
  assert.deepEqual(result, { user: 'juan-rome', pullRequests: [], reviews: [], commits: [] });
});
