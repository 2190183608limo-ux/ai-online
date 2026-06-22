// server.js - 主服务器（钩子增强版）
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const BrowserAutomation = require('./browser');
const database = require('./database');
const knowledge = require('./knowledge');
const googleAuth = require('./google-auth');
const logger = require('./logger');
const hooks = require('./hooks');
const answerService = require('./answer-service');
const {
  validateQuestion,
  validatePlatform,
  validatePlatformCreation,
  validateKnowledgeEntry,
  validatePagination
} = require('./validator');
const { apiKeyAuth, rateLimit, securityHeaders, sanitizeBody } = require('./security');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(securityHeaders);
app.use(rateLimit);
app.use(apiKeyAuth);
app.use(sanitizeBody);

// API 请求钩子中间件
app.use(async (req, res, next) => {
  const start = Date.now();
  req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  await hooks.emit(hooks.API_EVENTS.REQUEST_START, {
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    ip: req.ip
  });

  res.on('finish', async () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.url} ${res.statusCode} ${duration}ms`);

    await hooks.emit(hooks.API_EVENTS.REQUEST_END, {
      requestId: req.requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration
    });

    if (res.statusCode >= 500) {
      hooks.emit(hooks.API_EVENTS.SERVER_ERROR, {
        requestId: req.requestId,
        url: req.url,
        statusCode: res.statusCode
      });
    }
  });

  next();
});

let browser = null;
let currentConversationIds = {};

// ==================== 注册钩子 ====================

function registerHooks() {
  // 进程生命周期钩子
  hooks.on(hooks.PROCESS_EVENTS.STARTING, async (data) => {
    logger.info('进程启动中...', data);
  }, 10);

  hooks.on(hooks.PROCESS_EVENTS.STARTED, async (data) => {
    logger.info('进程已启动', data);
  }, 10);

  hooks.on(hooks.PROCESS_EVENTS.SHUTTING_DOWN, async (data) => {
    logger.info('进程关闭中...', data);
  }, 10);

  hooks.on(hooks.PROCESS_EVENTS.SHUTDOWN, async (data) => {
    logger.info('进程已关闭', data);
  }, 10);

  hooks.on(hooks.PROCESS_EVENTS.ERROR, async (data) => {
    logger.error('进程错误', data);
  }, 10);

  // 浏览器事件钩子
  hooks.on(hooks.BROWSER_EVENTS.LAUNCHING, async (data) => {
    logger.info('浏览器启动中...', data);
  });

  hooks.on(hooks.BROWSER_EVENTS.LAUNCHED, async (data) => {
    logger.info('浏览器已启动', data);
  });

  hooks.on(hooks.BROWSER_EVENTS.NAVIGATING, async (data) => {
    logger.info(`正在导航到 ${data.platformId}`, { url: data.url });
  });

  hooks.on(hooks.BROWSER_EVENTS.NAVIGATED, async (data) => {
    logger.info(`已导航到 ${data.platformId}`);
  });

  hooks.on(hooks.BROWSER_EVENTS.CAPTCHA_DETECTED, async (data) => {
    logger.warn('验证码检测', data);
  });

  hooks.on(hooks.BROWSER_EVENTS.CAPTCHA_RESOLVED, async (data) => {
    logger.info('验证码已解决', data);
  });

  hooks.on(hooks.BROWSER_EVENTS.LOGIN_REQUIRED, async (data) => {
    logger.warn(`${data.name} 需要登录`);
  });

  hooks.on(hooks.BROWSER_EVENTS.LOGIN_SUCCESS, async (data) => {
    logger.info(`${data.platformId} 登录成功`, { duration: data.duration });
  });

  hooks.on(hooks.BROWSER_EVENTS.QUESTION_SENT, async (data) => {
    logger.info(`问题已发送到 ${data.platformId}`, {
      question: data.question.substring(0, 30)
    });
  });

  hooks.on(hooks.BROWSER_EVENTS.RESPONSE_RECEIVED, async (data) => {
    logger.info(`收到 ${data.platformId} 的回答`, {
      length: data.length,
      duration: data.duration,
      partial: data.partial
    });
  });

  hooks.on(hooks.BROWSER_EVENTS.RESPONSE_TIMEOUT, async (data) => {
    logger.error(`${data.platformId} 响应超时`, { duration: data.duration });
  });

  hooks.on(hooks.BROWSER_EVENTS.PAGE_ERROR, async (data) => {
    logger.error('页面错误', data);
  });

  hooks.on(hooks.BROWSER_EVENTS.DIALOG, async (data) => {
    logger.warn('对话框出现', data);
  });

  hooks.on(hooks.BROWSER_EVENTS.CLOSED, async (data) => {
    if (data?.platformId) delete currentConversationIds[data.platformId];
    logger.warn('浏览器会话已关闭', data);
  });

  // 数据变更钩子
  hooks.on(hooks.DATA_EVENTS.QUESTION_SAVED, async (data) => {
    logger.debug('问题已保存', data);
  });

  hooks.on(hooks.DATA_EVENTS.RESPONSE_SAVED, async (data) => {
    logger.debug('回答已保存', data);
  });

  hooks.on(hooks.DATA_EVENTS.KNOWLEDGE_ADDED, async (data) => {
    logger.info('知识库新增条目', {
      platform: data.platform,
      question: data.question?.substring(0, 30)
    });
  });

  hooks.on(hooks.DATA_EVENTS.KNOWLEDGE_HIT, async (data) => {
    logger.info('知识库命中', {
      platform: data.platform,
      similarity: data.similarity
    });
  });

  hooks.on(hooks.DATA_EVENTS.KNOWLEDGE_DELETED, async (data) => {
    logger.info('知识库条目已删除', data);
  });

  hooks.on(hooks.DATA_EVENTS.CONVERSATION_STARTED, async (data) => {
    logger.debug('新对话已开始', data);
  });

  hooks.on(hooks.DATA_EVENTS.CONVERSATION_ENDED, async (data) => {
    logger.debug('对话已结束', data);
  });

  // API 事件钩子
  hooks.on(hooks.API_EVENTS.AUTH_FAILURE, async (data) => {
    logger.warn('认证失败', data);
  });

  hooks.on(hooks.API_EVENTS.RATE_LIMITED, async (data) => {
    logger.warn('请求被限流', data);
  });

  hooks.on(hooks.API_EVENTS.VALIDATION_ERROR, async (data) => {
    logger.warn('验证错误', data);
  });
}

async function initBrowser() {
  browser = new BrowserAutomation();
  await browser.launch();
  logger.info('浏览器管理器已就绪，等待用户请求时按需打开平台');
}

function requireBrowser(res) {
  if (browser) return true;
  res.status(500).json({ error: '系统未初始化' });
  return false;
}

function requireKnownPlatform(platform, res) {
  if (!requireBrowser(res)) return false;
  if (browser.hasPlatform(platform)) return true;
  res.status(404).json({ error: `未知平台: ${platform}` });
  return false;
}

function validatePlatformArray(platforms, res) {
  if (!Array.isArray(platforms) || platforms.length === 0) {
    res.status(400).json({ error: 'platforms must be a non-empty array' });
    return null;
  }

  const normalized = [];
  const seen = new Set();
  for (const platform of platforms) {
    if (typeof platform !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(platform)) {
      res.status(400).json({ error: 'Platform IDs can only contain letters, numbers, underscores and hyphens' });
      return null;
    }
    if (!browser.hasPlatform(platform)) {
      res.status(404).json({ error: `未知平台: ${platform}` });
      return null;
    }
    if (!seen.has(platform)) {
      seen.add(platform);
      normalized.push(platform);
    }
  }

  return normalized;
}

function handleRouteError(res, error, fallbackMessage = null) {
  const statusCode = error?.recoverable ? 503 : 500;
  const payload = {
    error: fallbackMessage || error.message,
    recoverable: !!error?.recoverable,
    code: error?.code || null
  };
  res.status(statusCode).json(payload);
}

// ==================== Google Drive 授权 API ====================

app.get('/api/google/status', (req, res) => {
  res.json(googleAuth.getStatus());
});

app.get('/api/google/auth-url', (req, res) => {
  try {
    res.json({ success: true, url: googleAuth.getAuthUrl(), status: googleAuth.getStatus() });
  } catch (error) {
    logger.error('获取 Google 授权链接失败', { error: error.message });
    res.status(500).json({ success: false, error: error.message, status: googleAuth.getStatus() });
  }
});

app.get('/api/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send('缺少 Google 授权 code');

    await googleAuth.saveTokenFromCode(code);
    logger.info('Google Drive 授权成功');
    res.send('Google Drive 授权成功，可以关闭此页面并回到 AI 对比系统。');
  } catch (error) {
    logger.error('Google Drive 授权失败', { error: error.message });
    res.status(500).send(`Google Drive 授权失败: ${error.message}`);
  }
});

app.post('/api/google/upload-sa', (req, res) => {
  try {
    const { credentials } = req.body;
    if (!credentials || credentials.type !== 'service_account') {
      return res.status(400).json({ error: '请提供有效的 Service Account JSON' });
    }

    const saPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || path.join(__dirname, 'service-account.json');
    fs.writeFileSync(saPath, JSON.stringify(credentials, null, 2), 'utf8');

    logger.info('Service Account 已上传', { email: credentials.client_email });
    res.json({
      success: true,
      message: 'Service Account 已保存',
      email: credentials.client_email,
      note: '请将此邮箱添加到 Google Drive 文件夹的共享权限中，然后切换存储模式到 Google Drive'
    });
  } catch (error) {
    logger.error('上传 Service Account 失败', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});


// ==================== 平台管理 API ====================

app.get('/api/platforms', (req, res) => {
  if (!requireBrowser(res)) return;
  res.json(browser.platforms);
});

app.post('/api/platforms', validatePlatformCreation, (req, res) => {
  try {
    const {
      id,
      name,
      url,
      inputSelector,
      responseSelector,
      loadingSelector,
      stopSelector,
      submitSelector,
      modeSelector,
      newConversationSelector,
      captchaIndicators
    } = req.body;

    if (!requireBrowser(res)) return;

    const success = browser.addPlatform(id, {
      name,
      url,
      inputSelector,
      responseSelector,
      loadingSelector,
      stopSelector,
      submitSelector,
      modeSelector,
      newConversationSelector,
      captchaIndicators
    });

    if (success) {
      logger.info(`平台 ${name} 已添加`, { id });
      res.json({ success: true, message: `平台 ${name} 已添加` });
    } else {
      res.status(500).json({ error: '添加失败' });
    }
  } catch (error) {
    logger.error('添加平台失败', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/platform-status', (req, res) => {
  if (!requireBrowser(res)) return;
  res.json(browser.getAllPlatformStatus());
});

app.get('/api/platform-status/:platform', (req, res) => {
  const { platform } = req.params;
  if (!requireKnownPlatform(platform, res)) return;
  res.json(browser.getPlatformStatus(platform));
});

app.delete('/api/platforms/:id', (req, res) => {
  try {
    if (!requireBrowser(res)) return;

    const success = browser.removePlatform(req.params.id);
    if (success) {
      logger.info(`平台 ${req.params.id} 已删除`);
      res.json({ success: true, message: '平台已删除' });
    } else {
      res.status(404).json({ error: '平台不存在' });
    }
  } catch (error) {
    logger.error('删除平台失败', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ==================== 提问 API ====================

app.post('/api/ask-all', validateQuestion, async (req, res) => {
  try {
    const { question, newConversation = true } = req.body;

    if (!requireBrowser(res)) return;
    const platforms = validatePlatformArray(req.body.platforms || ['deepseek', 'chatgpt', 'claude'], res);
    if (!platforms) return;

    logger.info(`并行提问: "${question.substring(0, 30)}..."`, { platforms });

    const aiResults = await Promise.all(platforms.map(platformId => {
      return answerService.answerQuestion({ browser, platform: platformId, question, newConversation })
        .then(result => ({ platformId, ...result }))
        .catch(error => {
          logger.error(`[${platformId}] 提问失败`, { error: error.message });
          return { platformId, error: error.message, recoverable: !!error.recoverable, code: error.code || null };
        });
    }));

    const allResults = {};
    for (const r of aiResults) allResults[r.platformId] = r;

    res.json({
      success: true,
      question,
      results: allResults
    });

  } catch (error) {
    logger.error('并行提问失败', { error: error.message });
    handleRouteError(res, error);
  }
});

app.post('/api/ask', validateQuestion, validatePlatform, async (req, res) => {
  try {
    const { question, platform = 'deepseek', newConversation = true, mode = null } = req.body;

    if (!requireKnownPlatform(platform, res)) return;

    logger.info(`question received: ${question.substring(0, 50)}...`, { platform });

    if (newConversation) {
      currentConversationIds[platform] = `conv_${Date.now()}`;
    }

    const { id: questionId, conversation_id } = database.saveQuestion(question, currentConversationIds[platform]);
    currentConversationIds[platform] = conversation_id;

    await hooks.emit(hooks.DATA_EVENTS.QUESTION_SAVED, { questionId, question });

    if (!browser.isLoggedIn(platform)) {
      try { await browser.navigateTo(platform); } catch (_) {}
      return res.status(401).json({
        success: false, needLogin: true, platform,
        message: `${browser.platforms[platform]?.name || platform} needs login, call /api/confirm-login/${platform}`,
        confirmUrl: `/api/confirm-login/${platform}`
      });
    }

    const result = await answerService.answerQuestion({ browser, platform, question, newConversation, mode });

    database.saveResponse(questionId, platform, result.response);

    await hooks.emit(hooks.DATA_EVENTS.RESPONSE_SAVED, { questionId, platform });

    res.json({
      success: true,
      fromKnowledge: false,
      questionId,
      conversation_id,
      platform,
      ...result
    });

  } catch (error) {
    logger.error('提问失败', { error: error.message });
    handleRouteError(res, error);
  }
});

app.post('/api/ask-retry', validateQuestion, validatePlatform, async (req, res) => {
  try {
    const { question, platform = 'deepseek', newConversation = true, mode = null } = req.body;

    if (!requireKnownPlatform(platform, res)) return;

    logger.info(`[retry] bypassing knowledge index: ${question.substring(0, 50)}...`, { platform });

    if (newConversation) {
      currentConversationIds[platform] = `conv_${Date.now()}`;
    }

    const { id: questionId, conversation_id } = database.saveQuestion(question, currentConversationIds[platform]);
    currentConversationIds[platform] = conversation_id;

    await hooks.emit(hooks.DATA_EVENTS.QUESTION_SAVED, { questionId, question });

    const result = await browser.askQuestion(platform, question, { newConversation, mode });

    database.saveResponse(questionId, platform, result.response);

    await hooks.emit(hooks.DATA_EVENTS.RESPONSE_SAVED, { questionId, platform });

    res.json({
      success: true,
      fromKnowledge: false,
      questionId,
      conversation_id,
      platform,
      ...result
    });

  } catch (error) {
    logger.error('retry 提问失败', { error: error.message });
    handleRouteError(res, error);
  }
});


app.post('/api/continue', validateQuestion, validatePlatform, async (req, res) => {
  try {
    const { question, platform = 'deepseek' } = req.body;

    if (!requireKnownPlatform(platform, res)) return;

    logger.info(`follow-up question: ${question.substring(0, 50)}...`, { platform });

    if (!currentConversationIds[platform]) {
      currentConversationIds[platform] = `conv_${Date.now()}`;
    }

    const { id: questionId, conversation_id } = database.saveQuestion(question, currentConversationIds[platform]);
    const result = await answerService.continueQuestion({ browser, platform, question });
    database.saveResponse(questionId, platform, result.response);

    await hooks.emit(hooks.DATA_EVENTS.QUESTION_SAVED, { questionId, question });
    await hooks.emit(hooks.DATA_EVENTS.RESPONSE_SAVED, { questionId, platform });

    res.json({
      success: true,
      fromKnowledge: false,
      questionId,
      conversation_id,
      platform,
      ...result
    });

  } catch (error) {
    logger.error('追问失败', { error: error.message });
    handleRouteError(res, error);
  }
});

app.post('/api/new-conversation', validatePlatform, async (req, res) => {
  try {
    const { platform = 'deepseek' } = req.body;
    if (!requireKnownPlatform(platform, res)) return;

    await browser.startNewConversation(platform);
    browser.endConversation(platform);
    delete currentConversationIds[platform];

    logger.info(`新对话已开始`, { platform });
    res.json({ success: true, message: '新对话已开始' });

  } catch (error) {
    logger.error('新建对话失败', { error: error.message });
    handleRouteError(res, error);
  }
});

app.post('/api/switch-platform', validatePlatform, async (req, res) => {
  try {
    const { platform } = req.body;
    if (!requireKnownPlatform(platform, res)) return;

    await browser.navigateTo(platform);
    browser.endConversation(platform);

    logger.info(`已切换到 ${platform}`);
    res.json({ success: true, message: `已切换到 ${platform}` });

  } catch (error) {
    logger.error('切换平台失败', { error: error.message });
    handleRouteError(res, error);
  }
});

// ==================== 登录确认 API ====================

app.post('/api/open-platform/:platform', async (req, res) => {
  try {
    const { platform } = req.params;
    if (!requireKnownPlatform(platform, res)) return;

    await browser.navigateTo(platform);
    logger.info(`[${platform}] 平台已打开，请在浏览器中登录`);
    res.json({ success: true, message: `${platform} 已打开，请在浏览器中登录`, status: browser.getPlatformStatus(platform) });
  } catch (error) {
    logger.error(`打开平台失败`, { error: error.message });
    handleRouteError(res, error);
  }
});

app.post('/api/confirm-login/:platform', (req, res) => {
  const { platform } = req.params;
  if (!requireKnownPlatform(platform, res)) return;

  browser.confirmLogin(platform);
  logger.info(`[${platform}] 登录已确认`);
  res.json({ success: true, message: `${platform} 登录已确认`, status: browser.getPlatformStatus(platform) });
});

app.get('/api/login-status', (req, res) => {
  if (!requireBrowser(res)) return;

  const status = {};
  for (const platformId of Object.keys(browser.platforms)) {
    status[platformId] = browser.isLoggedIn(platformId);
  }
  res.json(status);
});

// ==================== 数据 API ====================

app.get('/api/conversation/:id', (req, res) => {
  const conversation = database.getFullConversation(req.params.id);
  res.json(conversation);
});

app.get('/api/conversations/:conversationId/history', (req, res) => {
  const history = database.getConversationHistory(req.params.conversationId);
  res.json(history);
});

app.get('/api/conversations', validatePagination, (req, res) => {
  const conversations = database.getConversations(req.query.limit);
  res.json(conversations);
});


app.delete('/api/conversations/:conversationId', (req, res) => {
  try {
    const { conversationId } = req.params;
    const success = database.deleteConversation(conversationId);
    if (success) {
      logger.info('对话已删除', { conversationId });
      res.json({ success: true, message: '对话已删除' });
    } else {
      res.status(404).json({ error: '对话不存在' });
    }
  } catch (error) {
    logger.error('删除对话失败', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});


app.get('/api/questions', validatePagination, (req, res) => {
  const questions = database.getRecentQuestions(req.query.limit);
  res.json(questions);
});

// ==================== 知识库 API ====================

function handleKnowledgeSearch(req, res) {
  const source = req.method === 'GET' ? req.query : req.body;
  const { question, platform, threshold = 0.5 } = source;

  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({ error: '请提供有效的问题' });
  }

  const validThreshold = Math.max(0, Math.min(1, parseFloat(threshold) || 0.5));

  let result;
  if (platform) {
    result = knowledge.search(platform, question.trim(), validThreshold);
  } else {
    result = knowledge.searchAll(question.trim(), validThreshold);
  }

  return res.json(result);
}

app.get('/api/knowledge/search', handleKnowledgeSearch);
app.post('/api/knowledge/search', handleKnowledgeSearch);

app.get('/api/knowledge/:platform/stats', (req, res) => {
  const stats = knowledge.getStats(req.params.platform);
  res.json(stats);
});

app.get('/api/knowledge', (req, res) => {
  const stats = knowledge.getAllStats();
  res.json(stats);
});

app.post('/api/knowledge/:platform', validateKnowledgeEntry, (req, res) => {
  const { question, answer, tags = [] } = req.body;

  const entry = knowledge.addEntry(req.params.platform, question, answer, tags);

  hooks.emit(hooks.DATA_EVENTS.KNOWLEDGE_ADDED, {
    platform: req.params.platform,
    question
  });

  res.json({ success: true, entry });
});

app.delete('/api/knowledge/:platform/:id', (req, res) => {
  const success = knowledge.deleteEntry(req.params.platform, parseInt(req.params.id));
  if (success) {
    hooks.emit(hooks.DATA_EVENTS.KNOWLEDGE_DELETED, {
      platform: req.params.platform,
      id: req.params.id
    });
    res.json({ success: true, message: '已删除' });
  } else {
    res.status(404).json({ error: '条目不存在' });
  }
});

// ==================== 钩子 API ====================

app.get('/api/hooks/events', (req, res) => {
  res.json(hooks.getRegisteredEvents());
});

app.get('/api/hooks/history', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 20;
  res.json(hooks.getHistory(limit));
});

app.post('/api/hooks/register', (req, res) => {
  const { event, handlerName } = req.body;

  if (!event || !handlerName) {
    return res.status(400).json({ error: '请提供 event 和 handlerName' });
  }

  const handler = (data) => {
    logger.info(`自定义钩子触发: ${event}`, { handlerName, data });
  };

  hooks.on(event, handler);

  res.json({
    success: true,
    message: `已注册钩子: ${event}`,
    unsubscribe: true
  });
});

// ==================== 调试 API ====================

app.get('/api/debug/page/:platform', async (req, res) => {
  try {
    const { platform } = req.params;
    if (!requireKnownPlatform(platform, res)) return;

    const page = browser.pages[platform];
    if (!page || page.isClosed()) {
      return res.status(404).json({ error: `${platform} 未打开` });
    }

    const platformConfig = browser.platforms[platform] || {};

    const info = await page.evaluate((config) => {
      const allDivs = Array.from(document.querySelectorAll('div'));
      const divsWithText = allDivs.filter(el => {
        const text = el.innerText?.trim();
        return text && text.length > 50 && el.children.length < 5;
      }).slice(-15).map(el => ({
        className: el.className?.substring(0, 80),
        textLength: el.innerText.length,
        textPreview: el.innerText.substring(0, 100)
      }));

      const textareas = Array.from(document.querySelectorAll('textarea')).map(t => ({
        placeholder: t.placeholder,
        className: t.className?.substring(0, 50)
      }));

      const contentEditable = Array.from(document.querySelectorAll('[contenteditable="true"]')).map(el => ({
        tagName: el.tagName,
        className: el.className?.substring(0, 50)
      }));

      const responseSelectorResults = {};
      if (config.responseSelector) {
        const selectors = config.responseSelector.split(',').map(s => s.trim());
        for (const sel of selectors) {
          try {
            const elements = document.querySelectorAll(sel);
            responseSelectorResults[sel] = {
              count: elements.length,
              samples: Array.from(elements).slice(-3).map(el => ({
                tagName: el.tagName,
                className: el.className?.substring(0, 50),
                textLength: (el.innerText || '').length,
                textPreview: (el.innerText || '').substring(0, 80)
              }))
            };
          } catch (e) {
            responseSelectorResults[sel] = { error: e.message };
          }
        }
      }

      const loadingSelectorResults = {};
      if (config.loadingSelector) {
        const selectors = config.loadingSelector.split(',').map(s => s.trim());
        for (const sel of selectors) {
          try {
            const elements = document.querySelectorAll(sel);
            loadingSelectorResults[sel] = {
              count: elements.length,
              visible: Array.from(elements).filter(el => {
                const style = window.getComputedStyle(el);
                return style.display !== 'none' && style.visibility !== 'hidden';
              }).length
            };
          } catch (e) {
            loadingSelectorResults[sel] = { error: e.message };
          }
        }
      }

      return {
        title: document.title,
        url: window.location.href,
        textareas,
        contentEditable,
        divsWithText,
        responseSelectorResults,
        loadingSelectorResults
      };
    }, platformConfig);

    res.json(info);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 统计 API ====================

app.get('/api/stats', (req, res) => {
  res.json(database.getStats());
});

app.get('/api/storage', (req, res) => {
  res.json({
    knowledge: knowledge.getStorageInfo(),
    conversations: database.getStorageInfo()
  });
});

// ==================== 存储管理 API ====================

app.get('/api/storage/mode', (req, res) => {
  const convInfo = database.getStorageInfo();
  const kbInfo = knowledge.getStorageInfo();
  const googleStatus = googleAuth.getStatus();

  res.json({
    conversations: {
      mode: convInfo.usingGoogleDrive ? 'google_drive' : 'local',
      path: convInfo.path,
      env: convInfo.env
    },
    knowledge: {
      mode: kbInfo.usingGoogleDrive ? 'google_drive' : 'local',
      path: kbInfo.path,
      env: kbInfo.env
    },
    google: googleStatus
  });
});

app.post('/api/storage/mode', (req, res) => {
  try {
    const { target, mode, googlePath } = req.body;

    if (!target || !['conversations', 'knowledge', 'all'].includes(target)) {
      return res.status(400).json({ error: 'target 必须是 conversations、knowledge 或 all' });
    }
    if (!mode || !['local', 'google_drive'].includes(mode)) {
      return res.status(400).json({ error: 'mode 必须是 local 或 google_drive' });
    }

    // 读取当前 .env
    const envPath = path.join(__dirname, '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');

    const envKeys = {
      conversations: 'GOOGLE_DRIVE_DATA_DIR',
      knowledge: 'GOOGLE_DRIVE_KB_DIR'
    };

    const targets = target === 'all' ? ['conversations', 'knowledge'] : [target];

    for (const t of targets) {
      const envKey = envKeys[t];
      if (mode === 'google_drive') {
        const drivePath = googlePath || `G:\\\\My Drive\\\\ai-compare-data\\\\${t}`;
        // 更新或添加环境变量
        if (envContent.includes(envKey + '=')) {
          envContent = envContent.replace(new RegExp(envKey + '=.*'), `${envKey}=${drivePath}`);
        } else {
          envContent += `\n${envKey}=${drivePath}`;
        }
      } else {
        // 切换回本地：注释掉或删除环境变量
        envContent = envContent.replace(new RegExp(envKey + '=.*'), `${envKey}=`);
      }
    }

    fs.writeFileSync(envPath, envContent.trimEnd() + '\n', 'utf8');

    logger.info('存储模式已更改', { target, mode, googlePath });
    res.json({
      success: true,
      message: `已切换 ${targets.join('、')} 存储到 ${mode === 'google_drive' ? 'Google Drive' : '本地'}`,
      note: '需要重启服务器才能生效'
    });

  } catch (error) {
    logger.error('切换存储模式失败', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});


app.get('/api/health', async (req, res) => {
  await hooks.emit(hooks.PROCESS_EVENTS.HEALTH_CHECK, { timestamp: Date.now() });

  res.json({
    status: 'ok',
    browserReady: !!browser,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    hooks: hooks.getRegisteredEvents()
  });
});

// ==================== 错误处理 ====================

app.use((err, req, res, next) => {
  logger.error('未捕获的错误', { error: err.message, stack: err.stack });
  hooks.emit(hooks.API_EVENTS.SERVER_ERROR, {
    error: err.message,
    url: req.url
  });
  res.status(500).json({ error: '服务器内部错误' });
});

app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// ==================== 启动 ====================

async function start() {
  try {
    registerHooks();
    await hooks.emit(hooks.PROCESS_EVENTS.STARTING, { port: PORT });

    await initBrowser();

    app.listen(PORT, async () => {
      logger.info(`服务器已启动: http://localhost:${PORT}`);
      await hooks.emit(hooks.PROCESS_EVENTS.STARTED, { port: PORT });
    });

  } catch (error) {
    logger.error('启动失败', { error: error.message });
    await hooks.emit(hooks.PROCESS_EVENTS.ERROR, { error: error.message });
    process.exit(1);
  }
}

