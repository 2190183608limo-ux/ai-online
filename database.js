// database.js - JSON 文件存储（优化版）
const fs = require('fs');
const path = require('path');
const { ensureDir } = require('./utils');

const LOCAL_DATA_DIR = path.join(__dirname, 'data');
const GOOGLE_DRIVE_DATA_DIR = process.env.GOOGLE_DRIVE_DATA_DIR;

function autoDetectGoogleDrive() {
  // 优先使用环境变量指定的路径
  if (GOOGLE_DRIVE_DATA_DIR) {
    const resolved = path.resolve(GOOGLE_DRIVE_DATA_DIR);
    try { ensureDir(resolved); return resolved; } catch (_) {}
  }

  // 自动检测 Google Drive 桌面端挂载路径
  const homeDir = require('os').homedir();
  const candidates = [
    path.join(homeDir, 'Google 云端硬盘'),
    path.join(homeDir, 'Google Drive'),
    path.join(homeDir, '我的云端硬盘'),
    'G:\\My Drive',
    'G:\\',
    'D:\\Google Drive',
    'D:\\My Drive',
  ];

  // 也检测所有盘符下的常见目录
  for (const letter of ['G', 'H', 'D', 'E', 'F']) {
    candidates.push(letter + ':\\My Drive');
    candidates.push(letter + ':\\Google Drive');
  }

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
    } catch (_) {}
  }

  return null;
}

function resolveDataDir() {
  const gdrivePath = autoDetectGoogleDrive();
  if (gdrivePath) {
    const dataDir = path.join(gdrivePath, 'ai-compare-data', 'conversations');
    try {
      ensureDir(dataDir);
      console.log(`☁️ 对话存储目录 (Google Drive): ${dataDir}`);
      return dataDir;
    } catch (error) {
      console.error(`Google Drive 目录不可用: ${error.message}`);
    }
  }

  ensureDir(LOCAL_DATA_DIR);
  console.log(`🏠 对话存储目录 (本地): ${LOCAL_DATA_DIR}`);
  return LOCAL_DATA_DIR;
}

const DATA_DIR = resolveDataDir();
const DB_FILE = path.join(DATA_DIR, 'conversations.json');

function emptyData() {
  return { questions: [], responses: [] };
}

function loadData() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(data);
      return {
        questions: Array.isArray(parsed.questions) ? parsed.questions : [],
        responses: Array.isArray(parsed.responses) ? parsed.responses : []
      };
    }
  } catch (error) {
    console.error('读取数据失败:', error.message);
  }
  return emptyData();
}

function saveData(data) {
  try {
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempFile, DB_FILE);
    return true;
  } catch (error) {
    console.error('保存数据失败:', error.message);
    return false;
  }
}

class Database {
  constructor() {
    this.data = loadData();
    this._questionsById = new Map();
    this._questionsByConvId = new Map();
    this._responsesByQuestionId = new Map();
    this._nextQuestionId = this.data.questions.length > 0
      ? Math.max(...this.data.questions.map(q => q.id)) + 1
      : 1;
    this._nextResponseId = this.data.responses.length > 0
      ? Math.max(...this.data.responses.map(r => r.id)) + 1
      : 1;
    this._rebuildIndexes();
  }

  _rebuildIndexes() {
    this._questionsById.clear();
    this._questionsByConvId.clear();
    this._responsesByQuestionId.clear();

    for (const q of this.data.questions) {
      this._questionsById.set(q.id, q);
      if (!this._questionsByConvId.has(q.conversation_id)) {
        this._questionsByConvId.set(q.conversation_id, []);
      }
      this._questionsByConvId.get(q.conversation_id).push(q);
    }

    for (const r of this.data.responses) {
      if (!this._responsesByQuestionId.has(r.question_id)) {
        this._responsesByQuestionId.set(r.question_id, []);
      }
      this._responsesByQuestionId.get(r.question_id).push(r);
    }
  }

  getStorageInfo() {
    return {
      path: DATA_DIR,
      usingGoogleDrive: DATA_DIR.includes('Google') || DATA_DIR.includes('云端硬盘') || DATA_DIR.includes('My Drive') || (!!GOOGLE_DRIVE_DATA_DIR && path.resolve(GOOGLE_DRIVE_DATA_DIR) === DATA_DIR),
      autoDetected: !GOOGLE_DRIVE_DATA_DIR
    };
  }

