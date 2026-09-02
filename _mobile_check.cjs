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

  const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('SHOT', name); };
  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  try {
    console.log('== 1. open & login ==');
    await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(2000);
    await shot('_m1_login');

    // username
    const u = await page.$('input[type="text"], input[name="username"], input[placeholder*="用户名"], #username');
    if (u) { await u.click({ clickCount: 3 }); await u.type('admin', { delay: 20 }); }
    const p = await page.$('input[type="password"], input[name="password"], input[placeholder*="密码"], #password');
    if (p) { await p.click({ clickCount: 3 }); await p.type('admin12345', { delay: 20 }); }
    const btn = await page.$('button[type="submit"], .el-button--primary');
    if (btn) await btn.click();
    await wait(5000);
    await shot('_m2_after_login');
    console.log('URL after login:', page.url());

    // navigate to degree prep
    console.log('== 2. degree prep ==');
    await page.goto('https://yhdxm.github.io/zxs/#/degree/prep?v=202609031838', { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(3500);
    await shot('_m3_degree_prep');

    // dump visible text + tabs
    const info = await page.evaluate(() => {
      const txt = document.body.innerText.slice(0, 600);
      const tabs = Array.from(document.querySelectorAll('*')).filter(e => e.children.length === 0 && e.textContent.trim().length > 0 && e.textContent.trim().length < 14).map(e => e.textContent.trim());
      const btns = Array.from(document.querySelectorAll('button,.el-button,a')).map(e => e.textContent.trim()).filter(t => t && t.length < 16);
      return { txt, uniqBtns: [...new Set(btns)].slice(0, 40) };
    });
    console.log('BODY TEXT:', info.txt);
    console.log('BUTTONS:', info.uniqBtns.join(' | '));

    // click 背单词卡
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('*')).find(e => e.children.length === 0 && e.textContent.trim() === '背单词卡');
      if (el) el.click();
    });
    await wait(3000);
    await shot('_m4_cards');

    // click first card to flip + capture
    await page.evaluate(() => {
      const card = document.querySelector('.flashcard, .focus-card, [class*="card"]');
      if (card) card.click();
    });
    await wait(2500);
    await shot('_m5_card_flipped');

    // click 资料库
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('*')).find(e => e.children.length === 0 && e.textContent.trim() === '资料库');
      if (el) el.click();
    });
    await wait(3000);
    await shot('_m6_library');

    // look for PDF buttons
    const pdfBtns = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button,.el-button,a')).map(e => e.textContent.trim()).filter(t => t && /pdf|资料|预览|打开|查看/i.test(t)).slice(0, 30);
    });
    console.log('PDF-ish buttons:', pdfBtns.join(' | '));

  } catch (e) {
    console.error('SCRIPT ERROR:', e);
    await shot('_m_error');
  } finally {
    fs.writeFileSync(`${OUT}/_m_console.log`, logs.join('\n'));
    console.log('=== CONSOLE/ERRORS ===');
    console.log(logs.slice(0, 80).join('\n'));
    await browser.close();
  }
})();
