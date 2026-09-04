const githubStatus = document.getElementById('githubStatus');
const githubConnectBtn = document.getElementById('githubConnectBtn');
const githubCode = document.getElementById('githubCode');
const githubCodeValue = document.getElementById('githubCodeValue');

const slackStatus = document.getElementById('slackStatus');
const slackConnectBtn = document.getElementById('slackConnectBtn');
const slackTokenRow = document.getElementById('slackTokenRow');
const slackTokenInput = document.getElementById('slackTokenInput');
const slackTokenSubmit = document.getElementById('slackTokenSubmit');

const draftSection = document.getElementById('draftSection');
const emptyHint = document.getElementById('emptyHint');
const generateBtn = document.getElementById('generateBtn');
const draftText = document.getElementById('draftText');
const channelSelect = document.getElementById('channelSelect');
const postBtn = document.getElementById('postBtn');
const toast = document.getElementById('toast');

const menuBtn = document.getElementById('menuBtn');
const menuDropdown = document.getElementById('menuDropdown');
const launchAtLoginToggle = document.getElementById('launchAtLoginToggle');
const signOutBtn = document.getElementById('signOutBtn');
const quitBtn = document.getElementById('quitBtn');

const LAST_CHANNEL_KEY = 'standup-drafter:lastChannel';

let toastTimer;
function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add('show'));

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.hidden = true;
    }, 250);
  }, 3000);
}

function setBadge(el, connected, label) {
  el.classList.toggle('badge-on', connected);
  el.classList.toggle('badge-off', !connected);
  el.innerHTML = `<span class="badge-dot"></span>${label}`;
}

async function refreshStatus() {
  const status = await window.api.authStatus();

  setBadge(githubStatus, status.github, status.github ? 'Connected' : 'Not connected');
  githubConnectBtn.hidden = status.github;

  setBadge(slackStatus, status.slack, status.slack ? 'Connected' : 'Not connected');
  slackConnectBtn.hidden = status.slack;
  if (status.slack) slackTokenRow.hidden = true;

  const ready = status.github && status.slack;
  draftSection.hidden = !ready;
  emptyHint.hidden = ready;

  if (ready) {
    const channels = await window.api.listSlackChannels();
    channelSelect.innerHTML = channels
      .map((c) => `<option value="${c.id}">#${c.name}</option>`)
      .join('');

    const lastChannel = localStorage.getItem(LAST_CHANNEL_KEY);
    if (lastChannel && channels.some((c) => c.id === lastChannel)) {
      channelSelect.value = lastChannel;
    }
  }
}

menuBtn.addEventListener('click', async (e) => {
  e.stopPropagation();
  const opening = menuDropdown.hidden;
  menuDropdown.hidden = !menuDropdown.hidden;
  if (opening) {
    launchAtLoginToggle.checked = await window.api.getLaunchAtLogin();
  }
});

launchAtLoginToggle.addEventListener('click', (e) => e.stopPropagation());
launchAtLoginToggle.addEventListener('change', () => {
  window.api.setLaunchAtLogin(launchAtLoginToggle.checked);
});

document.addEventListener('click', () => {
  menuDropdown.hidden = true;
});

githubConnectBtn.addEventListener('click', async () => {
  githubConnectBtn.disabled = true;
  const data = await window.api.requestGithubCode();
  githubCodeValue.textContent = data.user_code;
  githubCode.hidden = false;

  const result = await window.api.pollGithub(data.device_code, data.interval, data.expires_in);
  githubCode.hidden = true;
  githubConnectBtn.disabled = false;

  if (result.success) {
    await refreshStatus();
  } else {
    setBadge(githubStatus, false, `Failed: ${result.error}`);
  }
});

slackConnectBtn.addEventListener('click', () => {
  slackTokenRow.hidden = !slackTokenRow.hidden;
  if (!slackTokenRow.hidden) slackTokenInput.focus();
});

slackTokenSubmit.addEventListener('click', async () => {
  const token = slackTokenInput.value.trim();
  if (!token) return;
  slackTokenSubmit.disabled = true;
  const result = await window.api.connectSlack(token);
  slackTokenSubmit.disabled = false;

  if (result.success) {
    slackTokenInput.value = '';
    await refreshStatus();
  } else {
    setBadge(slackStatus, false, `Failed: ${result.error}`);
  }
});

generateBtn.addEventListener('click', async () => {
  generateBtn.disabled = true;
  generateBtn.textContent = 'Pulling activity...';
  try {
    draftText.value = await window.api.generateStandup();
  } catch (err) {
    showToast(`Error: ${err.message}`, true);
  }
  generateBtn.disabled = false;
  generateBtn.textContent = "Pull yesterday's GitHub activity";
});

postBtn.addEventListener('click', async () => {
  const channel = channelSelect.value;
  const channelName = channelSelect.options[channelSelect.selectedIndex]?.textContent;
  const text = draftText.value.trim();
  if (!channel || !text) return;
  postBtn.disabled = true;
  try {
    await window.api.postStandup(channel, text, channelName);
    localStorage.setItem(LAST_CHANNEL_KEY, channel);
    draftText.value = '';
    showToast('Standup update sent ✅ Have a great day!');
  } catch (err) {
    showToast(`Error: ${err.message}`, true);
  }
  postBtn.disabled = false;
});

signOutBtn.addEventListener('click', async () => {
  await window.api.signOut();
  await refreshStatus();
});

quitBtn.addEventListener('click', () => {
  window.api.quit();
});

window.api.onSignedOut(() => refreshStatus());

// Keep the window sized to its actual content instead of a fixed height,
// so it doesn't leave dead space when sections are hidden/shown.
const panel = document.querySelector('.panel');
function reportSize() {
  window.api.resizeWindow(document.documentElement.scrollHeight);
}
new ResizeObserver(reportSize).observe(panel);

refreshStatus().then(reportSize);
