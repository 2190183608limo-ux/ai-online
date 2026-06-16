// server.js - 主服务器（支持多平台配置）
const express = require('express');
const cors = require('cors');
const path = require('path');
const BrowserAutomation = require('./browser');
const database = require('./database');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let browser = null;

// 启动浏览器
async function initBrowser(platform = 'deepseek') {
  browser = new BrowserAutomation();
  await browser.launch(false);
  await browser.navigateTo(platform);
  console.log(`浏览器已启动，${platform} 已打开`);
}

// ==================== 平台管理 API ====================

// 获取所有平台
app.get('/api/platforms', (req, res) => {
  if (!browser) return res.status(500).json({ error: '系统未初始化' });
  res.json(browser.platforms);
});

// 添加新平台
app.post('/api/platforms', (req, res) => {
  try {
    const { id, name, url, inputSelector, responseSelector, modeSelector, newConversationSelector } = req.body;

    if (!id || !name || !url) {
      return res.status(400).json({ error: '请提供 id, name, url' });
    }

    if (!browser) return res.status(500).json({ error: '系统未初始化' });

    const success = browser.addPlatform(id, {
      name, url, inputSelector, responseSelector, modeSelector, newConversationSelector
    });

    if (success) {
      res.json({ success: true, message: `平台 ${name} 已添加` });
    } else {
      res.status(500).json({ error: '添加失败' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除平台
app.delete('/api/platforms/:id', (req, res) => {
  try {
    if (!browser) return res.status(500).json({ error: '系统未初始化' });

    const success = browser.removePlatform(req.params.id);
    if (success) {
      res.json({ success: true, message: '平台已删除' });
    } else {
      res.status(404).json({ error: '平台不存在' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 提问 API ====================

// 提问（指定平台）
app.post('/api/ask', async (req, res) => {
  try {
    const { question, platform = 'deepseek', newConversation = true, mode = null } = req.body;

    if (!question) return res.status(400).json({ error: '请提供问题' });
    if (!browser) return res.status(500).json({ error: '系统未初始化' });

    console.log(`\n收到问题: ${question.substring(0, 50)}...`);
    console.log(`平台: ${platform}`);

    // 保存问题
    const questionId = database.saveQuestion(question);

    // 提问
    const result = await browser.askQuestion(platform, question, { newConversation, mode });

    // 保存回答
    database.saveResponse(questionId, platform, result.response);

    res.json({
      success: true,
      questionId,
      platform,
      mode: result.mode,
      response: result.response
    });

  } catch (error) {
    console.error('错误:', error);
    res.status(500).json({ error: error.message });
  }
});

// 继续对话（多轮）
app.post('/api/continue', async (req, res) => {
  try {
    const { question, platform = 'deepseek' } = req.body;

    if (!question) return res.status(400).json({ error: '请提供问题' });
    if (!browser) return res.status(500).json({ error: '系统未初始化' });

    console.log(`\n追问: ${question.substring(0, 50)}...`);

    const questionId = database.saveQuestion(question);
    const result = await browser.continueConversation(platform, question);
    database.saveResponse(questionId, platform, result.response);

    res.json({
      success: true,
      questionId,
      platform,
      response: result.response
    });

  } catch (error) {
    console.error('错误:', error);
    res.status(500).json({ error: error.message });
  }
});

// 新对话
app.post('/api/new-conversation', async (req, res) => {
  try {
    const { platform = 'deepseek' } = req.body;
    if (!browser) return res.status(500).json({ error: '系统未初始化' });

    await browser.startNewConversation(platform);
    browser.endConversation();

    res.json({ success: true, message: '新对话已开始' });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 切换平台
app.post('/api/switch-platform', async (req, res) => {
  try {
    const { platform } = req.body;
    if (!browser) return res.status(500).json({ error: '系统未初始化' });

    await browser.navigateTo(platform);
    browser.endConversation();

    res.json({ success: true, message: `已切换到 ${platform}` });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 数据 API ====================

// 获取对话记录
app.get('/api/conversation/:id', (req, res) => {
  const conversation = database.getFullConversation(req.params.id);
  res.json(conversation);
});

// 获取最近问题
app.get('/api/questions', (req, res) => {
  const questions = database.getRecentQuestions(parseInt(req.query.limit) || 10);
  res.json(questions);
});

// 统计信息
app.get('/api/stats', (req, res) => {
  res.json(database.getStats());
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', browserReady: !!browser });
});

// ==================== 启动 ====================

async function start() {
  try {
    // 默认使用 deepseek 启动
    const defaultPlatform = process.argv[2] || 'deepseek';
    await initBrowser(defaultPlatform);

    app.listen(PORT, () => {
      console.log(`\n🚀 服务器已启动: http://localhost:${PORT}`);
      console.log(`\n📋 API 接口:`);
      console.log(`   平台管理:`);
      console.log(`     GET  /api/platforms           - 获取所有平台`);
      console.log(`     POST /api/platforms           - 添加新平台`);
      console.log(`     DEL  /api/platforms/:id       - 删除平台`);
      console.log(`   提问:`);
      console.log(`     POST /api/ask                 - 提问（指定平台）`);
      console.log(`     POST /api/continue            - 继续对话（多轮）`);
      console.log(`     POST /api/new-conversation    - 开始新对话`);
      console.log(`     POST /api/switch-platform     - 切换平台`);
      console.log(`\n✅ 已打开: ${defaultPlatform}\n`);
    });

  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  if (browser) await browser.close();
  process.exit(0);
});

start();
