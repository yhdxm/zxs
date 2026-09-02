const puppeteer = require('puppeteer-core');
const fs = require('fs');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'https://yhdxm.github.io/zxs/?v=202609031838';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.30(0x18001e2c) NetType/WIFI Language/zh_CN';
const OUT = 'D:/开发工具-zy/代码类目/my-web-demo';
const logs = [];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=390,844']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  await page.setUserAgent(UA);
  page.on('console', m => logs.push('[console.' + m.type() + '] ' + m.text()));
  page.on('pageerror', e => logs.push('[pageerror] ' + e.message));
  page.on('requestfailed', r => logs.push('[reqfail] ' + r.url().slice(0, 120) + ' :: ' + (r.failure() && r.failure().errorText)));
  page.on('response', async r => {
    const u = r.url();
    if (u.includes('supabase') && u.includes('token') && r.status() >= 400) {
      try { logs.push('[resp400] ' + u + ' status=' + r.status() + ' body=' + await r.text()); } catch {}
    }
  });

  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  try {
    await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(1500);

    const u = await page.$('input[type="text"], input[name="username"], input[placeholder*="用户名"]');
    if (u) { await u.click({ clickCount: 3 }); await u.type('admin', { delay: 10 }); }
    const p = await page.$('input[type="password"], input[name="password"], input[placeholder*="密码"]');
    if (p) { await p.click({ clickCount: 3 }); await p.type('admin12345', { delay: 10 }); }
    const btn = await page.$('button.full.el-button--primary');
    if (!btn) throw new Error('login button not found');
    await btn.click();
    await wait(4000);

    await page.screenshot({ path: `${OUT}/_m_login_result.png` });
    console.log('URL:', page.url());
    const body = await page.evaluate(() => document.body.innerText.slice(0, 400));
    console.log('BODY:', body);
  } catch (e) {
    console.error(e);
    await page.screenshot({ path: `${OUT}/_m_login_error.png` });
  } finally {
    fs.writeFileSync(`${OUT}/_m_login_console.log`, logs.join('\n'));
    console.log('=== LOGS ===');
    console.log(logs.join('\n'));
    await browser.close();
  }
})();
