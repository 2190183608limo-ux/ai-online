# AI 对比服务器 - Code Wiki

## 📋 项目概述

**AI 对比服务器**是一个基于 Node.js 的多平台 AI 自动化对比系统，能够同时向多个 AI 平台（如 DeepSeek、ChatGPT、Claude、Gemini 等）发送问题并收集回答，实现 AI 回答的对比分析。

### 核心功能
- **多平台并行提问**：同时向多个 AI 平台发送问题
- **智能知识库**：自动存储和检索相似问题答案，避免重复请求
- **浏览器自动化**：使用 Puppeteer 自动操作 AI 平台网页
- **对话管理**：支持多轮对话和对话历史记录
- **可视化管理界面**：Web 界面管理平台、查看结果
- **钩子系统**：事件驱动的扩展机制
- **安全防护**：API 密钥认证、请求限流、安全头设置

### 技术栈
- **后端**：Node.js + Express.js
- **浏览器自动化**：Puppeteer + Stealth 插件
- **数据存储**：JSON 文件（支持本地和 Google Drive）
- **前端**：原生 HTML/CSS/JavaScript + Marked.js
- **认证**：Google OAuth 2.0（可选）

---

## 🏗️ 系统架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      前端界面 (index.html)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  平台管理   │  │   提问界面  │  │  对话历史   │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Express.js 服务器 (server.js)              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    中间件层                            │   │
│  │  CORS → 安全头 → 限流 → API认证 → 输入清理 → 验证    │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    API 路由层                          │   │
│  │  /api/ask  /api/platforms  /api/knowledge  /api/hooks │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  BrowserAuto  │    │  Database     │    │ KnowledgeBase │
│  (browser.js) │    │ (database.js) │    │(knowledge.js) │
│               │    │               │    │               │
│  • 多平台管理 │    │  • JSON存储   │    │  • 相似度匹配 │
│  • 自动登录   │    │  • 对话历史   │    │  • 知识检索   │
│  • 问题发送   │    │  • 统计查询   │    │  • 缓存管理   │
│  • 响应等待   │    │  • 索引优化   │    │  • 过期检测   │
└───────────────┘    └───────────────┘    └───────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                    AI 平台网页                               │
│  DeepSeek │ ChatGPT │ Claude │ Gemini │ 通义千问 │ 豆包等   │
└─────────────────────────────────────────────────────────────┘
```

### 数据流

1. **提问流程**：
   ```
   用户提问 → 知识库检索 → 命中? → 返回缓存答案
                    ↓ 未命中
              浏览器自动化 → AI平台 → 收集回答 → 存储知识库 → 返回结果
   ```

2. **并行对比流程**：
   ```
   用户提问 → 分发到多个平台 → 并行等待响应 → 汇总结果 → 返回对比
   ```

3. **钩子事件流**：
   ```
   操作触发 → 钩子管理器 → 按优先级执行处理器 → 记录历史
   ```

---

## 📦 核心模块详解

### 1. server.js - 主服务器

**职责**：Express 应用配置、API 路由定义、中间件管理、系统启动

**关键代码位置**：
- 应用配置：[server.js#L21-L34](file:///c:/Users/~/Desktop/contect/ai-compare-server/server.js#L21-L34)
- API 路由：[server.js#L260-L760](file:///c:/Users/~/Desktop/contect/ai-compare-server/server.js#L260-L760)
- 启动逻辑：[server.js#L896-L913](file:///c:/Users/~/Desktop/contect/ai-compare-server/server.js#L896-L913)

**主要功能**：
- 配置 CORS、JSON 解析、静态文件服务
- 注册安全中间件（限流、认证、安全头）
- 定义平台管理、提问、知识库、钩子等 API
- 管理浏览器实例生命周期
- 处理进程信号和错误

**核心函数**：
```javascript
// 初始化浏览器管理器
async function initBrowser()

// 注册系统钩子
function registerHooks()

// 验证平台数组
function validatePlatformArray(platforms, res)

