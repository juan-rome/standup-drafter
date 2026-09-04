// Create a GitHub OAuth App at https://github.com/settings/developers,
// enable Device Flow under its settings, then paste the Client ID below.
// Device Flow client IDs are not secret and are safe to ship in a distributed app.
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'Ov23li3vnlyENMF2wtYg';

module.exports = { GITHUB_CLIENT_ID };
