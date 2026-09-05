const store = require('./store');

function isAuthenticated() {
  return Boolean(store.get('jira'));
}

function normalizeBaseUrl(baseUrl) {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function authHeader({ email, apiToken }) {
  const encoded = Buffer.from(`${email}:${apiToken}`).toString('base64');
  return `Basic ${encoded}`;
}

async function saveCredentials(baseUrl, email, apiToken) {
  const normalized = normalizeBaseUrl(baseUrl);
  const credentials = { baseUrl: normalized, email, apiToken };

  const res = await fetch(`${normalized}/rest/api/3/myself`, {
    headers: { Authorization: authHeader(credentials), Accept: 'application/json' },
  });
  if (!res.ok) return { success: false, error: res.status === 401 ? 'invalid_credentials' : `http_${res.status}` };

  store.set('jira', credentials);
  return { success: true };
}

// Pure transform from a Jira /search response into { KEY: { status, summary } }.
// Kept free of network/store access so it can be unit tested directly.
function parseTicketStatuses(searchResponse) {
  const result = {};
  for (const issue of searchResponse.issues || []) {
    result[issue.key] = {
      status: issue.fields.status.name,
      summary: issue.fields.summary,
    };
  }
  return result;
}

async function fetchTicketStatuses(keys) {
  if (!keys || keys.length === 0) return {};
  const credentials = store.get('jira');
  if (!credentials) return {};

  const jql = `key in (${keys.join(',')})`;
  const url = `${credentials.baseUrl}/rest/api/3/search?jql=${encodeURIComponent(jql)}&fields=status,summary`;
  const res = await fetch(url, {
    headers: { Authorization: authHeader(credentials), Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Jira API request failed: ${res.status}`);

  return parseTicketStatuses(await res.json());
}

module.exports = { isAuthenticated, saveCredentials, fetchTicketStatuses, normalizeBaseUrl, parseTicketStatuses };
