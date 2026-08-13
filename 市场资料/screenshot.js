const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HTML_FILE = path.resolve(__dirname, '路演slides.html');
const OUT_DIR = path.resolve(__dirname, 'slides_img');

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--force-color-profile=srgb', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  // 2x 分辨率，清晰截图
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 2 });
  await page.goto('file:///' + HTML_FILE.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
  // 等待字体渲染
  await new Promise(r => setTimeout(r, 1500));

  const slides = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.slide')).map(s => {
      const r = s.getBoundingClientRect();
      return { id: s.id, x: r.x, y: r.y, w: r.width, h: r.height };
    });
  });

  console.log(`找到 ${slides.length} 张幻灯片`);

  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    const out = path.join(OUT_DIR, `slide_${String(i + 1).padStart(2, '0')}.png`);
    await page.screenshot({
      path: out,
      clip: { x: s.x, y: s.y, width: s.w, height: s.h },
    });
    console.log(`已截图: ${i + 1}/${slides.length} -> ${out}`);
  }

  await browser.close();
  console.log('全部截图完成');
})();