// 生成响应数据
function responsePayload(result)
```

### 2. browser.js - 浏览器自动化

**职责**：管理多个 AI 平台的浏览器实例，自动化操作网页

**关键代码位置**：
- BrowserAutomation 类：[browser.js#L19-L589](file:///c:/Users/~/Desktop/contect/ai-compare-server/browser.js#L19-L589)
- 平台配置加载：[browser.js#L29-L37](file:///c:/Users/~/Desktop/contect/ai-compare-server/browser.js#L29-L37)
- 浏览器创建：[browser.js#L138-L174](file:///c:/Users/~/Desktop/contect/ai-compare-server/browser.js#L138-L174)
- 问题发送：[browser.js#L325-L350](file:///c:/Users/~/Desktop/contect/ai-compare-server/browser.js#L325-L350)
- 响应等待：[browser.js#L442-L506](file:///c:/Users/~/Desktop/contect/ai-compare-server/browser.js#L442-L506)

**BrowserAutomation 类**：

```javascript
class BrowserAutomation {
  constructor()
  // 属性：
  // - browsers: 浏览器实例映射
  // - pages: 页面实例映射
  // - platforms: 平台配置
  // - conversationIds: 对话ID映射
  // - loginConfirmations: 登录确认状态
  // - queues: 操作队列

  // 平台管理
  loadPlatforms()                    // 从 platforms.json 加载配置
  savePlatforms()                    // 保存配置到文件
  addPlatform(id, config)            // 添加新平台
  removePlatform(id)                 // 删除平台
  hasPlatform(platformId)            // 检查平台是否存在
  getPlatformStatus(platformId)      // 获取平台状态
  getAllPlatformStatus()              // 获取所有平台状态

  // 浏览器操作
  async launch()                     // 启动浏览器管理器
  async _createBrowser(platformId)   // 创建浏览器实例
  async navigateTo(platformId)       // 导航到平台页面
  async closePlatform(platformId)    // 关闭平台
  async close()                      // 关闭所有

  // 登录管理
  confirmLogin(platformId)           // 确认登录
  isLoggedIn(platformId)             // 检查登录状态
  async waitForLoginConfirmation()   // 等待登录确认

  // 问题交互
  async sendQuestion(platformId, question, mode)  // 发送问题
  async waitForResponse(platformId, maxWait, baseline)  // 等待响应
  async askQuestion(platformId, question, options)  // 完整提问流程
  async continueConversation(platformId, question)  // 继续对话
  async startNewConversation(platformId)  // 开始新对话

  // 辅助方法
  async _fillInput(page, input, question)  // 填充输入框
  async _findVisibleElement(page, selectorText)  // 查找可见元素
  async _getResponseSnapshot(platformId)  // 获取响应快照
  async _isLoading(platformId)  // 检查加载状态
  async _checkBlockingChallenge(platformId)  // 检查验证码
}
```

**关键特性**：
- **Stealth 模式**：使用 puppeteer-extra-plugin-stealth 避免检测
- **队列管理**：每个平台独立队列，防止并发冲突
- **智能等待**：轮询检测响应完成，支持部分响应返回
- **验证码检测**：自动检测并等待人工处理

### 3. database.js - 数据存储

**职责**：管理对话历史、问题和回答的持久化存储

**关键代码位置**：
- Database 类：[database.js#L61-L233](file:///c:/Users/~/Desktop/contect/ai-compare-server/database.js#L61-L233)
- 数据加载：[database.js#L33-L47](file:///c:/Users/~/Desktop/contect/ai-compare-server/database.js#L33-L47)
- 索引构建：[database.js#L76-L95](file:///c:/Users/~/Desktop/contect/ai-compare-server/database.js#L76-L95)

**Database 类**：

```javascript
class Database {
  constructor()
  // 属性：
  // - data: { questions: [], responses: [] }
  // - _questionsById: 问题ID索引
  // - _questionsByConvId: 对话ID索引
  // - _responsesByQuestionId: 问题-响应索引
  // - _nextQuestionId: 下一个问题ID
  // - _nextResponseId: 下一个响应ID

  // 数据操作
  saveQuestion(question, conversationId)  // 保存问题
  saveResponse(questionId, platform, response)  // 保存响应

