import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function runtime(response) {
  let now = 0, active = 0, maxActive = 0;
  const requests = [], waits = [];
  class Clock extends Date { static now() { return now; } }
  const context = {
    Date: Clock,
    NSTimer: { scheduledTimerWithTimeInterval(seconds, repeat, callback) {
      assert.equal(repeat, false); waits.push(seconds);
      queueMicrotask(() => { now += seconds * 1000; callback(); });
      return { invalidate() {} };
    } },
    NSURL: { URLWithString: url => url },
    NSMutableURLRequest: { requestWithURL: url => ({ url, setHTTPMethod() {}, setTimeoutInterval() {}, setAllHTTPHeaderFields() {} }) },
    NSOperationQueue: { mainQueue: () => ({}) },
    NSJSONSerialization: { JSONObjectWithDataOptions: data => data.payload },
    NSURLConnection: { sendAsynchronousRequestQueueCompletionHandler(request, queue, callback) {
      requests.push({ url: request.url, at: now });
      maxActive = Math.max(maxActive, ++active);
      const reply = response ? response(requests, now) : { status: 200 };
      queueMicrotask(() => {
        active--;
        callback({ statusCode: reply.status, allHeaderFields: reply.headers || {} },
          { length: 100, payload: { id: Number(request.url.split('/').pop()), category_id: 1, stem: '题干' } }, null);
      });
    } },
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL('../src/DaguanyuanMathApi.js', import.meta.url), 'utf8'), context);
  return { api: context.__DAGUANYUAN_MATH_API_GLOBAL__, requests, waits, get maxActive() { return maxActive; } };
}

test('正常批量请求保持并发，不增加固定间隔或等待定时器', async () => {
  const run = runtime();
  const questions = await Promise.all(Array.from({ length: 10 }, (_, i) => run.api.questionDetail(i + 1)));
  assert.equal(questions.length, 10);
  assert.equal(run.requests.length, 10);
  assert.equal(run.waits.length, 0);
  assert.equal(run.maxActive, 10);
  assert.ok(run.requests.every(request => request.at === 0));
});

test('只在 429 时按服务器 Retry-After 等待，恢复后不增加正常请求间隔', async () => {
  const run = runtime(requests => requests.length === 1 ? { status: 429, headers: { 'retry-after': '3' } } : { status: 200 });
  const questions = [await run.api.questionDetail(7641), await run.api.questionDetail(7642)];
  assert.deepEqual(questions.map(q => q.id), [7641, 7642]);
  assert.equal(run.requests.length, 3);
  assert.ok(run.requests[1].at >= 3000);
  assert.equal(run.requests[2].at, run.requests[1].at);
});

test('重试次数有限，持续 429 明确提示稍后重试；404 不重试且不阻塞下一请求', async () => {
  const limited = runtime(() => ({ status: 429 }));
  await assert.rejects(limited.api.questionDetail(7641), /限流|频繁/);
  assert.ok(limited.requests.length > 1 && limited.requests.length <= 4);
  const missing = runtime(requests => ({ status: requests.length === 1 ? 404 : 200 }));
  await assert.rejects(missing.api.questionDetail(7641), /404/);
  assert.equal((await missing.api.questionDetail(7642)).id, 7642);
  assert.equal(missing.requests.length, 2);
});

test('HTTP 日期 Retry-After 得到尊重；长时间限流不提前重试', async () => {
  const run = runtime(requests => requests.length === 1 ? { status: 429, headers: { 'Retry-After': new Date(4000).toUTCString() } } : { status: 200 });
  await run.api.questionDetail(7641);
  assert.ok(run.requests[1].at >= 4000);
  const long = runtime(() => ({ status: 429, headers: { 'Retry-After': '3600' } }));
  await assert.rejects(long.api.questionDetail(7641), /等待.*3600/);
  assert.equal(long.requests.length, 1);
});

test('限流等待期间停止导入，取消并发请求的重试', async () => {
  const run = runtime(() => ({ status: 429, headers: { 'Retry-After': '30' } }));
  const check = () => { if (run.waits.length) { const error = new Error('已停止导入'); error.stopImport = true; throw error; } };
  const results = await Promise.allSettled([run.api.questionDetail(7641, 'question', undefined, check), run.api.questionDetail(7642, 'question', undefined, check)]);
  assert.ok(results.every(result => result.status === 'rejected' && /已停止/.test(result.reason.message)));
  assert.equal(run.requests.length, 2);
});
