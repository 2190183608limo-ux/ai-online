// google-auth.js - Google Drive 授权（支持 Service Account 和 OAuth）
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const CREDENTIALS_PATH = process.env.GOOGLE_CREDENTIALS_PATH || path.join(__dirname, 'credentials.json');
const TOKEN_PATH = process.env.GOOGLE_TOKEN_PATH || path.join(__dirname, 'token.json');
const SERVICE_ACCOUNT_PATH = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || path.join(__dirname, 'service-account.json');
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/google/callback';
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// ======== Service Account 方式（推荐，无需用户登录） ========

function getServiceAccountClient() {
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) return null;
  try {
    const key = readJson(SERVICE_ACCOUNT_PATH);
    return new google.auth.GoogleAuth({
      credentials: key,
      scopes: ['https://www.googleapis.com/auth/drive']
    });
  } catch (error) {
    console.error('Service Account 初始化失败:', error.message);
    return null;
  }
}

// ======== OAuth 方式（需要用户授权） ========

function getClientConfig() {
  if (!fs.existsSync(CREDENTIALS_PATH)) return null;
  try {
    const credentials = readJson(CREDENTIALS_PATH);
    const config = credentials.installed || credentials.web;
    if (!config || !config.client_id || !config.client_secret) return null;
    return config;
  } catch (_) { return null; }
}

function createOAuthClient() {
  const config = getClientConfig();
  if (!config) return null;
  return new google.auth.OAuth2(config.client_id, config.client_secret, REDIRECT_URI);
}

function loadAuthorizedClient() {
  const client = createOAuthClient();
  if (!client || !fs.existsSync(TOKEN_PATH)) return null;
  try {
    client.setCredentials(readJson(TOKEN_PATH));
    return client;
  } catch (_) { return null; }
}

function getAuthUrl() {
  const client = createOAuthClient();
  if (!client) throw new Error('找不到 OAuth 凭据文件 credentials.json');
  return client.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: SCOPES });
}

async function saveTokenFromCode(code) {
  const client = createOAuthClient();
  if (!client) throw new Error('找不到 OAuth 凭据文件');
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2), 'utf8');
  return getStatus();
}

// ======== 统一接口 ========

function getDriveClient() {
  // 优先使用 Service Account
  const saClient = getServiceAccountClient();
  if (saClient) return google.drive({ version: 'v3', auth: saClient });

  // 回退到 OAuth
  const oauthClient = loadAuthorizedClient();
  if (oauthClient) return google.drive({ version: 'v3', auth: oauthClient });

  throw new Error('Google Drive 未配置。请上传 service-account.json 或完成 OAuth 授权。');
}

function getStatus() {
  const saExists = fs.existsSync(SERVICE_ACCOUNT_PATH);
  const oauthAuthorized = !!loadAuthorizedClient();
  const credentialsExists = fs.existsSync(CREDENTIALS_PATH);
  const tokenExists = fs.existsSync(TOKEN_PATH);

  let authMethod = 'none';
  if (saExists) authMethod = 'service_account';
  else if (oauthAuthorized) authMethod = 'oauth';

  return {
    authorized: saExists || oauthAuthorized,
    authMethod,
    serviceAccount: {
      path: SERVICE_ACCOUNT_PATH,
      exists: saExists
    },
    oauth: {
      authorized: oauthAuthorized,
      credentialsPath: CREDENTIALS_PATH,
      credentialsExists,
      tokenPath: TOKEN_PATH,
      tokenExists,
      redirectUri: REDIRECT_URI
    }
  };
}

module.exports = {
  getAuthUrl,
  saveTokenFromCode,
  getStatus,
  getDriveClient
};
