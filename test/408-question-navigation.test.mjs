import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const panel = fs.readFileSync(new URL('../src/WebPanelController.js', import.meta.url), 'utf8');
const routes = fs.readFileSync(new URL('../src/Daguanyuan408Routes.js', import.meta.url), 'utf8');
function open(route) {
  let address;
  const context = { showPanel() {}, loadURL(controller, url) { address = url; }, showMessage() {} };
  vm.createContext(context); vm.runInContext(routes, context);
  const start = panel.indexOf('function openDaguanyuanQuestion(controller, route)');
  vm.runInContext(panel.slice(start, panel.indexOf('function open408Question', start)), context);
  context.openDaguanyuanQuestion({}, route);
  return address;
}
test('408 已导入卡片用实际题目 ID 打开单题，不保留会优先加载分类第一页的知识点参数', () => {
  const address = open({ imported: true, provider: '408', questionId: 419, year: 2017,
    url: 'https://www.408os.cn/exercise?knowledgeId=53&knowledgeName=数据类型转换&questionId=13' });
  assert.equal(address, 'https://www.408os.cn/exercise?year=2017&questionId=419');
});
test('408 年份题卡保留年份，实际 ID 优先于旧链接中的 ID', () => {
  assert.equal(open({ imported: true, provider: '408', questionId: 843,
    url: 'https://www.408os.cn/exercise?year=2026&questionId=13' }),
    'https://www.408os.cn/exercise?year=2026&questionId=843');
});
