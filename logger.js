// logger.js - 日志系统
const fs = require('fs');
const path = require('path');
const { ensureDir } = require('./utils');

const LOG_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');

ensureDir(LOG_DIR);

function formatTimestamp() {
  return new Date().toISOString();
}

function formatMessage(level, message, data = null) {
  const timestamp = formatTimestamp();
  const base = `[${timestamp}] [${level}] ${message}`;
  return data ? `${base} ${JSON.stringify(data)}` : base;
}

function writeToFile(message) {
  try {
    fs.appendFileSync(LOG_FILE, message + '\n', 'utf8');
  } catch (e) {
    console.error('写入日志文件失败:', e.message);
  }
}

function log(level, message, data = null) {
  const formatted = formatMessage(level, message, data);
  
  switch (level) {
    case 'ERROR':
      console.error(formatted);
      break;
    case 'WARN':
      console.warn(formatted);
      break;
    default:
      console.log(formatted);
  }

  writeToFile(formatted);
}

module.exports = {
  info: (message, data) => log('INFO', message, data),
  warn: (message, data) => log('WARN', message, data),
  error: (message, data) => log('ERROR', message, data),
  debug: (message, data) => {
    if (process.env.DEBUG) {
      log('DEBUG', message, data);
    }
  }
};
