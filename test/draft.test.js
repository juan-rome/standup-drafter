const { test } = require('node:test');
const assert = require('node:assert/strict');
const { draftStandup } = require('../src/lib/draft');

test('draftStandup reports no activity when nothing happened', () => {
  const text = draftStandup({ user: 'juan', pullRequests: [], reviews: [], commits: [] });
  assert.match(text, /No tracked GitHub activity found/);
  assert.match(text, /\*Standup — juan\*/);
});

test('draftStandup lists each authored PR on its own line', () => {
  const text = draftStandup({
    user: 'juan',
    pullRequests: [
      { title: 'Add feature', url: 'https://github.com/x/y/pull/1', repo: 'x/y' },
      { title: 'Fix bug', url: 'https://github.com/x/y/pull/2', repo: 'x/y' },
    ],
    reviews: [],
    commits: [],
  });
  assert.match(text, /Opened\/updated PR: <https:\/\/github\.com\/x\/y\/pull\/1\|Add feature> \(x\/y\)/);
  assert.match(text, /Opened\/updated PR: <https:\/\/github\.com\/x\/y\/pull\/2\|Fix bug> \(x\/y\)/);
});

test('draftStandup groups commits by repo and flags multiple commits with ellipsis', () => {
  const text = draftStandup({
    user: 'juan',
    pullRequests: [],
    reviews: [],
    commits: [
      { message: 'first commit', repo: 'x/y' },
      { message: 'second commit', repo: 'x/y' },
      { message: 'only commit', repo: 'x/z' },
    ],
  });
  assert.match(text, /2 commit\(s\) in x\/y: First commit, \.\.\./);
  assert.match(text, /1 commit\(s\) in x\/z: Only commit(?!, \.\.\.)/);
});

test('draftStandup includes a Reviews section only when reviews exist', () => {
  const withReviews = draftStandup({
    user: 'juan',
    pullRequests: [],
    reviews: [{ title: 'Review this', url: 'https://github.com/x/y/pull/3', repo: 'x/y' }],
    commits: [],
  });
  assert.match(withReviews, /\*Reviews:\*/);
  assert.match(withReviews, /Reviewed <https:\/\/github\.com\/x\/y\/pull\/3\|Review this> \(x\/y\)/);

  const withoutReviews = draftStandup({ user: 'juan', pullRequests: [], reviews: [], commits: [] });
  assert.doesNotMatch(withoutReviews, /\*Reviews:\*/);
});

test('draftStandup groups a ticket with a PR into a key line, PR link, and description', () => {
  const text = draftStandup({
    user: 'juan',
    pullRequests: [],
    reviews: [],
    commits: [],
    tickets: [
      {
        key: 'KAN-4',
        prs: [
          {
            title: 'KAN-4: Add a live character counter',
            url: 'https://github.com/x/y/pull/1',
            repo: 'x/y',
          },
        ],
        commits: [],
      },
    ],
  });
  assert.match(text, /- \*KAN-4\*\n/);
  assert.match(text, /- PR: <https:\/\/github\.com\/x\/y\/pull\/1\|KAN-4: Add a live character counter>/);
  assert.match(text, /- Add a live character counter\n/);
});

test('draftStandup falls back to a commit when a ticket has no PR', () => {
  const text = draftStandup({
    user: 'juan',
    pullRequests: [],
    reviews: [],
    commits: [],
    tickets: [
      {
        key: 'ADR-005',
        prs: [],
        commits: [{ message: 'ADR-005 refine resume export', repo: 'x/y', url: 'https://github.com/x/y/commit/abc' }],
      },
    ],
  });
  assert.match(text, /- Commit: <https:\/\/github\.com\/x\/y\/commit\/abc\|x\/y>/);
  assert.match(text, /- Refine resume export/);
});

test('draftStandup strips conventional-commit prefixes and capitalizes the result', () => {
  const text = draftStandup({
    user: 'juan',
    pullRequests: [],
    reviews: [],
    commits: [],
    tickets: [
      {
        key: 'ADR-005',
        prs: [],
        commits: [
          {
            message: 'ADR-005 fix: make dark mode the unconditional default, not OS-dependent',
            repo: 'x/y',
            url: 'https://github.com/x/y/commit/abc',
          },
        ],
      },
    ],
  });
  assert.match(text, /- Make dark mode the unconditional default, not OS-dependent\n/);
  assert.doesNotMatch(text, /fix:/);
});

test('draftStandup strips conventional-commit prefixes from untracked commit summaries too', () => {
  const text = draftStandup({
    user: 'juan',
    pullRequests: [],
    reviews: [],
    commits: [{ message: 'feat: add real resume.pdf and its generator script', repo: 'x/y' }],
  });
  assert.match(text, /1 commit\(s\) in x\/y: Add real resume\.pdf and its generator script/);
});

test('draftStandup appends the Jira status next to the ticket key when present', () => {
  const text = draftStandup({
    user: 'juan',
    pullRequests: [],
    reviews: [],
    commits: [],
    tickets: [{ key: 'KAN-4', prs: [], commits: [], jira: { status: 'In QA', summary: 'Add counter' } }],
  });
  assert.match(text, /- \*KAN-4\* — In QA/);
});

test('draftStandup still lists untracked PRs/commits alongside grouped tickets', () => {
  const text = draftStandup({
    user: 'juan',
    pullRequests: [{ title: 'Unrelated fix', url: 'https://github.com/x/y/pull/9', repo: 'x/y' }],
    reviews: [],
    commits: [],
    tickets: [{ key: 'KAN-4', prs: [{ title: 'KAN-4: Thing', url: 'https://github.com/x/y/pull/1', repo: 'x/y' }], commits: [] }],
  });
  assert.match(text, /\*KAN-4\*/);
  assert.match(text, /Opened\/updated PR: <https:\/\/github\.com\/x\/y\/pull\/9\|Unrelated fix>/);
});

test('draftStandup always ends with Today and Blockers sections', () => {
  const text = draftStandup({ user: 'juan', pullRequests: [], reviews: [], commits: [] });
  assert.match(text, /\*Today:\*\n- \n\n\*Blockers:\*\n- None$/);
});