  // 查询方法
  getResponsesByQuestionId(questionId)  // 获取问题的所有响应
  getRecentQuestions(limit)  // 获取最近问题
  getConversationHistory(conversationId)  // 获取对话历史
  getConversations(limit)  // 获取对话列表
  getFullConversation(questionId)  // 获取完整对话
  getStats()  // 获取统计信息
  getStorageInfo()  // 获取存储信息
}
```

**数据结构**：
```json
{
  "questions": [
    {
      "id": 1,
      "question": "问题内容",
      "conversation_id": "conv_123",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "responses": [
    {
      "id": 1,
      "question_id": 1,
      "platform": "deepseek",
      "response": "AI回答内容",
      "created_at": "2024-01-01T00:00:01.000Z"
    }
  ]
}
```

### 4. knowledge.js - 知识库

**职责**：智能问答匹配，避免重复请求 AI 平台

**关键代码位置**：
- KnowledgeBase 类：[knowledge.js#L41-L376](file:///c:/Users/~/Desktop/contect/ai-compare-server/knowledge.js#L41-L376)
- 相似度计算：[knowledge.js#L187-L213](file:///c:/Users/~/Desktop/contect/ai-compare-server/knowledge.js#L187-L213)
- 知识检索：[knowledge.js#L272-L314](file:///c:/Users/~/Desktop/contect/ai-compare-server/knowledge.js#L272-L314)

**KnowledgeBase 类**：

```javascript
class KnowledgeBase {
  constructor()
  // 属性：
  // - knowledgeDir: 知识库目录
  // - platforms: 平台知识库缓存
  // - cache: 搜索结果缓存
  // - cacheMaxAge: 缓存过期时间

  // 知识管理
  loadPlatform(platformId)  // 加载平台知识库
  savePlatform(platformId)  // 保存平台知识库
  addEntry(platformId, question, answer, tags, meta)  // 添加知识条目
  deleteEntry(platformId, entryId)  // 删除知识条目
  incrementAskCount(platformId, entryId)  // 增加提问计数

  // 搜索功能
  search(platformId, question, threshold)  // 搜索相似问题
  searchAll(question, threshold)  // 搜索所有平台

  // 相似度计算
  calculateSimilarity(text1, text2)  // 计算相似度
  normalizeQuestion(text)  // 标准化问题文本
  _tokenize(text)  // 分词
  _cosine(tokens1, tokens2)  // 余弦相似度

  // 统计查询
  getStats(platformId)  // 获取平台统计
  getAllStats()  // 获取所有统计
  getStorageInfo()  // 获取存储信息
}
```

**相似度算法**：
- **Jaccard 相似度**：基于词集合的交并比（权重 0.45）
- **余弦相似度**：基于词频向量的余弦值（权重 0.40）
- **包含度**：词集合的包含程度（权重 0.15）
- **长度惩罚**：长度差异过大时降低分数

**知识条目结构**：
```json
{
  "id": 1,
  "question": "原始问题",
  "normalizedQuestion": "标准化问题",
  "questionHash": "SHA256哈希",
  "answer": "AI回答",
  "tags": ["标签1", "标签2"],
  "askCount": 5,
  "qualityScore": 0.75,
  "staleAfterDays": 45,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "lastAccessedAt": "2024-01-01T00:00:00.000Z"
}
```

### 5. hooks.js - 钩子系统

**职责**：事件驱动的扩展机制，支持异步和同步事件处理

**关键代码位置**：
- HookManager 类：[hooks.js#L4-L156](file:///c:/Users/~/Desktop/contect/ai-compare-server/hooks.js#L4-L156)
- 事件类型定义：[hooks.js#L158-L206](file:///c:/Users/~/Desktop/contect/ai-compare-server/hooks.js#L158-L206)

**HookManager 类**：

```javascript
class HookManager {
  constructor()
  // 属性：
  // - hooks: 事件处理器映射
  // - history: 事件历史记录
  // - maxHistory: 历史记录上限
  // - defaultTimeoutMs: 默认超时时间

  // 事件管理
  on(event, handler, priority, options)  // 注册事件处理器
  off(event, handler)  // 移除事件处理器
  removeAll(event)  // 移除所有处理器

  // 事件触发
  async emit(event, data, options)  // 异步触发事件
  emitDetached(event, data)  // 分离触发（不等待）
  emitSync(event, data)  // 同步触发

  // 查询方法
  getRegisteredEvents()  // 获取已注册事件
  getHistory(limit)  // 获取事件历史
}
```

**事件类型**：

```javascript
// 进程事件
hooks.PROCESS_EVENTS = {
  STARTING: 'process:starting',
  STARTED: 'process:started',
  SHUTTING_DOWN: 'process:shutting_down',
  SHUTDOWN: 'process:shutdown',
  ERROR: 'process:error',
  HEALTH_CHECK: 'process:health_check'
}

// 浏览器事件
hooks.BROWSER_EVENTS = {
  LAUNCHING: 'browser:launching',
  LAUNCHED: 'browser:launched',
  NAVIGATING: 'browser:navigating',
  NAVIGATED: 'browser:navigated',
  PAGE_LOAD: 'browser:page_load',
  PAGE_ERROR: 'browser:page_error',
  DIALOG: 'browser:dialog',
  CAPTCHA_DETECTED: 'browser:captcha_detected',
  CAPTCHA_RESOLVED: 'browser:captcha_resolved',
  LOGIN_REQUIRED: 'browser:login_required',
  LOGIN_SUCCESS: 'browser:login_success',
  QUESTION_SENT: 'browser:question_sent',
  RESPONSE_RECEIVED: 'browser:response_received',
  RESPONSE_TIMEOUT: 'browser:response_timeout',
  CLOSING: 'browser:closing',
  CLOSED: 'browser:closed'
}

// API 事件
hooks.API_EVENTS = {
  REQUEST_START: 'api:request_start',
  REQUEST_END: 'api:request_end',
  AUTH_SUCCESS: 'api:auth_success',
  AUTH_FAILURE: 'api:auth_failure',
  RATE_LIMITED: 'api:rate_limited',
  VALIDATION_ERROR: 'api:validation_error',
  SERVER_ERROR: 'api:server_error'
}

// 数据事件
hooks.DATA_EVENTS = {
  QUESTION_SAVED: 'data:question_saved',
  RESPONSE_SAVED: 'data:response_saved',
  KNOWLEDGE_ADDED: 'data:knowledge_added',
  KNOWLEDGE_HIT: 'data:knowledge_hit',
  KNOWLEDGE_DELETED: 'data:knowledge_deleted',
  CONVERSATION_STARTED: 'data:conversation_started',
  CONVERSATION_ENDED: 'data:conversation_ended'
}
```

### 6. security.js - 安全模块

**职责**：API 认证、请求限流、安全防护

**关键代码位置**：
- API 密钥认证：[security.js#L41-L54](file:///c:/Users/~/Desktop/contect/ai-compare-server/security.js#L41-L54)
- 请求限流：[security.js#L56-L81](file:///c:/Users/~/Desktop/contect/ai-compare-server/security.js#L56-L81)
- 安全头设置：[security.js#L99-L106](file:///c:/Users/~/Desktop/contect/ai-compare-server/security.js#L99-L106)

**主要功能**：

```javascript
// API 密钥认证
function apiKeyAuth(req, res, next)
// 支持三种认证方式：
// 1. Query 参数: ?api_key=xxx
// 2. Bearer Token: Authorization: Bearer xxx
// 3. 自定义头: X-API-Key: xxx

// 请求限流
function rateLimit(req, res, next)
// 基于 IP 的滑动窗口限流
// 默认：60秒内最多100个请求

// 安全头设置
function securityHeaders(req, res, next)
// 设置以下响应头：
// - X-Content-Type-Options: nosniff
// - X-Frame-Options: DENY
// - X-XSS-Protection: 0
// - Referrer-Policy: strict-origin-when-cross-origin
// - Cross-Origin-Resource-Policy: same-site

// 输入清理（当前为空实现，避免破坏 AI 提示词）
function sanitizeBody(req, res, next)

// 工具函数
function generateApiKey()  // 生成随机 API 密钥
function escapeHtml(str)   // HTML 转义
```

### 7. validator.js - 验证模块

**职责**：请求参数验证和清理

**关键代码位置**：
- 验证函数定义：[validator.js#L20-L135](file:///c:/Users/~/Desktop/contect/ai-compare-server/validator.js#L20-L135)

**验证函数**：

```javascript
// 验证问题
function validateQuestion(req, res, next)
// - 必须是非空字符串
// - 长度不超过 10000 字符
// - 自动去除首尾空格

// 验证平台 ID
function validatePlatform(req, res, next)
// - 必须是字符串
// - 只能包含字母、数字、下划线、连字符

// 验证平台创建参数
function validatePlatformCreation(req, res, next)
// - id, name, url 必填
// - 验证选择器格式
// - 标准化输入

// 验证知识库条目
function validateKnowledgeEntry(req, res, next)
// - question 和 answer 必填
// - 必须是非空字符串

// 验证分页参数
function validatePagination(req, res, next)
// - limit 必须是 1-100 的整数
// - 默认值 20
```

### 8. logger.js - 日志系统

**职责**：统一的日志记录，支持控制台和文件输出

**关键代码位置**：
- 日志函数：[logger.js#L29-L54](file:///c:/Users/~/Desktop/contect/ai-compare-server/logger.js#L29-L54)

**日志方法**：

```javascript
module.exports = {
  info: (message, data) => log('INFO', message, data),
  warn: (message, data) => log('WARN', message, data),
  error: (message, data) => log('ERROR', message, data),
  debug: (message, data) => {
    if (process.env.DEBUG) {
      log('DEBUG', message, data);
    }
  }
}
```

**日志格式**：
```
[2024-01-01T00:00:00.000Z] [INFO] 服务器已启动 {"port":3000}
[2024-01-01T00:00:01.000Z] [ERROR] 提问失败 {"error":"timeout"}
```

**日志存储**：
- 控制台输出：根据级别使用 console.log/warn/error
- 文件输出：`logs/app.log`（追加模式）

### 9. google-auth.js - Google 认证

**职责**：Google OAuth 2.0 授权，支持 Google Drive 集成

**关键代码位置**：
- OAuth 流程：[google-auth.js#L50-L65](file:///c:/Users/~/Desktop/contect/ai-compare-server/google-auth.js#L50-L65)
- 状态查询：[google-auth.js#L67-L95](file:///c:/Users/~/Desktop/contect/ai-compare-server/google-auth.js#L67-L95)

**主要功能**：

```javascript
// 获取授权 URL
function getAuthUrl()

// 保存授权令牌
async function saveTokenFromCode(code)

// 获取授权状态
function getStatus()

// 获取 Google Drive 客户端
function getDriveClient()
```

### 10. utils.js - 工具模块

**职责**：通用工具函数

```javascript
// 确保目录存在
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
```

---

## 📡 API 接口文档

### 平台管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/platforms` | 获取所有平台配置 |
| POST | `/api/platforms` | 添加新平台 |
| DELETE | `/api/platforms/:id` | 删除平台 |
| GET | `/api/platform-status` | 获取所有平台状态 |
| GET | `/api/platform-status/:platform` | 获取单个平台状态 |
| POST | `/api/switch-platform` | 切换到指定平台 |

### 提问接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/ask` | 向单个平台提问 |
| POST | `/api/ask-all` | 向多个平台并行提问 |
| POST | `/api/continue` | 继续对话（追问） |
| POST | `/api/new-conversation` | 开始新对话 |

**请求示例**：
```json
// POST /api/ask
{
  "question": "什么是机器学习？",
  "platform": "deepseek",
  "newConversation": true,
  "mode": null
}

// POST /api/ask-all
{
  "question": "什么是机器学习？",
  "platforms": ["deepseek", "chatgpt", "claude"],
  "newConversation": true
}

// POST /api/continue
{
  "question": "能详细解释一下吗？",
  "platform": "deepseek"
}
```

**响应示例**：
```json
{
  "success": true,
  "fromKnowledge": false,
  "questionId": 1,
  "conversation_id": "conv_123",
  "platform": "deepseek",
  "response": "机器学习是人工智能的一个分支...",
  "partial": false,
  "duration": 5000
}
```

### 登录管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/open-platform/:platform` | 打开平台页面 |
| POST | `/api/confirm-login/:platform` | 确认登录完成 |
| GET | `/api/login-status` | 获取所有平台登录状态 |

### 知识库

| 方法 | 路径 | 描述 |
|------|------|------|
| GET/POST | `/api/knowledge/search` | 搜索知识库 |
| GET | `/api/knowledge` | 获取所有知识库统计 |
| GET | `/api/knowledge/:platform/stats` | 获取平台知识库统计 |
| POST | `/api/knowledge/:platform` | 添加知识条目 |
| DELETE | `/api/knowledge/:platform/:id` | 删除知识条目 |

**搜索请求**：
```json
// POST /api/knowledge/search
{
  "question": "什么是机器学习？",
  "platform": "deepseek",
  "threshold": 0.5
}
```

### 数据查询

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/conversations` | 获取对话列表 |
| GET | `/api/conversations/:conversationId/history` | 获取对话历史 |
| GET | `/api/conversation/:id` | 获取单个问题详情 |
| GET | `/api/questions` | 获取最近问题 |

### 钩子系统

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/hooks/events` | 获取已注册事件 |
| GET | `/api/hooks/history` | 获取事件历史 |
| POST | `/api/hooks/register` | 注册自定义钩子 |

### 系统监控

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/stats` | 获取统计信息 |
| GET | `/api/storage` | 获取存储信息 |
| GET | `/api/debug/page/:platform` | 调试页面信息 |

### Google 集成

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/google/status` | 获取 Google 授权状态 |
| GET | `/api/google/auth-url` | 获取授权 URL |
| GET | `/api/google/callback` | OAuth 回调 |

---

## ⚙️ 配置说明

### 环境变量

创建 `.env` 文件配置以下变量：

```bash
# 服务器配置
PORT=3000
CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000

# API 安全
API_KEYS=your-api-key-1,your-api-key-2
DISABLE_AUTH=false
DISABLE_RATE_LIMIT=false
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100

# 浏览器配置
CHROME_PATH=C:/Program Files/Google/Chrome/Application/chrome.exe
BROWSER_RESPONSE_TIMEOUT_MS=600000
BROWSER_POLL_INTERVAL_MS=1200
BROWSER_STABLE_POLLS=5

# 知识库配置
KB_THRESHOLD=0.72
KB_MIN_ANSWER_LENGTH=40
KB_STALE_DAYS=45
KB_CACHE_MAX_AGE_MS=300000

# 钩子配置
HOOK_HISTORY_LIMIT=500
HOOK_TIMEOUT_MS=3000

# Google Drive 集成（可选）
GOOGLE_DRIVE_DATA_DIR=/path/to/google/drive/data
GOOGLE_DRIVE_KB_DIR=/path/to/google/drive/knowledge
GOOGLE_CREDENTIALS_PATH=./credentials.json
GOOGLE_TOKEN_PATH=./token.json
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/callback

# 调试
DEBUG=true
```

### 平台配置

编辑 `platforms.json` 添加或修改 AI 平台：

```json
{
  "platforms": {
    "platform-id": {
      "name": "平台显示名称",
      "url": "https://platform-url.com/",
      "inputSelector": "textarea, div[contenteditable='true']",
      "responseSelector": ".response-class, [data-role='assistant']",
      "loadingSelector": ".loading-indicator, [class*='thinking']",
      "stopSelector": "button[class*='stop']",
      "submitSelector": "button[type='submit']",
      "modeSelector": null,
      "newConversationSelector": "a[href='/new']",
      "captchaIndicators": [
        "iframe[src*='challenges.cloudflare.com']"
      ]
    }
  }
}
```

**选择器说明**：
- `inputSelector`：输入框的 CSS 选择器（支持多个，逗号分隔）
- `responseSelector`：回答内容的选择器
- `loadingSelector`：加载状态指示器的选择器
- `stopSelector`：停止生成按钮的选择器
- `submitSelector`：提交按钮的选择器
- `newConversationSelector`：新建对话按钮的选择器
- `captchaIndicators`：验证码/验证页面的选择器列表

### 预置平台

系统预置了以下 AI 平台：

| 平台 ID | 名称 | URL |
|---------|------|-----|
| deepseek | DeepSeek | https://chat.deepseek.com/ |
| chatgpt | ChatGPT | https://chat.openai.com/ |
| claude | Claude | https://claude.ai/ |
| gemini | Gemini | https://gemini.google.com/ |
| qianwen | 通义千问 | https://tongyi.aliyun.com/qianwen/ |
| doubao | 豆包 | https://www.doubao.com/chat/ |
| yuanbao | 元宝 | https://yuanbao.tencent.com/ |
| mimo | Mimo | https://aistudio.xiaomimimo.com/ |

---

## 🚀 部署与运行

### 环境要求

- **Node.js**：14.0 或更高版本
- **npm**：6.0 或更高版本
- **Chrome 浏览器**：用于浏览器自动化
- **操作系统**：Windows、macOS、Linux

### 安装步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/yourusername/ai-compare-server.git
   cd ai-compare-server
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置环境变量**
   ```bash
   # 复制示例配置
   cp .env.example .env
   
   # 编辑 .env 文件，配置必要参数
   # 至少需要配置 API_KEYS 或设置 DISABLE_AUTH=true
   ```

4. **启动服务器**
   ```bash
   # 方式 1：直接启动
   node server.js
   
   # 方式 2：使用 npm 脚本
   npm start
   
   # 方式 3：Windows 批处理
   启动.bat
   ```

5. **访问系统**
   - 管理界面：http://localhost:3000
   - API 文档：本文档的 API 接口部分

### 首次使用

1. **启动服务器**后，打开管理界面
2. **选择平台**（如 DeepSeek），点击"打开"按钮
3. **手动登录**：在弹出的浏览器窗口中登录 AI 平台
4. **确认登录**：登录成功后，点击"确认登录"按钮
5. **开始提问**：在提问区域输入问题并发送

### 生产环境部署

1. **设置环境变量**
   ```bash
   # 生产环境必须配置
   API_KEYS=your-secure-api-key
   DISABLE_AUTH=false
   DISABLE_RATE_LIMIT=false
   CORS_ORIGIN=https://your-domain.com
   ```

2. **使用进程管理器**
   ```bash
   # 使用 PM2
   npm install -g pm2
   pm2 start server.js --name ai-compare
   pm2 save
   pm2 startup
   ```

3. **配置反向代理**（Nginx 示例）
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

4. **配置 HTTPS**
   ```bash
   # 使用 Let's Encrypt
   sudo certbot --nginx -d your-domain.com
   ```

### 数据存储

数据默认存储在本地：

```
ai-compare-server/
├── data/
│   └── conversations.json    # 对话数据
├── knowledge/
│   ├── deepseek.json         # DeepSeek 知识库
│   ├── chatgpt.json          # ChatGPT 知识库
│   └── ...
├── browser-data/
│   ├── profile_deepseek/     # DeepSeek 浏览器配置
│   ├── profile_chatgpt/      # ChatGPT 浏览器配置
│   └── ...
└── logs/
    └── app.log               # 应用日志
```

**Google Drive 集成**（可选）：

1. 创建 Google Cloud 项目并启用 Drive API
2. 下载 OAuth 凭据文件，保存为 `credentials.json`
3. 访问 `/api/google/auth-url` 获取授权链接
4. 完成授权后，数据将自动同步到 Google Drive

---

## 🛠️ 开发指南

### 项目结构

```
ai-compare-server/
├── server.js              # 主服务器
├── browser.js             # 浏览器自动化
├── database.js            # 数据存储
├── knowledge.js           # 知识库
├── hooks.js               # 钩子系统
├── security.js            # 安全模块
├── validator.js           # 验证模块
├── logger.js              # 日志系统
├── google-auth.js         # Google 认证
├── utils.js               # 工具函数
├── platforms.json         # 平台配置
├── package.json           # 项目配置
├── .env                   # 环境变量
├── public/
│   └── index.html         # 前端界面
├── data/                  # 数据目录
├── knowledge/             # 知识库目录
├── browser-data/          # 浏览器数据
└── logs/                  # 日志目录
```

### 添加新平台

1. **编辑 platforms.json**
   ```json
   {
     "platforms": {
       "new-platform": {
         "name": "新平台",
         "url": "https://new-platform.com/",
         "inputSelector": "textarea",
         "responseSelector": ".response",
         "loadingSelector": ".loading",
         "stopSelector": null,
         "submitSelector": "button.send",
         "modeSelector": null,
         "newConversationSelector": "a.new",
         "captchaIndicators": []
       }
     }
   }
   ```

2. **或通过 API 添加**
   ```bash
   curl -X POST http://localhost:3000/api/platforms \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer your-api-key" \
     -d '{
       "id": "new-platform",
       "name": "新平台",
       "url": "https://new-platform.com/",
       "inputSelector": "textarea",
       "responseSelector": ".response"
     }'
   ```

### 扩展钩子系统

```javascript
const hooks = require('./hooks');

// 注册自定义钩子
hooks.on('custom:event', async (data) => {
  console.log('自定义事件触发:', data);
  // 执行自定义逻辑
}, 10); // 优先级 10

// 触发事件
await hooks.emit('custom:event', { key: 'value' });

// 注册带超时的钩子
hooks.on('slow:event', async (data) => {
  // 耗时操作
}, 0, { timeoutMs: 10000 }); // 10秒超时
```

### 添加新的 API 端点

```javascript
// server.js
app.get('/api/custom', apiKeyAuth, async (req, res) => {
  try {
    // 业务逻辑
    const result = await someOperation();
    
    // 触发钩子
    await hooks.emit('custom:operation', { result });
    
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('操作失败', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});
```

### 调试技巧

1. **启用调试日志**
   ```bash
   DEBUG=true node server.js
   ```

2. **查看浏览器页面状态**
   ```bash
   curl http://localhost:3000/api/debug/page/deepseek
   ```

3. **查看钩子历史**
   ```bash
   curl http://localhost:3000/api/hooks/history?limit=50
   ```

4. **查看系统健康状态**
   ```bash
   curl http://localhost:3000/api/health
   ```

---

## ❓ 故障排除

### 常见问题

#### 1. 端口被占用
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/macOS
lsof -i :3000
kill -9 <PID>
```

#### 2. 浏览器启动失败
```bash
# 重新安装 Puppeteer 浏览器
npx puppeteer browsers install chrome

# 或指定 Chrome 路径
export CHROME_PATH=/path/to/chrome
```

#### 3. 登录状态丢失
```bash
# 删除浏览器数据目录
rm -rf browser-data/

# 重新启动并登录
```

#### 4. 知识库搜索不准确
- 调整 `KB_THRESHOLD` 参数（默认 0.72）
- 降低阈值会增加匹配数量，但可能降低准确性
- 提高阈值会减少匹配，但提高准确性

#### 5. 响应超时
- 增加 `BROWSER_RESPONSE_TIMEOUT_MS`（默认 600000ms = 10分钟）
- 检查网络连接
- 检查 AI 平台是否需要人工验证

#### 6. API 认证失败
```bash
# 检查 API 密钥配置
echo $API_KEYS

# 或临时禁用认证
DISABLE_AUTH=true node server.js
```

#### 7. 验证码/人工验证
系统会自动检测验证码：
1. 检测到验证码时，会触发 `CAPTCHA_DETECTED` 事件
2. 在浏览器窗口中手动完成验证
3. 系统会自动继续执行

### 日志查看

```bash
# 查看实时日志
tail -f logs/app.log

# 搜索错误
grep "ERROR" logs/app.log

# 按时间筛选
grep "2024-01-01" logs/app.log
```

### 性能优化

1. **减少浏览器实例**
   - 只打开需要的平台
   - 使用完后及时关闭

2. **优化知识库**
   - 定期清理过期条目
   - 调整缓存参数

3. **调整轮询参数**
   ```bash
   BROWSER_POLL_INTERVAL_MS=2000    # 增加轮询间隔
   BROWSER_STABLE_POLLS=3           # 减少稳定轮询次数
   ```

---

## 📝 更新日志

### v1.0.0 (2024-01-01)
- 初始版本发布
- 支持多平台 AI 对比
- 知识库系统
- 钩子扩展机制
- Web 管理界面

---

## 📄 许可证

MIT License - 详见 LICENSE 文件

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📧 联系方式

如有问题或建议，请提交 Issue 或联系维护者。

---

**文档版本**：1.0.0  
**最后更新**：2024-01-01  
**维护者**：AI Compare Server Team