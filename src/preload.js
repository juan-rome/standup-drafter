const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  authStatus: () => ipcRenderer.invoke('auth:status'),
  requestGithubCode: () => ipcRenderer.invoke('github:requestCode'),
  pollGithub: (deviceCode, interval, expiresIn) =>
    ipcRenderer.invoke('github:poll', { deviceCode, interval, expiresIn }),
  connectSlack: (token) => ipcRenderer.invoke('slack:connect', token),
  listSlackChannels: () => ipcRenderer.invoke('slack:channels'),
  connectJira: (baseUrl, email, apiToken) =>
    ipcRenderer.invoke('jira:connect', { baseUrl, email, apiToken }),
  generateStandup: () => ipcRenderer.invoke('standup:generate'),
  postStandup: (channel, text, channelName) =>
    ipcRenderer.invoke('standup:post', { channel, text, channelName }),
  signOut: () => ipcRenderer.invoke('app:signOut'),
  quit: () => ipcRenderer.invoke('app:quit'),
  getLaunchAtLogin: () => ipcRenderer.invoke('app:getLaunchAtLogin'),
  setLaunchAtLogin: (enabled) => ipcRenderer.invoke('app:setLaunchAtLogin', enabled),
  resizeWindow: (height) => ipcRenderer.send('popover:resize', height),
  onSignedOut: (callback) => ipcRenderer.on('signed-out', callback),
});
