# 上传到 GitHub 步骤

## 步骤 1：在 GitHub 创建仓库

1. 打开 https://github.com/new
2. 填写信息：
   - **Repository name**: `ai-collaboration-system`
   - **Description**: `AI Multi-Platform Collaboration System - Automate tasks across DeepSeek, Gemini, ChatGPT`
   - **Public/Private**: 选择 Public
   - **不要勾选**任何初始化选项（README, .gitignore 等）
3. 点击 "Create repository"

## 步骤 2：获取仓库地址

创建成功后，复制仓库地址，格式如下：
```
https://github.com/你的用户名/ai-collaboration-system.git
```

## 步骤 3：推送代码

在命令行运行（替换为你的仓库地址）：

```bash
cd C:\Users\~\Desktop\contect\ai-compare-server
git remote add origin https://github.com/你的用户名/ai-collaboration-system.git
git branch -M main
git push -u origin main
```

## 完成！

推送成功后，你的仓库地址将是：
```
https://github.com/你的用户名/ai-collaboration-system
```

---

## 或者安装 GitHub CLI

如果想使用命令行创建仓库：

```bash
# 安装 GitHub CLI
winget install GitHub.cli

# 登录
gh auth login

# 创建仓库并推送
gh repo create ai-collaboration-system --public --source=. --push
```
