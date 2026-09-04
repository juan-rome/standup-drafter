const { test } = require('node:test');
const assert = require('node:assert/strict');
const { filterMemberChannels } = require('../src/lib/slack');

test('filterMemberChannels keeps only channels the bot has joined', () => {
  const channels = [
    { id: 'C1', name: 'general', is_member: true },
    { id: 'C2', name: 'random', is_member: false },
    { id: 'C3', name: 'standup', is_member: true },
  ];
  assert.deepEqual(filterMemberChannels(channels), [
    { id: 'C1', name: 'general' },
    { id: 'C3', name: 'standup' },
  ]);
});

test('filterMemberChannels returns an empty list when the bot has joined nothing', () => {
  assert.deepEqual(filterMemberChannels([{ id: 'C1', name: 'general', is_member: false }]), []);
});
