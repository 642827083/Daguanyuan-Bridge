import { withMathSite } from './helpers/math-site.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function runtime() {
  const requests = [];
  const context = {
    NSTimer: { scheduledTimerWithTimeInterval(seconds, repeats, callback) { queueMicrotask(callback); return { invalidate() {} }; } },
    NSURL: { URLWithString(url) { return url; } },
    NSMutableURLRequest: { requestWithURL(url) { return { url, setHTTPMethod() {}, setTimeoutInterval() {}, setAllHTTPHeaderFields() {} }; } },
    NSOperationQueue: { mainQueue() { return {}; } },
    NSJSONSerialization: { JSONObjectWithDataOptions(data) { return data.payload; } },
    NSURLConnection: { sendAsynchronousRequestQueueCompletionHandler(request, queue, done) {
      requests.push(request.url); done({ statusCode: 200 }, { length: 100, payload: request.url.includes('/categories?')
        ? [{ id: 1, parent_id: null, name: '高等数学', children: [{ id: 2, parent_id: 1, name: '公共知识点', children: [] }] }]
        : { data: { total: 1, items: [{ id: 7, category_id: 2, source: '2020年·数三', stem: '三科共用题目' }] } } }, null);
    } },
  };
  vm.createContext(context); vm.runInContext(withMathSite(fs.readFileSync(new URL('../src/DaguanyuanMathApi.js', import.meta.url), 'utf8')), context);
  return { api: context.__DAGUANYUAN_MATH_API_GLOBAL__, requests, context };
}

test('四种科目、三种范围都传递给网站分类和题目接口，不按真题来源二次过滤', async () => {
  const run = runtime();
  for (const subject of ['all', 'math_1', 'math_2', 'math_3']) for (const scope of ['complete', 'core', 'exam']) {
    const records = await run.api.categoryRecords(scope, subject);
    assert.deepEqual(Array.from(records, record => Array.from(record)), [[1, 0, '高等数学'], [2, 1, '公共知识点']]);
    assert.match(run.requests.at(-1), new RegExp('scope=' + scope + '&exam_subject=' + subject + '$'));
    const page = await run.api.questionPage(2, 1, scope, subject);
    assert.match(run.requests.at(-1), new RegExp('scope=' + scope + '&exam_subject=' + subject + '$'));
    assert.equal(page.questions[0].source, '2020年·数三'); assert.equal(page.questions[0].id, 7);
  }
});

test('旧入口未传科目沿用原请求，非法科目不请求网站，空分类目录作为合法无匹配结果', async () => {
  const run = runtime(); await run.api.questionPage(2, 1, 'core');
  assert.doesNotMatch(run.requests[0], /exam_subject/);
  const count = run.requests.length;
  assert.throws(() => run.api.questionPage(2, 1, 'core', 'math_4'), /科目无效/);
  assert.throws(() => run.api.categoryRecords('core', 'math_4'), /科目无效/);
  assert.equal(run.requests.length, count);
  run.context.NSJSONSerialization.JSONObjectWithDataOptions = () => [];
  assert.equal((await run.api.categoryRecords('core', 'math_2')).length, 0);
});

test('原生 JSON 的 NSNull 根分类父节点和空 children 能读取，子分类父节点仍须匹配', async () => {
  const run = runtime();
  run.context.NSNull = class NSNull {};
  const nativeNull = new run.context.NSNull();
  const tree = [{ id: 223, parent_id: nativeNull, name: '高等数学', children: [
    { id: 224, parent_id: 223, name: '函数极限', children: nativeNull },
  ] }];
  run.context.NSJSONSerialization.JSONObjectWithDataOptions = () => tree;
  const records = await run.api.categoryRecords('complete', 'math_2');
  assert.deepEqual(Array.from(records, row => Array.from(row)), [[223, 0, '高等数学'], [224, 223, '函数极限']]);
  tree[0].children[0].parent_id = nativeNull;
  await assert.rejects(run.api.categoryRecords('complete', 'math_2'), /分类目录格式无效/);
});
