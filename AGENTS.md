# AI Compare Server - Agent 配置与开发规范

## 核心概念

这是一个**浏览器自动化代理服务器**。它不直接调用 AI API，而是通过 Puppeteer 控制 Chrome 浏览器，
在 AI 平台的**网页端**发送问题并抓取回答。

**正确用法：调用服务器 API，让服务器操作浏览器去问网页 AI。**

## 快速上手（Agent 必读）

### 启动服务器

```bash
cd Agent_online
npm install
cp .env.example .env
npm start
```

### Agent 调用流程

**不要自己去读 HTML 文件、不要自己创建页面、不要尝试直接操作浏览器。**

只需调用 HTTP API：

1. **提问** → POST `http://localhost:3000/api/ask`
   - 服务器会自动：打开浏览器 → 登录检测 → 发送问题 → 等待回答 → 返回结果
   - 请求体：`{ "question": "你的问题", "platform": "deepseek" }`
   - 如果返回 401 + `needLogin: true`，说明需要用户手动登录

2. **确认登录** → POST `http://localhost:3000/api/confirm-login/deepseek`
   - 用户在浏览器中手动登录后，调用此接口确认

3. **查询知识库** → POST `http://localhost:3000/api/index`
   - 先查缓存，避免重复请求

4. **健康检查** → GET `http://localhost:3000/api/health`

### 调用示例

```javascript
// 发送问题到 DeepSeek 网页端
const res = await fetch('http://localhost:3000/api/ask', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    question: '用 HTML 写一个购物车页面',
    platform: 'deepseek'
  })
});
const data = await res.json();

if (data.needLogin) {
  // 提示用户在浏览器中登录
  console.log('请在弹出的 Chrome 窗口中登录 DeepSeek');
  // 登录后调用 /api/confirm-login/deepseek
}

if (data.success) {
  console.log(data.response); // AI 的回答
}
```

## 平台列表

| ID | 名称 | URL |
|----|------|-----|
| deepseek | DeepSeek | https://chat.deepseek.com/ |
| chatgpt | ChatGPT | https://chat.openai.com/ |
| claude | Claude | https://claude.ai/ |
| gemini | Gemini | https://gemini.google.com/ |
| qianwen | 通义千问 | https://tongyi.aliyun.com/qianwen/ |
| doubao | 豆包 | https://www.doubao.com/chat/ |
| yuanbao | 元宝 | https://yuanbao.tencent.com/ |

## 代码规范

- 模块系统：CommonJS（require / module.exports）
- 日志：统一使用 ./logger.js
- 错误处理：所有异步操作必须有 try/catch
- 不要直接修改 public/index.html，它是前端单页面应用

## 文件职责

| 文件 | 说明 |
|------|------|
| server.js | Express 路由，所有 API 入口 |
| browser.js | Puppeteer 浏览器自动化核心 |
| database.js | 对话/回答 JSON 存储 |
| knowledge.js | 知识库匹配算法 |
| answer-service.js | 编排层：知识库 → 网页 AI |
| platforms.json | AI 平台 CSS 选择器配置 |
| public/index.html | 前端界面 |

## 重要提醒

- **不要读取或编辑 public/index.html** 来理解功能，直接调用 API
- **不要尝试自己创建 HTML 页面**，那是用户的事
- **服务器返回 401 + needLogin** 时，提示用户手动登录，不要死等
- **服务器响应可能需要 30 秒到 3 分钟**，因为要等网页 AI 生成完回答
- 设置合理的超时：fetch 超时建议 5 分钟
