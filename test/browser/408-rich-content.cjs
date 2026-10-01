// 本地浏览器回归样例：运行此文件后，打开输出的地址并点击运行验证。
// 使用实际网页转换代码和本地题目接口，不连接网站账户，也不调用 MarginNote 数据库。
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const port = 8767;
const root = path.resolve(__dirname, "../..");
const latex = '<p>公式原文：<span class="katex"><annotation encoding="application/x-tex">x^2</annotation></span></p>';
const visual = '<p>开始<span class="katex"><span class="katex-html"><span style="display:inline-flex;flex-direction:column;text-align:center"><span>x + 1</span><span style="border-top:1px solid black">2</span></span></span></span>结束</p>';
const simpleSVG = '<svg xmlns="http://www.w3.org/2000/svg" width="281" height="161" viewBox="0 0 281 161"><rect width="281" height="161" fill="white"/><path d="M10 140H260" stroke="black" stroke-width="3"/><foreignObject x="20" y="20" width="180" height="100"><div xmlns="http://www.w3.org/1999/xhtml"><img src="/red.svg" style="width:160px;height:80px"/></div></foreignObject></svg>';
const labels = Array.from({ length: 56 }, (_, index) => {
  const x = 20 + index % 7 * 200;
  const y = 20 + Math.floor(index / 7) * 90;
  // 模拟画图工具的整图布局框、一个像素的标签容器，以及按边距定位的实际标签。
  return `<foreignObject x="0" y="0" width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;width:1px;height:1px;padding-top:${y}px;margin-left:${x}px"><div style="display:inline-block"><img src="/${index % 2 ? "blue" : "red"}.svg" style="width:160px;height:60px;max-width:none"/></div></div></foreignObject>`;
}).join("");
const largeSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1451" height="745" viewBox="0 0 1451 745"><rect width="1451" height="745" fill="white"/>${labels}</svg>`;
const styledSVG = '<style>#question-scope-test .diagram-label{width:120px;height:40px}</style><div id="question-scope-test"><svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="10 20 200 100"><g transform="translate(10 20)"><foreignObject x="20" y="10" width="150" height="70"><div xmlns="http://www.w3.org/1999/xhtml"><img class="diagram-label" src="/blue.svg"/></div></foreignObject></g></svg></div>';
const textSVG = '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="100"><rect width="240" height="100" fill="white"/><foreignObject x="10" y="10" width="200" height="80"><div xmlns="http://www.w3.org/1999/xhtml" style="font:20px sans-serif">IR.rt 寄存器<br/><b>控制信号</b></div></foreignObject></svg>';
const rows = [latex, visual, simpleSVG, largeSVG, styledSVG, textSVG, '<p>坏图应失败</p><img src="/missing.png">', '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><rect width="100" height="50" fill="white"/></svg>'].map((mdContent, index) => ({ question: {
  id: index + 1, year: 2026, questionIndex: index + 1, mdContent,
} }));
// 原始样例来自网站公开静态题目，保留源码换行和 KaTeX 结构以复现真实导入。
const formatRows = [5, 7, 14].map(number => ({ question: {
  id: 1000 + number, year: 2026, questionIndex: number,
  mdContent: fs.readFileSync(path.join(__dirname, 'fixtures', `408-2026-${number}.html`), 'utf8'),
} }));
formatRows.push({ question: { id: 2000, year: 2026, questionIndex: 50,
  mdContent: '<p>普通\n  段落<span>\n文字</span><br>显式换行</p><p>第二段</p><pre><code>while (x) {\n  x--;\n\n\n  y++;\n}</code></pre><table><tr><th>变量</th><th>值</th></tr><tr><td>x\n  y</td><td>1<br>2</td></tr></table>',
} });
const client = String.raw`
document.querySelector('#run').onclick = async function () {
  const output = document.querySelector('#result');
  const images = document.querySelector('#images');
  images.replaceChildren();
  output.textContent = '验证中';
  const checks = [];
  function check(condition, message) { if (!condition) throw new Error(message); checks.push(message); }
  try {
    eval(__DAGUANYUAN_408_PAGE_GLOBAL__.pageScript('rich-test'));
    const state = window.__DAGUANYUAN_408_IMPORT_PAGE__;
    async function wait() {
      for (let tick = 0; tick < 3500; tick++) {
        const read = JSON.parse(state.read('rich-test'));
        if (read.error || read.ready) return read;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      throw new Error('回归样例超时');
    }
    check(!(await wait()).error, '分类读取成功');
    for (let index = 0; index < 12; index++) {
      state.prepare('rich-test', index);
      const read = await wait();
      if (index === 6) { check(/404/.test(read.error), '坏图明确失败'); continue; }
      if (index === 7) { check(read.error.includes('转换结果为空白'), '空白图不会算作成功'); continue; }
      check(!read.error, '题目 ' + (index + 1) + ' 成功：' + (read.error || ''));
      const question = JSON.parse(state.payload).question;
      if (index >= 8) {
        check(!question.hasBase64Image, '简单表达式和文字不转图片：' + question.source);
        const savedMarkdown = __DAGUANYUAN_MATH_IMPORT_GLOBAL__.questionMarkdown(question, location.href, '408');
        check(savedMarkdown.startsWith(question.stem + '\n\n'), '建卡整理保留转换后的正文：' + question.source);
        if (index === 8) {
          check(!question.stem.includes('\n') && question.stem.includes('$a=1$') && question.stem.includes('$g=12$'), '第 5 题行内赋值完整并保持同段');
          check(question.options.join('|') === 'd|g|d,f|f,g', '第 5 题选项保留文字');
        }
        if (index === 9) {
          check(!question.stem.includes('\n') && question.stem.includes('$G=(V,E)$') && question.stem.includes('$n=|V|$') && question.stem.includes('$e\\in E$'), '第 7 题集合关系完整并保持同段');
          check(question.options.every(option => !option.includes('\n')) && question.options[0].includes('若 $G$ 无环，则 $S$ 是有限集'), '第 7 题选项不被行内公式拆行');
        }
        if (index === 10) check(!question.stem.includes('\n') && question.stem.includes('$x$ 为 $12.1$') && question.options[0].includes(String.fromCharCode(96) + '4141 9999H' + String.fromCharCode(96)), '第 14 题小数、变量及编码完整');
        if (index === 11) {
          check(question.stem.includes('普通 段落 文字\n显式换行\n\n第二段'), '折叠排版空白并保留显式换行和段落');
          check(question.stem.includes('while (x) {\n  x--;\n\n\n  y++;\n}'), '代码的缩进和连续空行保留');
          check(question.stem.includes('| x y | 1<br>2 |'), '表格保留单元格、源码空白和显式换行');
        }
        continue;
      }
      if (index === 0) { check(question.stem.includes('$x^2$') && !question.hasBase64Image, '保留已有 LaTeX'); continue; }
      const sources = Array.from(question.stem.matchAll(/data:image[/][^)]+/g), match => match[0]);
      check(sources.length === 1 && question.hasBase64Image, '题目 ' + (index + 1) + ' 生成完整图片（数量 ' + sources.length + '，图片标记 ' + question.hasBase64Image + '）');
      const image = new Image();
      image.src = sources[0];
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let dark = 0, red = 0, blue = 0;
      for (let offset = 0; offset < pixels.length; offset += 4) {
        if (!pixels[offset + 3]) continue;
        if (Math.min(pixels[offset], pixels[offset + 1], pixels[offset + 2]) < 180) dark++;
        if (pixels[offset] > 180 && pixels[offset + 1] < 70 && pixels[offset + 2] < 70) red++;
        if (pixels[offset + 2] > 180 && pixels[offset] < 70 && pixels[offset + 1] < 70) blue++;
      }
      check(dark > 100, '题目 ' + (index + 1) + ' 图片非空白');
      if (index === 1) {
        check(question.stem.includes('开始![公式]') && question.stem.endsWith('结束'), '无原文公式保留在题干原位置');
        check(image.naturalHeight > 80, '分式没有按行高裁切');
        let denominator = 0;
        const lower = context.getImageData(0, Math.floor(canvas.height * 0.65), canvas.width, Math.ceil(canvas.height * 0.35)).data;
        for (let offset = 0; offset < lower.length; offset += 4) if (lower[offset + 3] > 0 && Math.min(lower[offset], lower[offset + 1], lower[offset + 2]) < 180) denominator++;
        check(denominator > 60, '分母区域保留了文字');
      }
      if (index === 2) check(red > 45000, 'SVG 内的 HTML 图片完整保留');
      if (index === 3) {
        check(image.naturalWidth === 2902 && image.naturalHeight === 1490, '多图片题尺寸正确');
        check(red > 900000 && blue > 900000, '56 个内嵌图片完整保留');
        for (let label = 0; label < 56; label++) {
          const x = (20 + label % 7 * 200 + 80) * 2;
          const y = (20 + Math.floor(label / 7) * 90 + 30) * 2;
          const color = context.getImageData(x, y, 1, 1).data;
          check(label % 2 ? color[2] > 180 && color[0] < 70 : color[0] > 180 && color[2] < 70, '标签 ' + (label + 1) + ' 位置正确');
        }
      }
      if (index === 4) check(blue > 15000, '作用域样式、平移和 viewBox 保留');
      if (index === 5) check(dark > 300, 'HTML 文字标签没有丢失');
      image.style.cssText = 'max-width:900px;display:block;margin:12px 0;border:1px solid #ddd';
      images.append(image);
    }
    check(!document.querySelector('[data-daguanyuan-capture]'), '离屏布局已清理');
    output.textContent = JSON.stringify({ passed: true, checks: checks.length, details: checks }, null, 2);
    state.cancel('rich-test');
  } catch (error) { output.textContent = JSON.stringify({ passed: false, error: error.message, checks }, null, 2); }
};
document.querySelector('#run-single').onclick = async function () {
  const output = document.querySelector('#single-result');
  const checks = [];
  function check(ok, message) { if (!ok) throw Error(message); checks.push(message); }
  async function read(state, token) {
    for (let i = 0; i < 3500; i++) {
      const value = JSON.parse(state.read(token));
      if (value.ready || value.error) return value;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw Error('验证超时');
  }
  try {
    output.textContent = '验证中';
    const original = location.href;
    for (const scenario of ['year', 'knowledge', 'missing', 'ambiguous']) {
      history.replaceState(null, '', scenario === 'knowledge' ? '/exercise?knowledgeId=125' : '/exercise?year=2026&scenario=' + scenario);
      document.querySelector('#requests').textContent = '';
      const target = { provider: '408', year: 2026, number: scenario === 'missing' ? 99 : 4, url: location.href };
      const token = 'single-' + scenario;
      check(eval(__DAGUANYUAN_408_PAGE_GLOBAL__.pageScript(token, target)) === 'true', scenario + ' 网页连接成功');
      const state = window.__DAGUANYUAN_408_IMPORT_PAGE__;
      const listingStatus = await read(state, token);
      if (scenario === 'missing' || scenario === 'ambiguous') {
        check(listingStatus.error.includes('无法唯一确定'), scenario + ' 不会猜测题号');
        state.cancel(token); continue;
      }
      check(!listingStatus.error, scenario + ' 单题列表读取成功');
      const listing = JSON.parse(state.payload);
      check(listing.ids.length === 1 && listing.ids[0] === 4, scenario + ' 列表只保留点击题目');
      if (scenario === 'knowledge') check(document.querySelector('#requests').textContent === '1', '找到单题后不再读取剩余知识点分页');
      check(state.prepare(token, 0), scenario + ' 转换仅有的一题');
      const status = await read(state, token);
      check(!status.error, scenario + ' 图文转换成功');
      const question = JSON.parse(state.payload).question;
      check(question.id === 4 && question.hasBase64Image, scenario + ' 56 图题保留图片');
      const image = new Image();
      image.src = question.stem.match(/data:image[/][^)]+/)[0];
      await image.decode();
      check(image.naturalWidth === 2902 && image.naturalHeight === 1490, scenario + ' 图像尺寸完整');
      state.cancel(token);
    }
    history.replaceState(null, '', original);
    output.textContent = JSON.stringify({ passed: true, checks: checks.length, details: checks }, null, 2);
  } catch (error) { output.textContent = JSON.stringify({ passed: false, error: error.message, checks }, null, 2); }
};`;
http.createServer((request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${port}`);
  let content, type = 'text/javascript; charset=utf-8';
  if (url.pathname === '/exercise') {
    type = 'text/html; charset=utf-8';
    content = '<!doctype html><meta charset="utf-8"><title>408 图文回归验证</title><style>pre{max-height:180px;overflow:auto}</style><script type="module" src="/assets/index-rich.js"></script><button id="run-single">运行单题验证</button><pre id="single-result">等待单题验证</pre><span id="requests" hidden></span><button id="run">运行验证</button><pre id="result">等待验证</pre><div id="images"></div><script src="/page.js"></script><script src="/markdown.js"></script><script src="/client.js"></script>';
  } else if (url.pathname === '/page.js') {
    content = fs.readFileSync(path.join(root, 'src/Daguanyuan408Page.js'), 'utf8').replace('startURL.hostname !== "www.408os.cn"', 'startURL.hostname !== "127.0.0.1"');
  } else if (url.pathname === '/markdown.js') content = fs.readFileSync(path.join(root, 'src/DaguanyuanMathImport.js'), 'utf8');
  else if (url.pathname === '/client.js') content = client;
  else if (url.pathname === '/assets/index-rich.js') content = 'const rows=' + JSON.stringify(rows) + ';const formatRows=' + JSON.stringify(formatRows) + '; export const r={async get(url, options){if(url.includes("by-knowledge")){document.querySelector("#requests").textContent+=options.params.pageNum;return {rows,total:47000}}return location.search.includes("scenario=ambiguous")?rows.concat([rows[3]]):rows.concat(formatRows)}}';
  else if (url.pathname === '/red.svg' || url.pathname === '/blue.svg') {
    type = 'image/svg+xml';
    content = '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="80"><rect width="160" height="80" fill="' + (url.pathname === '/red.svg' ? 'red' : 'blue') + '"/></svg>';
  } else { response.writeHead(404); response.end('missing'); return; }
  response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  response.end(content);
}).listen(port, '127.0.0.1', () => console.log(`408 图文回归验证：http://127.0.0.1:${port}/exercise?year=2026`));
