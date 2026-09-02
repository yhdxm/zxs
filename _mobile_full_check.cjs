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
  browser.on('targetcreated', async target => {
    if (target.type() === 'page') {
      const newPage = await target.page();
      await new Promise(r => setTimeout(r, 4000));
      try { await newPage.screenshot({ path: `${OUT}/_m_popup_${Date.now()}.png` }); } catch {}
    }
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  await page.setUserAgent(UA);
  page.on('console', m => logs.push('[console.' + m.type() + '] ' + m.text()));
  page.on('pageerror', e => logs.push('[pageerror] ' + e.message));
  page.on('requestfailed', r => logs.push('[reqfail] ' + r.url().slice(0, 120) + ' :: ' + (r.failure() && r.failure().errorText)));
  page.on('response', async r => {
    const u = r.url();
    if (u.includes('supabase') && r.status() >= 400) {
      try { logs.push('[resp400] ' + u + ' status=' + r.status() + ' body=' + await r.text()); } catch {}
    }
  });

  const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('SHOT', name); };
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const clickByText = async (text, exact = true) => {
    const ok = await page.evaluate((t, exact) => {
      const all = Array.from(document.querySelectorAll('button, a, .el-button, [role="tab"], .dh-nav-item, .de-nav-item'));
      const el = all.find(e => {
        const txt = e.innerText.trim();
        return exact ? txt === t : txt.includes(t);
      });
      if (el) { el.click(); return true; }
      return false;
    }, text, exact);
    console.log('CLICK', text, ok ? 'OK' : 'FAIL');
    return ok;
  };
  const dumpInfo = async (label) => {
    const info = await page.evaluate(() => {
      const txt = document.body.innerText.slice(0, 700);
      const btns = [...new Set(Array.from(document.querySelectorAll('button,.el-button,a,[role="tab"],.dh-nav-item')).map(e => e.textContent.trim()).filter(t => t && t.length < 20))];
      return { url: location.href, txt, btns };
    });
    console.log('---', label, info.url, '---');
    console.log('BODY:', info.txt.slice(0, 400));
    console.log('BTNS:', info.btns.join(' | '));
  };

  try {
    console.log('== login ==');
    await page.goto(BASE, { waitUntil: 'load', timeout: 30000 });
    await wait(2000);
    const u = await page.$('input[type="text"], input[name="username"]');
    if (u) { await u.click({ clickCount: 3 }); await u.type('admin', { delay: 10 }); }
    const p = await page.$('input[type="password"], input[name="password"]');
    if (p) { await p.click({ clickCount: 3 }); await p.type('admin12345', { delay: 10 }); }
    await page.click('button.full.el-button--primary');
    await wait(5000);
    await shot('_m2_welcome');

    console.log('== degree prep ==');
    await page.goto('https://yhdxm.github.io/zxs/#/learn/english/prep?v=202609031838', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await wait(4000);
    await shot('_m3_degree_prep');
    await dumpInfo('degree prep');

    console.log('== 背单词卡 tab ==');
    await clickByText('背单词卡');
    await wait(2000);
    await shot('_m4_cards_tab');
    await dumpInfo('cards tab');

    console.log('== 开始背单词 ==');
    await clickByText('开始背单词');
    await wait(2500);
    await shot('_m5_card_front');
    await dumpInfo('card front');

    console.log('== flip card ==');
    await page.evaluate(() => {
      const card = document.querySelector('.flashcard');
      if (card) card.click();
      else console.log('no .flashcard found');
    });
    await wait(2500);
    await shot('_m6_card_back');
    await dumpInfo('card back');

    console.log('== exit card ==');
    await page.evaluate(() => {
      const btn = document.querySelector('.flashcard-exit');
      if (btn) btn.click();
    });
    await wait(1500);

    console.log('== 资料库 tab ==');
    await clickByText('资料库');
    await wait(2500);
    await shot('_m7_library');
    await dumpInfo('library');

    console.log('== preview PDF ==');
    const previewOk = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('button, .el-button, a'));
      const el = all.find(e => e.textContent.trim() === '预览');
      if (el) { el.click(); return true; }
      // fallback: first button in library list
      const first = document.querySelector('.library-list button, .pdf-list button, [class*="library"] button, [class*="pdf"] button');
      if (first) { first.click(); return 'fallback'; }
      return false;
    });
    console.log('PDF preview click:', previewOk);
    await wait(5000);
    await shot('_m8_pdf');
    await dumpInfo('pdf');

  } catch (e) {
    console.error('SCRIPT ERROR:', e);
    await shot('_m_error');
  } finally {
    fs.writeFileSync(`${OUT}/_m_full_console.log`, logs.join('\n'));
    console.log('=== FULL CONSOLE (first 120) ===');
    console.log(logs.slice(0, 120).join('\n'));
    await browser.close();
  }
})();
