const puppeteer = require('puppeteer-core');
const fs = require('fs');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:4173/?v=verify';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.30(0x18001e2c) NetType/WIFI Language/zh_CN';
const OUT = 'D:/开发工具-zy/代码类目/my-web-demo';
const logs = [];
const wait = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=390,844']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  await page.setUserAgent(UA);
  page.on('console', m => logs.push('[c.' + m.type() + '] ' + m.text()));
  page.on('pageerror', e => logs.push('[pageerror] ' + e.message));
  page.on('requestfailed', r => logs.push('[reqfail] ' + r.url().slice(0, 100) + ' :: ' + (r.failure() && r.failure().errorText)));

  try {
    await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(1500);
    // 登录
    const u = await page.$('input[type="text"], input[name="username"], input[placeholder*="用户名"]');
    if (u) { await u.click({ clickCount: 3 }); await u.type('admin', { delay: 10 }); }
    const p = await page.$('input[type="password"], input[name="password"], input[placeholder*="密码"]');
    if (p) { await p.click({ clickCount: 3 }); await p.type('admin12345', { delay: 10 }); }
    const btn = await page.$('button.full.el-button--primary');
    if (!btn) throw new Error('login button not found');
    await btn.click();
    await wait(4000);
    console.log('AFTER LOGIN URL:', page.url());

    // 进入备考台
    await page.goto('http://localhost:4173/#/learn/english/prep?v=verify', { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(3000);

    // 找到卡片 tab / 背单词入口，点击进入卡片
    // 尝试点击包含“开始学习”/“背单词”/卡片区域的按钮
    const clickedCard = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, .el-button'));
      const t = btns.find(b => /开始今日学习|开始学习|背单词|去学习|进入/.test(b.innerText));
      if (t) { t.click(); return t.innerText; }
      return null;
    });
    console.log('clicked card btn:', clickedCard);
    await wait(2500);

    // 翻转当前卡片（点击 .flashcard-front 或 .flashcard）
    const flipped = await page.evaluate(() => {
      const el = document.querySelector('.flashcard, .flashcard-front, .fc-card');
      if (el) { el.click(); return true; }
      return false;
    });
    console.log('flipped card:', flipped);
    await wait(2000);

    // 读取背面 助记 / 例句 文本
    const enrich = await page.evaluate(() => {
      const secs = Array.from(document.querySelectorAll('.fc-enrich-sec'));
      const out = {};
      for (const s of secs) {
        const hd = s.querySelector('.fc-enrich-hd')?.innerText || '';
        out[hd] = s.innerText.replace(hd, '').replace(/\s+/g, ' ').trim().slice(0, 160);
      }
      return out;
    });
    console.log('ENRICH SECTIONS:', JSON.stringify(enrich, null, 2));
    await page.screenshot({ path: `${OUT}/_v_card_back.png` });

    // 检查悬浮按钮位置（应在右侧）
    const fab = await page.evaluate(() => {
      const f = document.querySelector('.mobile-menu-fab');
      if (!f) return null;
      const r = f.getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(r.right), w: window.innerWidth, visible: getComputedStyle(f).display !== 'none' };
    });
    console.log('FAB POS:', JSON.stringify(fab));

    // 返回，进入资料库，点击预览
    await page.goto('http://localhost:4173/#/learn/english/prep?v=verify', { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(2000);
    const opened = await page.evaluate(() => {
      // 找“资料库”tab
      const tabs = Array.from(document.querySelectorAll('button, .el-tabs__item, .tab'));
      const lib = tabs.find(b => /资料库|素材|文库/.test(b.innerText));
      if (lib) { lib.click(); return lib.innerText; }
      return null;
    });
    console.log('clicked lib tab:', opened);
    await wait(2000);
    // 点第一个 预览 按钮
    const prevClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(x => /预览/.test(x.innerText));
      if (b) { b.click(); return true; }
      return false;
    });
    console.log('preview clicked:', prevClicked);
    await wait(6000);
    const pdfState = await page.evaluate(() => {
      const dlg = document.querySelector('.pdfv-dialog, .el-dialog');
      const canvas = document.querySelector('.pdfv-canvas');
      const tip = document.querySelector('.pdfv-tip');
      return {
        dialogVisible: !!dlg && dlg.offsetParent !== null,
        hasCanvas: !!canvas,
        tipText: tip ? tip.innerText : null,
        bodyText: dlg ? dlg.innerText.replace(/\s+/g, ' ').slice(0, 200) : null
      };
    });
    console.log('PDF STATE:', JSON.stringify(pdfState, null, 2));
    await page.screenshot({ path: `${OUT}/_v_pdf.png` });

  } catch (e) {
    console.error('ERROR', e);
    await page.screenshot({ path: `${OUT}/_v_error.png` });
  } finally {
    fs.writeFileSync(`${OUT}/_v_console.log`, logs.join('\n'));
    console.log('=== LOGS (tail) ===');
    console.log(logs.slice(-30).join('\n'));
    await browser.close();
  }
})();
