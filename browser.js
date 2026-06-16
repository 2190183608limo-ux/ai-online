// browser.js - 通用浏览器自动化模块（支持验证码处理）
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const USER_DATA_DIR = path.join(__dirname, 'browser-data');
const PLATFORMS_CONFIG = path.join(__dirname, 'platforms.json');

class BrowserAutomation {
  constructor() {
    this.browser = null;
    this.page = null;
    this.platforms = this.loadPlatforms();
    this.conversationId = null;
  }

  // 加载平台配置
  loadPlatforms() {
    try {
      const data = fs.readFileSync(PLATFORMS_CONFIG, 'utf8');
      return JSON.parse(data).platforms;
    } catch (e) {
      console.error('加载平台配置失败:', e);
      return {};
    }
  }

  // 保存平台配置
  savePlatforms() {
    try {
      fs.writeFileSync(PLATFORMS_CONFIG, JSON.stringify({ platforms: this.platforms }, null, 2));
      return true;
    } catch (e) {
      console.error('保存平台配置失败:', e);
      return false;
    }
  }

  // 添加新平台
  addPlatform(id, config) {
    this.platforms[id] = {
      name: config.name,
      url: config.url,
      inputSelector: config.inputSelector || 'textarea',
      responseSelector: config.responseSelector || '[class*="message"]',
      modeSelector: config.modeSelector || null,
      newConversationSelector: config.newConversationSelector || null,
      captchaIndicators: config.captchaIndicators || []  // 验证码指示器
    };
    return this.savePlatforms();
  }

  // 启动浏览器
  async launch(headless = false) {
    this.browser = await puppeteer.launch({
      headless: headless,
      userDataDir: USER_DATA_DIR,
      defaultViewport: null,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--start-maximized']
    });
    this.page = await this.browser.newPage();
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await this.page.setViewport({ width: 1920, height: 1080 });
    console.log('浏览器已启动');
  }

