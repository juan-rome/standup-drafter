const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const store = require('./lib/store');
const github = require('./lib/github');
const slack = require('./lib/slack');
const jira = require('./lib/jira');
const { draftStandup } = require('./lib/draft');

let tray;
let popover;

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray-icon.png'));
  icon.addRepresentation({
    scaleFactor: 2,
    buffer: fs.readFileSync(path.join(__dirname, 'assets', 'tray-icon@2x.png')),
  });
  icon.setTemplateImage(true);

  tray = new Tray(icon);
  tray.setToolTip('Standup Drafter');

  tray.on('click', toggleWindow);
  tray.on('right-click', () => tray.popUpContextMenu(buildContextMenu()));
}

function buildContextMenu() {
  return Menu.buildFromTemplate([
    { label: 'Open', click: showWindow },
    { type: 'separator' },
    {
      label: 'Sign Out',
      click: () => {
        store.clear();
        popover.webContents.send('signed-out');
      },
    },
    { type: 'separator' },
    { label: 'Quit Standup Drafter', click: () => app.quit() },
  ]);
}

const POPOVER_WIDTH = 340;

function createPopover() {
  popover = new BrowserWindow({
    width: POPOVER_WIDTH,
    height: 140,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: true,
    backgroundColor: '#00000000',
    vibrancy: 'popover',
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  popover.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  popover.on('blur', () => popover.hide());
}

function getWindowPosition() {
  const trayBounds = tray.getBounds();
  const windowBounds = popover.getBounds();
  const x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2);
  const y = Math.round(trayBounds.y + trayBounds.height + 4);
  return { x, y };
}

function showWindow() {
  const { x, y } = getWindowPosition();
  popover.setPosition(x, y, false);
  popover.show();
  popover.focus();
}

function toggleWindow() {
  if (popover.isVisible()) {
    popover.hide();
  } else {
    showWindow();
  }
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock.hide();
  createTray();
  createPopover();
});

app.on('window-all-closed', (event) => {
  event.preventDefault();
});

ipcMain.handle('auth:status', () => ({
  github: github.isAuthenticated(),
  slack: slack.isAuthenticated(),
  jira: jira.isAuthenticated(),
}));

ipcMain.handle('github:requestCode', async () => {
  const data = await github.requestDeviceCode();
  shell.openExternal(data.verification_uri);
  return data;
});

ipcMain.handle('github:poll', async (_event, { deviceCode, interval, expiresIn }) => {
  return github.pollForToken(deviceCode, interval, expiresIn);
});

ipcMain.handle('slack:connect', async (_event, token) => {
  return slack.saveToken(token);
});

ipcMain.handle('slack:channels', async () => {
  return slack.listChannels();
});

ipcMain.handle('jira:connect', async (_event, { baseUrl, email, apiToken }) => {
  return jira.saveCredentials(baseUrl, email, apiToken);
});

ipcMain.handle('standup:generate', async () => {
  const activity = await github.getYesterdayActivity();

  if (jira.isAuthenticated() && activity.ticketKeys.length > 0) {
    try {
      const statuses = await jira.fetchTicketStatuses(activity.ticketKeys);
      activity.tickets.forEach((ticket) => {
        if (statuses[ticket.key]) ticket.jira = statuses[ticket.key];
      });
    } catch {
      // Jira enrichment is best-effort — a failed lookup shouldn't block the standup.
    }
  }

  return draftStandup(activity);
});

ipcMain.handle('standup:post', async (_event, { channel, text, channelName }) => {
  const result = await slack.postMessage(channel, text);
  new Notification({
    title: 'Standup update sent ✅',
    body: `Posted to ${channelName || 'Slack'}. Have a great day!`,
  }).show();
  return result;
});

ipcMain.handle('app:signOut', async () => {
  store.clear();
  return true;
});

ipcMain.handle('app:quit', () => {
  app.quit();
});

ipcMain.handle('app:getLaunchAtLogin', () => app.getLoginItemSettings().openAtLogin);

ipcMain.handle('app:setLaunchAtLogin', (_event, enabled) => {
  app.setLoginItemSettings({ openAtLogin: enabled });
  return true;
});

ipcMain.on('popover:resize', (_event, contentHeight) => {
  if (!popover) return;
  const height = Math.round(Math.max(120, Math.min(700, contentHeight)));
  popover.setContentSize(POPOVER_WIDTH, height, false);
});