  saveQuestion(question, conversationId = null) {
    const id = this._nextQuestionId++;
    const convId = conversationId || `conv_${Date.now()}_${id}`;

    const q = {
      id,
      question,
      conversation_id: convId,
      created_at: new Date().toISOString()
    };

    this.data.questions.push(q);
    this._questionsById.set(id, q);

    if (!this._questionsByConvId.has(convId)) {
      this._questionsByConvId.set(convId, []);
    }
    this._questionsByConvId.get(convId).push(q);

    saveData(this.data);
    return { id, conversation_id: convId };
  }

  saveResponse(questionId, platform, response) {
    const id = this._nextResponseId++;
    const entry = {
      id,
      question_id: questionId,
      platform,
      response,
      created_at: new Date().toISOString()
    };
    this.data.responses.push(entry);

    if (!this._responsesByQuestionId.has(questionId)) {
      this._responsesByQuestionId.set(questionId, []);
    }
    this._responsesByQuestionId.get(questionId).push(entry);

    saveData(this.data);
    return id;
  }

  getResponsesByQuestionId(questionId) {
    return this._responsesByQuestionId.get(parseInt(questionId, 10)) || [];
  }

  getRecentQuestions(limit = 10) {
    return this.data.questions.slice(-limit).reverse();
  }

  getConversationHistory(conversationId) {
    const questions = (this._questionsByConvId.get(conversationId) || [])
      .sort((a, b) => a.id - b.id);

    return questions.map(q => {
      const responses = this._responsesByQuestionId.get(q.id) || [];
      return {
        id: q.id,
        question: q.question,
        conversation_id: q.conversation_id,
        created_at: q.created_at,
        responses: responses.map(r => ({
          id: r.id,
          platform: r.platform,
          response: r.response,
          created_at: r.created_at
        }))
      };
    });
  }

  getConversations(limit = 20) {
    const convMap = {};

    for (const q of this.data.questions) {
      const convId = q.conversation_id;
      if (!convMap[convId]) {
        convMap[convId] = {
          conversation_id: convId,
          first_question: q.question,
          question_count: 0,
          created_at: q.created_at,
          platforms: new Set()
        };
      }
      convMap[convId].question_count += 1;
      if (q.created_at < convMap[convId].created_at) {
        convMap[convId].created_at = q.created_at;
      }
    }

    for (const r of this.data.responses) {
      const q = this._questionsById.get(r.question_id);
      if (q && convMap[q.conversation_id]) {
        convMap[q.conversation_id].platforms.add(r.platform);
      }
    }

    return Object.values(convMap)
      .map(c => ({ ...c, platforms: Array.from(c.platforms) }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }

  getFullConversation(questionId) {
    const id = parseInt(questionId, 10);
    const question = this._questionsById.get(id);
    const responses = this.getResponsesByQuestionId(id);
    return { question, responses };
  }


  deleteConversation(conversationId) {
    // 找到该对话下的所有问题
    const questions = this._questionsByConvId.get(conversationId) || [];
    if (questions.length === 0) return false;

    // 收集所有问题 ID
    const questionIds = new Set(questions.map(q => q.id));

    // 删除相关回答
    this.data.responses = this.data.responses.filter(r => !questionIds.has(r.question_id));

    // 删除相关问题
    this.data.questions = this.data.questions.filter(q => q.conversation_id !== conversationId);

    // 重建索引
    this._rebuildIndexes();

    // 保存到文件
    saveData(this.data);
    return true;
  }

  getStats() {
    const platformStats = {};
    for (const r of this.data.responses) {
      platformStats[r.platform] = (platformStats[r.platform] || 0) + 1;
    }

    return {
      totalQuestions: this.data.questions.length,
      totalResponses: this.data.responses.length,
      storage: this.getStorageInfo(),
      platformStats: Object.entries(platformStats).map(([platform, count]) => ({
        platform,
        count
      }))
    };
  }
}

module.exports = new Database();
