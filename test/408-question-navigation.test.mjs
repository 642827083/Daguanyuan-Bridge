import { withMathSite } from './helpers/math-site.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const panel = withMathSite(fs.readFileSync(new URL('../src/WebPanelController.js', import.meta.url), 'utf8'));
const routes = withMathSite(fs.readFileSync(new URL('../src/Daguanyuan408Routes.js', import.meta.url), 'utf8'));
function open(route) {
  let address;
  const context = { showPanel() {}, loadURL(controller, url) { address = url; }, showMessage() {} };
  vm.createContext(context); vm.runInContext(routes, context);
  const start = panel.indexOf('function openDaguanyuanQuestion(controller, route)');
  vm.runInContext(panel.slice(start, panel.indexOf('function open408Question', start)), context);
  context.openDaguanyuanQuestion({}, route);
  return address;
}
test('408 知识点题卡进入真实分类，使用实际题目 ID，不携带年份切题参数或返回入口参数', () => {
  const address = open({ imported: true, provider: '408', questionId: 419, year: 2017,
    url: 'https://www.408os.cn/exercise?knowledgeId=53&knowledgeName=数据类型转换&questionId=13' });
  const url = new URL(address);
  assert.equal(url.searchParams.has('year'), false);
  assert.equal(url.searchParams.get('daguanyuanQuestionId'), '419');
  assert.equal(url.searchParams.has('questionId'), false);
  assert.equal(url.searchParams.get('knowledgeId'), '53');
  assert.equal(url.searchParams.get('knowledgeName'), '数据类型转换');
  assert.equal(url.searchParams.has('daguanyuanKnowledgeSource'), false);
});

test('知识点来源兼容原始中文、转义符号和单题再次导入，返回地址不携带旧题号', () => {
  const context = vm.createContext({}); vm.runInContext(routes, context);
  const api = context.__DAGUANYUAN_408_ROUTES_GLOBAL__;
  for (const name of ['计算机性能指标', 'R(P) & W(Q) + 100%', '<变量>']) {
    const source = 'https://www.408os.cn/exercise?knowledgeId=53&knowledgeName=' + encodeURIComponent(name) + '&questionId=13#old';
    const detail = api.detailURL(source, 843, 2026);
    assert.equal(api.knowledgeSource(detail).name, name);
    assert.equal(new URL(api.knowledgeSource(detail).url).searchParams.has('questionId'), false);
    assert.equal(api.detailURL(detail, 843, 2026), detail);
    assert.equal(api.detailURL(detail, 842, 2026), detail.replace('daguanyuanQuestionId=843', 'daguanyuanQuestionId=842'));
  }
});

test('无名称的旧知识点来源使用 ID 标识，非法来源和题本不伪造知识点', () => {
  const context = vm.createContext({}); vm.runInContext(routes, context);
  const api = context.__DAGUANYUAN_408_ROUTES_GLOBAL__;
  assert.equal(api.knowledgeSource('https://www.408os.cn/exercise?knowledgeId=53').name, '知识点 53');
  for (const address of [
    'https://www.408os.cn/exercise?year=2026',
    'https://www.408os.cn/exercise?knowledgeId=-1',
    'https://www.408os.cn/exercise?knowledgeId=999999999999999999',
    'https://www.408os.cn/exercise?knowledgeId=53&mode=collection',
    'https://www.408os.cn/exercise?questionId=843&daguanyuanKnowledgeSource=%XX',
    'https://www.408os.cn/exercise?daguanyuanKnowledgeSource=' + encodeURIComponent('https://example.com/exercise?knowledgeId=53'),
    'https://www.408os.cn/exercise?daguanyuanKnowledgeSource=' + encodeURIComponent('https://www.408os.cn/exercise?daguanyuanKnowledgeSource=other'),
  ]) assert.equal(api.knowledgeSource(address), null);
});
test('408 年份题卡按实际 ID 直接打开，不走整卷滚动定位，保留年份参数', () => {
  assert.equal(open({ imported: true, provider: '408', questionId: 843,
    url: 'https://www.408os.cn/exercise?year=2026&questionId=13' }),
    'https://www.408os.cn/exercise?year=2026&questionId=843');
});

test('上一测试包保存的来源参数也还原为真实知识点入口', () => {
  const source = 'https://www.408os.cn/exercise?knowledgeId=53&knowledgeName=' + encodeURIComponent('数据类型转换');
  const legacy = 'https://www.408os.cn/exercise?year=2017&questionId=419&daguanyuanKnowledgeSource=' + encodeURIComponent(source);
  assert.equal(open({ imported: true, provider: '408', questionId: 419, year: 2017, url: legacy }), source + '&daguanyuanQuestionId=419');
});

test('知识点定位保留原有题目来源范围，旧题卡和再次导入也不会丢失', () => {
  const context = vm.createContext({}); vm.runInContext(routes, context);
  const api = context.__DAGUANYUAN_408_ROUTES_GLOBAL__;
  for (const scope of ['overview', 'question-bank', '来源 & 范围+测试']) {
    const source = 'https://www.408os.cn/exercise?knowledgeId=53&knowledgeName=' + encodeURIComponent('数据类型转换')
      + '&sourcePage=' + encodeURIComponent(scope) + '&questionId=419';
    const legacy = 'https://www.408os.cn/exercise?year=2017&questionId=419&daguanyuanKnowledgeSource=' + encodeURIComponent(source);
    for (const input of [source, legacy]) {
      const address = open({ imported: true, provider: '408', questionId: 419, year: 2017, url: input });
      assert.equal(new URL(address).searchParams.get('sourcePage'), scope);
      assert.equal(new URL(address).searchParams.get('knowledgeId'), '53');
      assert.equal(new URL(address).searchParams.has('year'), false);
      assert.equal(api.detailURL(address, 640, 2022), address.replace('daguanyuanQuestionId=419', 'daguanyuanQuestionId=640'));
      assert.equal(new URL(api.knowledgeSource(address).url).searchParams.get('sourcePage'), scope);
    }
  }
  const all = api.detailURL('https://www.408os.cn/exercise?knowledgeId=53', 419, 2017);
  assert.equal(new URL(all).searchParams.has('sourcePage'), false, '原本未限定范围的来源不强制改为只有真题');
});