  // 导航到平台
  async navigateTo(platformId) {
    const platform = this.platforms[platformId];
    if (!platform) throw new Error(`未知平台: ${platformId}`);

    console.log(`正在打开 ${platform.name}...`);
    await this.page.goto(platform.url, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log(`${platform.name} 已打开`);
    await this.page.waitForTimeout(3000);
  }

  // 检测验证码
  async detectCaptcha(platformId) {
    const platform = this.platforms[platformId];
    if (!platform) return false;

    // 通用验证码指示器
    const commonCaptchaSelectors = [
      'iframe[src*="captcha"]',
      'iframe[src*="recaptcha"]',
      'iframe[src*="challenge"]',
      '[class*="captcha"]',
      '[class*="challenge"]',
      '[id*="captcha"]',
      '[id*="challenge"]',
      'input[name*="captcha"]',
      '.cf-turnstile',  // Cloudflare
      '#challenge-running',  // Cloudflare
      '[data-sitekey]'  // reCAPTCHA
    ];

    // 平台特定的验证码指示器
    const platformCaptchaSelectors = platform.captchaIndicators || [];

    const allSelectors = [...commonCaptchaSelectors, ...platformCaptchaSelectors];

    for (const selector of allSelectors) {
      try {
        const element = await this.page.$(selector);
        if (element) {
          console.log(`检测到验证码: ${selector}`);
          return true;
        }
      } catch (e) {
        // 继续
      }
    }

    // 检查页面文本是否包含验证码相关关键词
    const pageText = await this.page.evaluate(() => document.body.innerText);
    const captchaKeywords = ['验证', '机器人', 'captcha', 'verify', 'human', '验证身份', '安全验证'];

    for (const keyword of captchaKeywords) {
      if (pageText.toLowerCase().includes(keyword.toLowerCase())) {
        console.log(`检测到验证码关键词: ${keyword}`);
        return true;
      }
    }

    return false;
  }

  // 等待用户处理验证码
  async waitForCaptchaResolution(timeout = 120000) {
    console.log('\n⚠️  检测到验证码/人机验证');
    console.log('请在浏览器中完成验证');
    console.log(`超时时间: ${timeout/1000} 秒`);
    console.log('完成验证后系统会自动继续...\n');

    const start = Date.now();
    let lastCheck = '';

    while (Date.now() - start < timeout) {
      await this.page.waitForTimeout(3000);

      // 检查是否还在验证码页面
      const stillHasCaptcha = await this.page.evaluate(() => {
        const text = document.body.innerText;
        const captchaKeywords = ['验证', '机器人', 'captcha', 'verify', 'human'];
        return captchaKeywords.some(k => text.toLowerCase().includes(k.toLowerCase()));
      });

      if (!stillHasCaptcha) {
        console.log('✅ 验证码已解决！');
        await this.page.waitForTimeout(2000);  // 等待页面稳定
        return true;
      }

      // 显示等待时间
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const currentCheck = `已等待 ${elapsed} 秒...`;
      if (currentCheck !== lastCheck) {
        console.log(currentCheck);
        lastCheck = currentCheck;
      }
    }

    throw new Error('验证码处理超时');
  }

  // 检查登录状态
  async isLoggedIn(platformId) {
    const platform = this.platforms[platformId];
    if (!platform) return false;

    try {
      // 先检查是否有验证码
      const hasCaptcha = await this.detectCaptcha(platformId);
      if (hasCaptcha) {
        await this.waitForCaptchaResolution();
      }

      // 检查输入框
      const selectors = platform.inputSelector.split(',').map(s => s.trim());
      for (const selector of selectors) {
        const input = await this.page.$(selector);
        if (input) return true;
      }
      return false;
    } catch (e) {
      console.error('检查登录状态出错:', e.message);
      return false;
    }
  }

  // 等待登录
  async waitForLogin(platformId, timeout = 120000) {
    const platform = this.platforms[platformId];
    console.log(`\n⚠️  ${platform.name} 需要登录`);
    console.log('请在浏览器中完成登录');
    console.log(`超时时间: ${timeout/1000} 秒\n`);

    const start = Date.now();
    while (Date.now() - start < timeout) {
      await this.page.waitForTimeout(3000);

      // 检查验证码
      const hasCaptcha = await this.detectCaptcha(platformId);
      if (hasCaptcha) {
        await this.waitForCaptchaResolution();
      }

      if (await this.isLoggedIn(platformId)) {
        console.log('✅ 登录成功！');
        return true;
      }
    }

    throw new Error('登录超时');
  }

  // 开始新对话
  async startNewConversation(platformId) {
    const platform = this.platforms[platformId];
    if (!platform || !platform.newConversationSelector) {
      console.log('刷新页面开始新对话...');
      await this.page.reload({ waitUntil: 'networkidle2' });
      await this.page.waitForTimeout(3000);
      this.conversationId = Date.now();
      return true;
    }

    try {
      await this.page.click(platform.newConversationSelector);
      await this.page.waitForTimeout(2000);
      this.conversationId = Date.now();
      console.log('新对话已开始');
      return true;
    } catch (e) {
      await this.page.reload({ waitUntil: 'networkidle2' });
      await this.page.waitForTimeout(3000);
      this.conversationId = Date.now();
      return true;
    }
  }

  // 选择模式
  async selectMode(platformId, mode) {
    const platform = this.platforms[platformId];
    if (!platform || !platform.modeSelector) return false;

    const selector = platform.modeSelector[mode];
    if (!selector) return false;

    try {
      await this.page.click(selector);
      await this.page.waitForTimeout(1000);
      console.log(`已选择 ${mode} 模式`);
      return true;
    } catch (e) {
      console.log('选择模式失败:', e.message);
      return false;
    }
  }

  // 发送问题
  async sendQuestion(platformId, question, mode = null) {
    const platform = this.platforms[platformId];
    if (!platform) throw new Error(`未知平台: ${platformId}`);

    console.log(`发送问题: ${question.substring(0, 50)}...`);

    // 检查验证码
    const hasCaptcha = await this.detectCaptcha(platformId);
    if (hasCaptcha) {
      await this.waitForCaptchaResolution();
    }

    // 选择模式
    if (mode && !this.conversationId) {
      await this.selectMode(platformId, mode);
    }

    // 找输入框
    const selectors = platform.inputSelector.split(',').map(s => s.trim());
    let input = null;
    for (const selector of selectors) {
      input = await this.page.$(selector);
      if (input) break;
    }

    if (!input) throw new Error('找不到输入框');

    // 输入并发送
    await input.click({ clickCount: 3 });
    await this.page.waitForTimeout(200);
    await input.type(question, { delay: 30 });
    await this.page.waitForTimeout(500);
    await this.page.keyboard.press('Enter');
    console.log('已发送');
  }

  // 等待回答（智能轮询）
  async waitForResponse(platformId, maxWait = 300000) {
    const platform = this.platforms[platformId];
    if (!platform) throw new Error(`未知平台: ${platformId}`);

    console.log('等待回答...');

    const selectors = platform.responseSelector.split(',').map(s => s.trim());
    let lastContent = '';
    let stableCount = 0;
    const start = Date.now();

    while (Date.now() - start < maxWait) {
      await this.page.waitForTimeout(2000);

      // 检查验证码
      const hasCaptcha = await this.detectCaptcha(platformId);
      if (hasCaptcha) {
        await this.waitForCaptchaResolution();
      }

      try {
        for (const selector of selectors) {
          const elements = await this.page.$$(selector);
          if (elements.length > 0) {
            const lastEl = elements[elements.length - 1];
            const content = await lastEl.evaluate(el => el.innerText.trim());

            if (content && content.length > 10) {
              if (content.length > lastContent.length) {
                lastContent = content;
                stableCount = 0;
                console.log(`生成中... (${content.length} 字符)`);
              } else {
                stableCount++;
                if (stableCount >= 5) {
                  console.log(`✅ 完成！(${lastContent.length} 字符)`);
                  return lastContent;
                }
              }
              break;
            }
          }
        }
      } catch (e) {
        // 继续
      }
    }

    if (lastContent) return lastContent;
    throw new Error('等待超时');
  }

  // 完整提问流程
  async askQuestion(platformId, question, options = {}) {
    const { newConversation = false, mode = null } = options;

    // 确保在正确页面
    const currentUrl = this.page.url();
    const platform = this.platforms[platformId];
    if (!currentUrl.includes(new URL(platform.url).hostname)) {
      await this.navigateTo(platformId);
    }

    // 检查登录（包含验证码处理）
    if (!(await this.isLoggedIn(platformId))) {
      await this.waitForLogin(platformId);
    }

    // 新对话
    if (newConversation || !this.conversationId) {
      await this.startNewConversation(platformId);
    }

    // 发送
    await this.sendQuestion(platformId, question, mode);

    // 等待回答
    const response = await this.waitForResponse(platformId);

    return { response, mode };
  }

  // 继续对话
  async continueConversation(platformId, question) {
    console.log(`追问: ${question.substring(0, 30)}...`);

    // 检查验证码
    const hasCaptcha = await this.detectCaptcha(platformId);
    if (hasCaptcha) {
      await this.waitForCaptchaResolution();
    }

    await this.sendQuestion(platformId, question, null);
    const response = await this.waitForResponse(platformId);
    return { response };
  }

  // 结束对话
  endConversation() {
    this.conversationId = null;
  }

  // 关闭
  async close() {
    if (this.browser) await this.browser.close();
  }
}

module.exports = BrowserAutomation;
