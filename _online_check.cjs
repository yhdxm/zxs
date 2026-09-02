const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'https://yhdxm.github.io/zxs/?v=202609031838';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=390,844', '--user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true });

  try {
    console.log('1. Open login page');
    await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.screenshot({ path: 'D:/开发工具-zy/代码类目/my-web-demo/_preview_1_login.png' });

    console.log('2. Try login with default admin');
    await page.waitForSelector('input[type="text"], input[name="username"], #username', { timeout: 5000 }).catch(() => null);
    // Try common selectors
    const userSel = await page.evaluate(() => {
      const el = document.querySelector('input[type="text"], input[name="username"], input[placeholder*="用户名"], #username');
      return el ? el.tagName + (el.className ? '.' + el.className.split(' ').join('.') : '') : null;
    });
    console.log('   username selector found:', userSel);

    await page.type('input[type="text"], input[name="username"], input[placeholder*="用户名"], #username', 'admin', { delay: 10 }).catch(() => {});
    await page.type('input[type="password"], input[name="password"], input[placeholder*="密码"], #password', 'admin123', { delay: 10 }).catch(() => {});
    await page.click('button[type="submit"], button:has-text("登录"), .el-button--primary').catch(() => {});

    await new Promise(r => setTimeout(r, 5000));
    await page.screenshot({ path: 'D:/开发工具-zy/代码类目/my-web-demo/_preview_2_after_login.png' });

    const url = page.url();
    console.log('   URL after login attempt:', url);

    if (url.includes('login') || url === BASE || url.includes('welcome')) {
      // Try if we are on welcome or login
    }

    console.log('3. Navigate to degree prep');
    await page.goto('https://yhdxm.github.io/zxs/#/degree/prep?v=202609031838', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 4000));
    await page.screenshot({ path: 'D:/开发工具-zy/代码类目/my-web-demo/_preview_3_degree_prep.png' });

    console.log('4. Try click 背单词卡 tab');
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('*'));
      const target = tabs.find(el => el.textContent && el.textContent.includes('背单词卡'));
      if (target) target.click();
    });
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: 'D:/开发工具-zy/代码类目/my-web-demo/_preview_4_cards.png' });

    console.log('5. Try click 资料库 tab');
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('*'));
      const target = tabs.find(el => el.textContent && el.textContent.includes('资料库'));
      if (target) target.click();
    });
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: 'D:/开发工具-zy/代码类目/my-web-demo/_preview_5_library.png' });

    console.log('6. Collect console errors');
    // console errors are collected via event listener below
  } catch (e) {
    console.error('Script error:', e);
    await page.screenshot({ path: 'D:/开发工具-zy/代码类目/my-web-demo/_preview_error.png' });
  } finally {
    await browser.close();
  }
})();
