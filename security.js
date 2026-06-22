// security.js - Security middleware
const crypto = require('crypto');
const hooks = require('./hooks');

const API_KEYS = new Set();
const RATE_LIMIT_MAP = new Map();
const RATE_LIMIT_WINDOW = Number(process.env.RATE_LIMIT_WINDOW_MS || 60 * 1000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 100);
const RATE_LIMIT_CLEANUP_INTERVAL = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [ip, limit] of RATE_LIMIT_MAP) {
    if (now > limit.resetTime) RATE_LIMIT_MAP.delete(ip);
  }
}, RATE_LIMIT_CLEANUP_INTERVAL).unref?.();

function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

function loadApiKeys() {
  const envKeys = process.env.API_KEYS;
  if (envKeys) {
    envKeys.split(',').forEach(key => {
      const trimmed = key.trim();
      if (trimmed) API_KEYS.add(trimmed);
    });
  }

  if (API_KEYS.size === 0) {
    const defaultKey = generateApiKey();
    API_KEYS.add(defaultKey);
    console.log(`\nWARNING: API_KEYS is not configured. Temporary key: ${defaultKey}`);
    console.log('Set API_KEYS in your environment before production use.\n');
  }
}

loadApiKeys();

function apiKeyAuth(req, res, next) {
  if (process.env.DISABLE_AUTH === 'true') return next();

  // 本地请求自动豁免认证（前端页面和本地调试）
  const ip = req.ip || req.connection?.remoteAddress || '';
  const isLocal = ['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost'].some(h => ip.includes(h));
  if (isLocal && !req.headers.authorization && !req.query.api_key && !req.headers['x-api-key']) {
    return next();
  }

  const authHeader = req.headers.authorization || '';
  const bearerKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const apiKey = req.query.api_key || bearerKey || req.headers['x-api-key'];

  if (!apiKey || !API_KEYS.has(String(apiKey))) {
    hooks.emitDetached?.(hooks.API_EVENTS.AUTH_FAILURE, { ip: req.ip, url: req.url });
    return res.status(401).json({ error: 'Unauthorized: valid API key required' });
  }

  return next();
}

function rateLimit(req, res, next) {
  if (process.env.DISABLE_RATE_LIMIT === 'true') return next();

  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();

  if (!RATE_LIMIT_MAP.has(ip)) {
    RATE_LIMIT_MAP.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }

  const limit = RATE_LIMIT_MAP.get(ip);
  if (now > limit.resetTime) {
    limit.count = 1;
    limit.resetTime = now + RATE_LIMIT_WINDOW;
    return next();
  }

  limit.count += 1;
  if (limit.count > RATE_LIMIT_MAX) {
    hooks.emitDetached?.(hooks.API_EVENTS.RATE_LIMITED, { ip, url: req.url });
    return res.status(429).json({ error: 'Too many requests. Try again later.' });
  }

  return next();
}

function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// Do not mutate prompts in JSON APIs. Escaping belongs at HTML render time,
// otherwise code snippets, URLs, slashes and quotes are corrupted before AI use.
function sanitizeBody(req, res, next) {
  return next();
}

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  next();
}

module.exports = {
  apiKeyAuth,
  rateLimit,
  sanitizeBody,
  securityHeaders,
  generateApiKey,
  escapeHtml
};
