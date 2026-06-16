# 🤖 AI Multi-Platform Collaboration System

A powerful automation tool that enables seamless collaboration between Claude and other AI platforms (DeepSeek, Gemini, ChatGPT). Claude acts as the planner and reviewer, while repetitive tasks are delegated to other AI platforms.

## ✨ Features

- **🔄 Smart Collaboration Workflow**: Plan → Delegate → Execute → Verify → Optimize
- **🌐 Multi-Platform Support**: DeepSeek, Gemini, ChatGPT (easily extensible)
- **💬 Multi-Turn Conversations**: Up to 6 follow-up questions per conversation
- **🎯 Auto Mode Selection**: Automatically chooses Expert/Fast mode based on task complexity
- **📊 Response Storage**: Save and compare responses from different platforms
- **🔧 Configurable**: Add new AI platforms via configuration

## 🚀 Quick Start

### Prerequisites

- Node.js 14+ installed
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/ai-collaboration-system.git
cd ai-collaboration-system

# Install dependencies
npm install
```

### Usage

```bash
# Start the server
node server.js

# Or use the batch file (Windows)
启动.bat
```

The server will start at `http://localhost:3000` and automatically open the management interface.

## 📡 API Reference

### Ask Question

```bash
POST /api/ask
Content-Type: application/json

{
  "question": "Your question here",
  "platform": "deepseek",
  "newConversation": true
}
```

### Continue Conversation (Multi-turn)

```bash
POST /api/continue
Content-Type: application/json

{
  "question": "Follow-up question",
  "platform": "deepseek"
}
```

### New Conversation

```bash
POST /api/new-conversation
Content-Type: application/json

{
  "platform": "deepseek"
}
```

### Platform Management

```bash
# Get all platforms
GET /api/platforms

# Add new platform
POST /api/platforms
{
  "id": "chatgpt",
  "name": "ChatGPT",
  "url": "https://chat.openai.com/",
  "inputSelector": "textarea, #prompt-textarea",
  "responseSelector": ".markdown, [class*='message-content']"
}

# Delete platform
DELETE /api/platforms/:id

# Switch platform
POST /api/switch-platform
{ "platform": "gemini" }
```

## 🔧 Configuration

### Platform Configuration

Edit `platforms.json` to add or modify platforms:

```json
{
  "platforms": {
    "deepseek": {
      "name": "DeepSeek",
      "url": "https://chat.deepseek.com/",
      "inputSelector": "textarea[placeholder*='发送消息'], textarea",
      "responseSelector": ".ds-markdown, .markdown-body, [class*='message-content']",
      "modeSelector": {
        "expert": "div:has-text('专家模式')",
        "fast": null
      },
      "newConversationSelector": "div:has-text('开启新对话')"
    }
  }
}
```

### Adding a New Platform

1. Open the management interface at `http://localhost:3000`
2. Click "Add Platform" tab
3. Fill in the platform details:
   - **ID**: Unique identifier (e.g., `chatgpt`)
   - **Name**: Display name (e.g., `ChatGPT`)
   - **URL**: Platform URL
   - **Input Selector**: CSS selector for the input field
   - **Response Selector**: CSS selector for response content

## 📁 Project Structure

```
ai-collaboration-system/
├── server.js           # Main server
├── browser.js          # Browser automation (multi-platform)
├── database.js         # Data storage (JSON)
├── platforms.json      # Platform configurations
├── package.json        # Dependencies
├── .gitignore          # Git ignore rules
├── 启动.bat            # Windows startup script
├── public/
│   └── index.html      # Management interface
└── README.md           # This file
```

## 🎯 Use Cases

### 1. Code Generation

```
User: "Help me write a login page"

Workflow:
1. Claude analyzes requirements
2. Delegates to DeepSeek for base code
3. Reviews code quality
4. Optimizes and enhances
5. Delivers complete, optimized code
```

### 2. Document Creation

```
User: "Write an API documentation"

Workflow:
1. Claude plans document structure
2. Delegates to AI for content generation
3. Reviews completeness
4. Adds examples and fixes errors
5. Delivers polished documentation
```

### 3. Data Analysis

```
User: "Analyze this dataset"

Workflow:
1. Claude determines analysis dimensions
2. Delegates code generation to AI
3. Verifies analysis logic
4. Improves visualizations
5. Delivers complete analysis report
```

## 🔐 Security Notes

- Login credentials are stored locally in `browser-data/`
- Sensitive data should not be sent to external AI platforms
- The server runs locally and is not exposed to the internet

## 🛠️ Troubleshooting

### Port already in use

```bash
# Windows
taskkill /F /IM node.exe

# Linux/Mac
killall node
```

### Browser fails to launch

```bash
# Reinstall Puppeteer browsers
npx puppeteer browsers install chrome
```

### Login state lost

Delete the `browser-data/` folder and log in again.

## 📄 License

MIT License - feel free to use and modify

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## 📧 Contact

For questions or feedback, please open an issue on GitHub.
