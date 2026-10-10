import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

async function page(question, options = {}) {
  const requests = [], entry = 'https://www.408os.cn/assets/index-test.js';
  const { document } = parseHTML('<html><head><script type="module" src="' + entry + '"></script></head><body></body></html>');
  class DOMParser { parseFromString(html) { return parseHTML(/<html/i.test(html) ? html : '<html><head></head><body>' + html + '</body></html>').document; } }
  const context = { URL, Map, Set, console, document, DOMParser,
    window: { location: { href: options.url || 'https://www.408os.cn/exercise?year=2026' }, setTimeout, clearTimeout,
      async fetch(url) {
        requests.push(url);
        return { ok: !options.failAnswer || !url.includes('/answers/'), status: 403, async text() {
          if (url === entry) return 'import{r}from"./wdQuestionContent-test.js";';
          return url.includes('/answers/') ? '<p>标准答案 C</p>' : url.includes('/questions/') ? '<p>完整静态题干</p><img src="https://oss.408os.cn/diagram.png">' : '<p>解析过程</p>';
        } };
      } },
    Function() { return async url => url === entry ? { r: { async get() { return options.url ? { data: { total: 1, rows: [{ question }] } } : [{ question }]; } } }
      : { r() { return { question: { content: '<p>结构化题干</p>', options: [] }, analysis: '<p>结构化解析</p>' }; } }; },
  };
  vm.createContext(context); vm.runInContext(readFileSync(new URL('../src/Daguanyuan408Page.js', import.meta.url), 'utf8'), context);
  vm.runInContext(context.__DAGUANYUAN_408_PAGE_GLOBAL__.pageScript('answer-test', null, options.workspace), context);
  const state = context.window.__DAGUANYUAN_408_IMPORT_PAGE__;
  async function wait() {
    for (let i = 0; i < 40 && !state.ready && !state.error; i++) await new Promise(resolve => setImmediate(resolve));
    assert.ok(state.ready || state.error);
  }
  await wait(); assert.equal(state.error, '');
  return { requests, listing: JSON.parse(state.payload), async prepare(content) { assert.equal(state.prepare('answer-test', 0, content), true); await wait(); return { error: state.error, question: state.ready ? JSON.parse(state.payload).question : null }; } };
}

test('408 导入页完整预览静态题干和题图地址，保留年份题型，不预先下载答案或题图', async () => {
  const run = await page({ id: 81, year: 2026, questionIndex: 41, questionType: 2, mdContent: '/static/questions/2026/41.html', answerText: '/static/answers/2026/41.html' }, { workspace: true });
  assert.equal(run.listing.previews[81].stem, '完整静态题干');
  assert.deepEqual(Array.from(run.listing.previews[81].images), ['https://oss.408os.cn/diagram.png']);
  assert.equal(run.listing.metadata[81].questionType, 'subjective');
  assert.equal(run.listing.metadata[81].year, 2026);
  assert.equal(run.requests.length, 2);
  assert.ok(run.requests.every(url => !url.includes('/answers/') && !url.includes('oss.408os.cn')));
});

test('408 真实网页转换按内容选项加载静态答案解析，仅题目不发答案请求', async () => {
  const run = await page({ id: 81, year: 2026, questionIndex: 1, mdContent: '<p>题干</p>', answerText: '/static/answers/2026/1.html', analysisText: '/static/analysis/2026/1.html' });
  const only = await run.prepare('question'); assert.equal(only.error, ''); assert.equal(only.question.answer, undefined); assert.equal(run.requests.length, 1);
  const both = await run.prepare('questionAnswer'); assert.equal(both.error, ''); assert.equal(both.question.answer, '标准答案 C'); assert.equal(both.question.explanation, '解析过程');
  assert.equal(run.requests.filter(url => url.includes('/static/')).length, 2);
});

test('408 结构化解析和普通答案保留；答案请求失败返回错误，不伪造成功', async () => {
  const structured = await page({ id: 81, contentJson: '{}', answer: 'C' });
  const parsed = await structured.prepare('questionAnswer'); assert.equal(parsed.error, ''); assert.equal(parsed.question.answer, 'C'); assert.equal(parsed.question.explanation, '结构化解析');
  const failed = await page({ id: 81, mdContent: '<p>题干</p>', answerText: '/static/answers/2026/1.html' }, { failAnswer: true });
  assert.equal((await failed.prepare('question')).error, '');
  assert.match((await failed.prepare('questionAnswer')).error, /403/);
});


test('408 当前页选题支持题本，但确认前不生成预览也不请求题图', async () => {
  const run = await page({ id: 81, year: 2010, questionIndex: 34, mdContent: '/static/questions/2010/34.html' },
    { url: 'https://www.408os.cn/exercise?mode=collection&collectionId=4', workspace: 'page' });
  assert.deepEqual(Array.from(run.listing.ids), [81]); assert.equal(run.listing.previews, undefined);
  assert.equal(run.requests.length, 1); assert.ok(!run.requests.some(url => url.includes('/static/questions/')));
});
