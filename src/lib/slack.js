const store = require('./store');

const API_URL = 'https://slack.com/api';

function isAuthenticated() {
  return Boolean(store.get('slackToken'));
}

async function call(method, body) {
  const token = store.get('slackToken');
  const res = await fetch(`${API_URL}/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack API error: ${data.error}`);
  return data;
}

async function saveToken(token) {
  const res = await fetch(`${API_URL}/auth.test`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!data.ok) return { success: false, error: data.error };
  store.set('slackToken', token);
  return { success: true, team: data.team, user: data.user };
}

// Pure transform, kept separate from the network call so it's unit testable.
function filterMemberChannels(channels) {
  return channels.filter((c) => c.is_member).map((c) => ({ id: c.id, name: c.name }));
}

async function listChannels() {
  const data = await call('conversations.list', null);
  return filterMemberChannels(data.channels);
}

async function postMessage(channel, text) {
  await call('chat.postMessage', { channel, text });
  return { success: true };
}

module.exports = { isAuthenticated, saveToken, listChannels, postMessage, filterMemberChannels };
