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
  assert.match(text, /2 commit\(s\) in x\/y: first commit, \.\.\./);
  assert.match(text, /1 commit\(s\) in x\/z: only commit(?!, \.\.\.)/);
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

test('draftStandup always ends with Today and Blockers sections', () => {
  const text = draftStandup({ user: 'juan', pullRequests: [], reviews: [], commits: [] });
  assert.match(text, /\*Today:\*\n- \n\n\*Blockers:\*\n- None$/);
});
