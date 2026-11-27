// 通过无头浏览器验证真实 MutationObserver；不访问题库账号或 MarginNote 数据。
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const context = {};
vm.createContext(context);
for (const name of ['DaguanyuanMathSite', 'DaguanyuanCategoryRoutes', 'DaguanyuanWebsiteBridge']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'src', name + '.js'), 'utf8'), context);
}
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'daguanyuan-mutation-check-'));
const file = path.join(directory, 'check.html');
const script = context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__.questionDOMScript();
const checks = async function () {
  const sleep = () => new Promise(resolve => setTimeout(resolve, 25));
  let count = 0;
  const dom = window.__DAGUANYUAN_QUESTION_DOM__;
  const observer = dom.observeChanges(() => {
    count++;
    let button = document.querySelector('[data-daguanyuan-question-target]');
    if (!button) {
      button = document.createElement('button'); button.setAttribute('data-daguanyuan-question-target', '');
      document.querySelector('[data-learning-question-id]').appendChild(button);
    }
    button.textContent = '更新 ' + count;
  });
  const require = (value, message) => { if (!value) throw Error(message + ': ' + count); };
  for (let i = 0; i < 100; i++) document.getElementById('clock').textContent = String(i);
  document.getElementById('dgy-dialog').innerHTML = '<p>导入进度</p>';
  document.querySelector('[data-daguanyuan-question-target]').textContent = '定位中';
  await sleep(); require(count === 0, '无关变动触发扫描');
  document.querySelector('[data-question-source]').textContent = '新来源';
  await sleep(); require(count === 1, '未响应题目变动');
  await sleep(); require(count === 1, '插件自身写入导致循环');
  document.querySelector('[data-learning-question-id]').setAttribute('data-learning-question-id', '43');
  await sleep(); require(count === 2, '未响应翻题属性');
  const dialog = document.createElement('section'); dialog.setAttribute('role', 'dialog'); dialog.innerHTML = '<h2>题目 99</h2>';
  document.body.appendChild(dialog); await sleep(); require(count === 3, '未响应搜索弹窗');
  dialog.remove(); await sleep(); require(count === 4, '未响应关闭弹窗');
  document.querySelector('main').setAttribute('inert', ''); await sleep(); require(count === 5, '未响应祖先可见性');
  const marker = document.createElement('div'); marker.id = 'dgy-toolbar'; document.body.appendChild(marker);
  await sleep(); require(count === 5, '插件入口插入触发扫描');
  document.querySelector('[data-daguanyuan-question-target]').remove();
  await sleep(); require(count === 6 && document.querySelector('[data-daguanyuan-question-target]'), '网站移除按钮后未恢复');
  await sleep(); require(count === 6, '恢复按钮后循环扫描');
  observer.disconnect();
  document.getElementById('result').textContent = 'PASS: 无关变化0次，相关变化6次，按钮移除后恢复且无循环';
};
fs.writeFileSync(file, '<!doctype html><meta charset="utf-8"><body><aside id="clock">时钟</aside><main><li data-learning-question-id="42"><span data-question-source>来源</span><button data-daguanyuan-question-target>定位卡片</button></li></main><div id="dgy-dialog"></div><pre id="result">RUNNING</pre><script>'
  + script.replace(/<\/script/gi, '<\\/script') + '(' + checks.toString() + ')().catch(error=>document.getElementById("result").textContent="FAIL: "+error.message);</script>');
const browser = process.env.CHROME_BIN || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const output = execFileSync(browser, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--user-data-dir=' + path.join(directory, 'profile'), '--virtual-time-budget=3000', '--dump-dom', pathToFileURL(file).href],
{ encoding: 'utf8', timeout: 30000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
const result = /<pre id="result">([^<]+)<\/pre>/.exec(output)?.[1];
if (!result?.startsWith('PASS:')) throw Error(result || '浏览器没有返回检查结果');
console.log(result);
