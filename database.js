// database.js - JSON 文件存储（替代 SQLite）
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'conversations.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 读取数据
function loadData() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('读取数据失败:', error);
  }
  return { questions: [], responses: [], comparisons: [] };
}

// 保存数据
function saveData(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('保存数据失败:', error);
    return false;
  }
}

class Database {
  constructor() {
    this.data = loadData();
  }

  // 保存问题
  saveQuestion(question) {
    const id = this.data.questions.length + 1;
    this.data.questions.push({
      id,
      question,
      created_at: new Date().toISOString()
    });
    saveData(this.data);
    return id;
  }

  // 保存回答
  saveResponse(questionId, platform, response) {
    const id = this.data.responses.length + 1;
    this.data.responses.push({
      id,
      question_id: questionId,
      platform,
      response,
      created_at: new Date().toISOString()
    });
    saveData(this.data);
    return id;
  }

  // 保存对比分析
  saveComparison(questionId, analysis) {
    const id = this.data.comparisons.length + 1;
    this.data.comparisons.push({
      id,
      question_id: questionId,
      analysis,
      created_at: new Date().toISOString()
    });
    saveData(this.data);
    return id;
  }

  // 获取问题的所有回答
  getResponsesByQuestionId(questionId) {
    return this.data.responses.filter(r => r.question_id === parseInt(questionId));
  }

  // 获取最近的问题
  getRecentQuestions(limit = 10) {
    return this.data.questions.slice(-limit).reverse();
  }

  // 获取完整的对话记录
  getFullConversation(questionId) {
    const id = parseInt(questionId);
    const question = this.data.questions.find(q => q.id === id);
    const responses = this.getResponsesByQuestionId(id);
    const comparison = this.data.comparisons
      .filter(c => c.question_id === id)
      .slice(-1)[0];

    return { question, responses, comparison };
  }

  // 搜索问题
  searchQuestions(keyword) {
    return this.data.questions
      .filter(q => q.question.includes(keyword))
      .reverse();
  }

  // 获取统计信息
  getStats() {
    const platformStats = {};
    this.data.responses.forEach(r => {
      platformStats[r.platform] = (platformStats[r.platform] || 0) + 1;
    });

    return {
      totalQuestions: this.data.questions.length,
      totalResponses: this.data.responses.length,
      platformStats: Object.entries(platformStats).map(([platform, count]) => ({
        platform,
        count
      }))
    };
  }
}

module.exports = new Database();
