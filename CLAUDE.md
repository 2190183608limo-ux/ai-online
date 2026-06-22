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

## 架构

### 核心模块
| 文件 | 功能 |
|------|------|
| `server.js` | Express 服务器 + 钩子系统 |
| `browser.js` | Puppeteer 反检测浏览器自动化 + 请求队列 |
| `database.js` | JSON 文件存储 + 索引缓存 |
| `knowledge.js` | 知识库 + 内存缓存 |
| `hooks.js` | 集中式钩子管理器 |
| `logger.js` | 日志系统（文件 + 控制台） |
| `validator.js` | 输入验证中间件 |
| `security.js` | API 认证 + 限流 + 安全头 |
| `platforms.json` | 平台配置 |

### 支持平台
DeepSeek、Gemini、ChatGPT、Claude、Mimo、通义千问、豆包、元宝

## 环境变量
```bash
PORT=3000                    # 服务端口
API_KEYS=key1,key2           # API Keys（逗号分隔）
DISABLE_AUTH=true            # 禁用认证（开发用）
DISABLE_RATE_LIMIT=true      # 禁用限流
CORS_ORIGIN=http://example.com  # CORS 来源
DEBUG=true                   # 调试日志
CHROME_PATH=/path/to/chrome # Chrome 路径
```

## API 接口

### 提问
```bash
# 单平台提问
POST http://localhost:3000/api/ask
{
  "question": "你的问题",
  "platform": "deepseek",
  "newConversation": true
}

# 多平台并行对比
POST http://localhost:3000/api/ask-all
{
  "question": "你的问题",
  "platforms": ["deepseek", "chatgpt", "claude"],
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

### 对话历史
```bash
GET  /api/conversations                      # 获取所有对话列表
GET  /api/conversations/:conversationId/history  # 获取对话完整历史
```

### 知识库
```bash
POST /api/knowledge/search              # 搜索知识库
GET  /api/knowledge                     # 获取所有平台知识库概览
GET  /api/knowledge/:platform/stats     # 获取某个平台知识库统计
POST /api/knowledge/:platform           # 手动添加知识库条目
DEL  /api/knowledge/:platform/:id       # 删除知识库条目
```

### 钩子系统
```bash
GET  /api/hooks/events                  # 获取已注册的钩子事件
GET  /api/hooks/history                 # 获取钩子触发历史
POST /api/hooks/register                # 注册自定义钩子
```

### 系统
```bash
GET  /api/health                        # 健康检查
GET  /api/stats                         # 统计信息
GET  /api/storage                       # 存储信息
```

## 钩子事件

### 进程生命周期
- `process:starting` - 进程启动中
- `process:started` - 进程已启动
- `process:shutting_down` - 进程关闭中
- `process:shutdown` - 进程已关闭
- `process:error` - 进程错误
- `process:health_check` - 健康检查

### 浏览器事件
- `browser:launching` - 浏览器启动中
- `browser:launched` - 浏览器已启动
- `browser:navigating` - 正在导航
- `browser:navigated` - 导航完成
- `browser:page_load` - 页面加载完成
- `browser:page_error` - 页面错误
- `browser:dialog` - 对话框出现
- `browser:captcha_detected` - 验证码检测
- `browser:captcha_resolved` - 验证码解决
- `browser:login_required` - 需要登录
- `browser:login_success` - 登录成功
- `browser:question_sent` - 问题已发送
- `browser:response_received` - 收到回答
- `browser:response_timeout` - 响应超时
- `browser:closing` - 浏览器关闭中
- `browser:closed` - 浏览器已关闭

### API 事件
- `api:request_start` - 请求开始
- `api:request_end` - 请求结束
- `api:auth_success` - 认证成功
- `api:auth_failure` - 认证失败
- `api:rate_limited` - 被限流
- `api:validation_error` - 验证错误
- `api:server_error` - 服务器错误

### 数据变更
- `data:question_saved` - 问题已保存
- `data:response_saved` - 回答已保存
- `data:knowledge_added` - 知识库新增
- `data:knowledge_hit` - 知识库命中
- `data:knowledge_deleted` - 知识库删除
- `data:conversation_started` - 对话开始
- `data:conversation_ended` - 对话结束

## 使用场景

1. **对比不同 AI 的回答**
   ```bash
   curl -X POST http://localhost:3000/api/ask-all \
     -H "Content-Type: application/json" \
     -d '{"question": "什么是机器学习？", "platforms": ["deepseek", "chatgpt", "claude"]}'
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

3. **监控系统事件**
   ```bash
   # 查看钩子事件
   curl http://localhost:3000/api/hooks/events
   
   # 查看钩子历史
   curl http://localhost:3000/api/hooks/history?limit=50
   ```

## 注意事项

1. 首次使用需要在浏览器中登录平台，登录状态会自动保存
2. 知识库会自动缓存相似问题（相似度 > 50%）
3. 请求队列确保并发安全
4. 钩子系统支持自定义扩展
5. 超时时间默认 5 分钟

## 文件结构

```
ai-compare-server/
├── server.js           # 主服务器 + 钩子系统
├── browser.js          # 浏览器自动化 + 请求队列
├── database.js         # 数据存储 + 索引
├── knowledge.js        # 知识库 + 缓存
├── hooks.js            # 钩子管理器
├── logger.js           # 日志系统
├── validator.js        # 输入验证
├── security.js         # 安全中间件
├── platforms.json      # 平台配置
├── 启动.bat            # 一键启动
├── CLAUDE.md           # 本文件
├── public/
│   └── index.html      # 管理界面
├── browser-data/       # 浏览器登录状态
├── data/               # 对话数据
├── knowledge/          # 知识库数据
└── logs/               # 日志文件
```
