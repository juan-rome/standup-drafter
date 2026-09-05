const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startOfYesterdayISO, parseActivity, extractTicketKeys } = require('../src/lib/github');

// Dates are constructed in local time (no "Z" suffix) since startOfYesterdayISO
// computes "yesterday" using local-time day boundaries, not UTC.
test('startOfYesterdayISO returns the calendar day before the given date', () => {
  assert.equal(startOfYesterdayISO(new Date(2026, 2, 5, 14, 30)), '2026-03-04');
});

test('startOfYesterdayISO handles month/year boundaries', () => {
  assert.equal(startOfYesterdayISO(new Date(2026, 0, 1)), '2025-12-31');
});

test('extractTicketKeys finds bare keys and keys embedded in Jira URLs', () => {
  assert.deepEqual(extractTicketKeys('KAN-4: Add a live character counter'), ['KAN-4']);
  assert.deepEqual(
    extractTicketKeys('See https://yourteam.atlassian.net/browse/KAN-12 for context'),
    ['KAN-12']
  );
  assert.deepEqual(extractTicketKeys('no ticket mentioned here'), []);
  assert.deepEqual(extractTicketKeys(null), []);
});

test('parseActivity maps GitHub search-API shapes into our activity shape', () => {
  const authoredPRs = {
    items: [
      {
        title: 'KAN-4: Add feature',
        body: 'Implements the thing.\n\nJira: https://yourteam.atlassian.net/browse/KAN-4',
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
        commit: { message: 'KAN-7 fix: handle null case\n\nmore detail here' },
        repository: { full_name: 'juan-rome/repo' },
        html_url: 'https://github.com/juan-rome/repo/commit/abc',
      },
    ],
  };

  const result = parseActivity('juan-rome', authoredPRs, reviewedPRs, commits);

  assert.equal(result.user, 'juan-rome');
  assert.deepEqual(result.pullRequests, [
    {
      title: 'KAN-4: Add feature',
      url: 'https://github.com/juan-rome/repo/pull/1',
      repo: 'juan-rome/repo',
      state: 'open',
      ticketKeys: ['KAN-4'],
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
      message: 'KAN-7 fix: handle null case',
      repo: 'juan-rome/repo',
      url: 'https://github.com/juan-rome/repo/commit/abc',
      ticketKeys: ['KAN-7'],
    },
  ]);
  // Deduped (KAN-4 appears in both title and body) and sorted; reviewed-only
  // PRs don't count toward "tickets you worked on".
  assert.deepEqual(result.ticketKeys, ['KAN-4', 'KAN-7']);
  assert.deepEqual(result.tickets, [
    {
      key: 'KAN-4',
      prs: [
        {
          title: 'KAN-4: Add feature',
          url: 'https://github.com/juan-rome/repo/pull/1',
          repo: 'juan-rome/repo',
          state: 'open',
        },
      ],
      commits: [],
    },
    {
      key: 'KAN-7',
      prs: [],
      commits: [
        {
          message: 'KAN-7 fix: handle null case',
          repo: 'juan-rome/repo',
          url: 'https://github.com/juan-rome/repo/commit/abc',
        },
      ],
    },
  ]);
});

test('parseActivity handles no activity', () => {
  const empty = { items: [] };
  const result = parseActivity('juan-rome', empty, empty, empty);
  assert.deepEqual(result, {
    user: 'juan-rome',
    pullRequests: [],
    reviews: [],
    commits: [],
    tickets: [],
    ticketKeys: [],
  });
});