// 进程钩子
process.on('SIGINT', async () => {
  await hooks.emit(hooks.PROCESS_EVENTS.SHUTTING_DOWN, { signal: 'SIGINT' });
  logger.info('收到 SIGINT 信号，正在关闭...');
  if (browser) await browser.close();
  await hooks.emit(hooks.PROCESS_EVENTS.SHUTDOWN, { signal: 'SIGINT' });
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await hooks.emit(hooks.PROCESS_EVENTS.SHUTTING_DOWN, { signal: 'SIGTERM' });
  logger.info('收到 SIGTERM 信号，正在关闭...');
  if (browser) await browser.close();
  await hooks.emit(hooks.PROCESS_EVENTS.SHUTDOWN, { signal: 'SIGTERM' });
  process.exit(0);
});

process.on('uncaughtException', async (err) => {
  logger.error('未捕获的异常', { error: err.message, stack: err.stack });
  await hooks.emit(hooks.PROCESS_EVENTS.ERROR, {
    type: 'uncaughtException',
    error: err.message
  });
  process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
  logger.error('未处理的 Promise 拒绝', { reason: String(reason) });
  await hooks.emit(hooks.PROCESS_EVENTS.ERROR, {
    type: 'unhandledRejection',
    reason: String(reason)
  });
});

start();
