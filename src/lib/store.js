const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');

function filePath() {
  return path.join(app.getPath('userData'), 'credentials.enc');
}

function load() {
  try {
    const raw = fs.readFileSync(filePath());
    if (!safeStorage.isEncryptionAvailable()) return {};
    const decrypted = safeStorage.decryptString(raw);
    return JSON.parse(decrypted);
  } catch {
    return {};
  }
}

function save(data) {
  const encrypted = safeStorage.encryptString(JSON.stringify(data));
  fs.writeFileSync(filePath(), encrypted);
}

function get(key) {
  return load()[key];
}

function set(key, value) {
  const data = load();
  data[key] = value;
  save(data);
}

function clear() {
  try {
    fs.unlinkSync(filePath());
  } catch {
    // nothing to remove
  }
}

module.exports = { get, set, clear };
