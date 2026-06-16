# AI 多平台对比系统

## 项目位置
`C:\Users\~\Desktop\contect\ai-compare-server\`

## 功能
自动化向多个 AI 平台（DeepSeek、Gemini、ChatGPT 等）提问，抓取回答，存储并对比分析。

## 启动方式
```bash
cd C:\Users\~\Desktop\contect\ai-compare-server
node server.js
# 或双击 "启动.bat"
```

服务器地址：http://localhost:3000

## API 接口

### 提问
```bash
POST http://localhost:3000/api/ask
{
  "question": "你的问题",
  "platform": "deepseek",  # 可选: deepseek, gemini, chatgpt
  "newConversation": true
}
```

### 继续对话（多轮）
```bash
POST http://localhost:3000/api/continue
{
  "question": "追问的问题",
  "platform": "deepseek"
}
```

### 新对话
```bash
POST http://localhost:3000/api/new-conversation
{ "platform": "deepseek" }
```

### 平台管理
```bash
GET  /api/platforms              # 获取所有平台
POST /api/platforms              # 添加新平台
DEL  /api/platforms/:id          # 删除平台
POST /api/switch-platform        # 切换平台
```

## 平台配置
配置文件：`platforms.json`

添加新平台示例：
```json
{
  "id": "chatgpt",
  "name": "ChatGPT",
  "url": "https://chat.openai.com/",
  "inputSelector": "textarea, #prompt-textarea",
  "responseSelector": ".markdown, [class*='message-content']"
}
```

## 使用场景

1. **对比不同 AI 的回答**
   ```bash
   curl -X POST http://localhost:3000/api/ask \
     -H "Content-Type: application/json" \
     -d '{"question": "什么是机器学习？", "platform": "deepseek"}'
   ```

2. **多轮深入讨论**
   ```bash
   # 第一次提问
   curl -X POST http://localhost:3000/api/ask \
     -d '{"question": "解释神经网络", "platform": "deepseek", "newConversation": true}'
   
   # 追问
   curl -X POST http://localhost:3000/api/continue \
     -d '{"question": "反向传播算法呢？", "platform": "deepseek"}'
   ```

3. **让 DeepSeek 做重复工作**
   - 让它写代码
   - 让它格式化代码
   - 让它整理文件
   - 让它优化结构

## 注意事项

1. 首次使用需要在浏览器中登录平台，登录状态会自动保存
2. DeepSeek 有"专家模式"和"快速模式"，系统会根据问题复杂度自动选择
3. 一个对话最多支持 6 轮追问
4. 超时时间默认 5 分钟，复杂任务可能需要更长时间

## 文件结构

```
ai-compare-server/
├── server.js           # 主服务器
├── browser.js          # 浏览器自动化
├── database.js         # 数据存储（JSON）
├── platforms.json      # 平台配置
├── 启动.bat            # 一键启动
├── CLAUDE.md           # 本文件
├── public/
│   └── index.html      # 管理界面
├── browser-data/       # 浏览器登录状态
└── data/               # 对话数据
```
