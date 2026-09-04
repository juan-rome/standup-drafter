const store = require('./store');
const { GITHUB_CLIENT_ID } = require('./config');

const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';
const API_URL = 'https://api.github.com';
const SCOPE = 'repo read:user';

function isAuthenticated() {
  return Boolean(store.get('githubToken'));
}

async function requestDeviceCode() {
  const res = await fetch(DEVICE_CODE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: GITHUB_CLIENT_ID, scope: SCOPE }),
  });
  if (!res.ok) throw new Error(`GitHub device code request failed: ${res.status}`);
  return res.json();
}

async function pollForToken(deviceCode, intervalSeconds, expiresInSeconds) {
  const deadline = Date.now() + expiresInSeconds * 1000;
  let interval = intervalSeconds;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, interval * 1000));

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });
    const data = await res.json();

    if (data.access_token) {
      store.set('githubToken', data.access_token);
      return { success: true };
    }
    if (data.error === 'authorization_pending') continue;
    if (data.error === 'slow_down') {
      interval += 5;
      continue;
    }
    return { success: false, error: data.error || 'unknown_error' };
  }
  return { success: false, error: 'expired_token' };
}

async function apiRequest(endpoint) {
  const token = store.get('githubToken');
  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) throw new Error(`GitHub API request failed: ${res.status}`);
  return res.json();
}

function startOfYesterdayISO(now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

// Pure transform from raw GitHub search-API responses into our activity shape.
// Kept free of network/store access so it can be unit tested directly.
function parseActivity(login, authoredPRs, reviewedPRs, commits) {
  return {
    user: login,
    pullRequests: authoredPRs.items.map((pr) => ({
      title: pr.title,
      url: pr.html_url,
      repo: pr.repository_url.split('/').slice(-2).join('/'),
      state: pr.state,
    })),
    reviews: reviewedPRs.items.map((pr) => ({
      title: pr.title,
      url: pr.html_url,
      repo: pr.repository_url.split('/').slice(-2).join('/'),
    })),
    commits: commits.items.map((c) => ({
      message: c.commit.message.split('\n')[0],
      repo: c.repository.full_name,
      url: c.html_url,
    })),
  };
}

async function getYesterdayActivity() {
  const user = await apiRequest('/user');
  const since = startOfYesterdayISO();

  const [authoredPRs, reviewedPRs, commits] = await Promise.all([
    apiRequest(
      `/search/issues?q=${encodeURIComponent(
        `is:pr author:${user.login} updated:>=${since}`
      )}`
    ),
    apiRequest(
      `/search/issues?q=${encodeURIComponent(
        `is:pr reviewed-by:${user.login} updated:>=${since}`
      )}`
    ),
    apiRequest(
      `/search/commits?q=${encodeURIComponent(`author:${user.login} committer-date:>=${since}`)}`
    ),
  ]);

  return parseActivity(user.login, authoredPRs, reviewedPRs, commits);
}

module.exports = {
  isAuthenticated,
  requestDeviceCode,
  pollForToken,
  getYesterdayActivity,
  startOfYesterdayISO,
  parseActivity,
};
