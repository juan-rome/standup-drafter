const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeBaseUrl, parseTicketStatuses } = require('../src/lib/jira');

test('normalizeBaseUrl adds https:// when missing and strips trailing slashes', () => {
  assert.equal(normalizeBaseUrl('yourteam.atlassian.net'), 'https://yourteam.atlassian.net');
  assert.equal(normalizeBaseUrl('https://yourteam.atlassian.net/'), 'https://yourteam.atlassian.net');
  assert.equal(normalizeBaseUrl('http://localhost:8080//'), 'http://localhost:8080');
});

test('parseTicketStatuses maps a Jira search response into a key-indexed lookup', () => {
  const response = {
    issues: [
      { key: 'KAN-4', fields: { status: { name: 'In QA' }, summary: 'Add character counter' } },
      { key: 'ADR-005', fields: { status: { name: 'In Code Review' }, summary: 'Refine resume export' } },
    ],
  };
  assert.deepEqual(parseTicketStatuses(response), {
    'KAN-4': { status: 'In QA', summary: 'Add character counter' },
    'ADR-005': { status: 'In Code Review', summary: 'Refine resume export' },
  });
});

test('parseTicketStatuses handles an empty result', () => {
  assert.deepEqual(parseTicketStatuses({ issues: [] }), {});
});
