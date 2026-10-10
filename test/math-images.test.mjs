import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function pageRuntime(status = 200, type = 'image/png') {
  const requests = [], releases = [], evaluations = [];
  class Reader {
    readAsDataURL(blob) { blob.arrayBuffer().then(bytes => { this.result = 'data:' + blob.type + ';base64,' + Buffer.from(bytes).toString('base64'); this.onload(); }); }
  }
  const browser = { window: { location: { origin: 'https://www.cxyonly.fans' }, setTimeout, clearTimeout,
    localStorage: { getItem(key) { return key === 'daguan_token' ? 'TEST_AUTH_TOKEN' : ''; } },
    async fetch(url, options) { requests.push({ url, options }); return { status, ok: status === 200, async blob() { return new Blob([new Uint8Array(70000)], { type }); } }; } },
    AbortController, FileReader: Reader };
  vm.createContext(browser);
  const context = { __DAGUANYUAN_MATH_IMAGE_PAGE_SCRIPT__: fs.readFileSync(new URL('../web/src/DaguanyuanMathImagePage.js', import.meta.url), 'utf8'),
    __DAGUANYUAN_IMPORT_SELECTION_GLOBAL__: { async evaluate(controller, script) {
      evaluations.push(script); if (script.includes('.release(')) releases.push(script);
      return vm.runInContext(script, browser);
    } },
    NSTimer: { scheduledTimerWithTimeInterval(interval, repeats, fn) { const timer = setTimeout(fn, interval < 1 ? 0 : interval * 1000); return { invalidate() { clearTimeout(timer); } }; } },
  };
  vm.createContext(context); vm.runInContext(fs.readFileSync(new URL('../src/DaguanyuanMathImages.js', import.meta.url), 'utf8'), context);
  return { context, browser, requests, releases, evaluations, read: context.__DAGUANYUAN_MATH_IMAGES_GLOBAL__.reader({ webView: {} }) };
}

test('实际网页读取器带登录状态下载图片并按 64 KiB 分块，多个并发图片不串数据且完成后释放', async () => {
  const run = pageRuntime();
  const data = await Promise.all(['a', 'b'].map(char => run.read('asset://sha256/' + char.repeat(64))));
  assert.ok(data.every(image => image.startsWith('data:image/png;base64,') && image.length > 65536));
  assert.equal(run.requests.length, 2); assert.ok(run.requests.every(request => request.options.credentials === 'include'));
  assert.ok(run.requests.every(request => request.options.headers.Authorization === 'Bearer TEST_AUTH_TOKEN' && request.options.redirect === 'error'));
  assert.ok(run.evaluations.every(script => !script.includes('TEST_AUTH_TOKEN')));
  assert.ok(run.requests.every(request => /^\/api\/v1\/question-assets\/[a-f0-9]{64}$/.test(request.url)));
  assert.equal(run.evaluations.filter(script => script.includes('.chunk(')).length, 4);
  assert.equal(run.releases.length, 2);
});

for (const [status, text] of [[401, '登录'], [403, '权限'], [428, '访问验证'], [404, '404']]) test('图片网页响应 ' + status + ' 明确提示且释放传输状态', async () => {
  const run = pageRuntime(status);
  await assert.rejects(run.read('asset://sha256/' + 'a'.repeat(64)), new RegExp(text));
  assert.equal(run.releases.length, 1);
});

test('图片页面切到外站、格式不支持或导入取消时拒绝继续读取', async () => {
  const wrong = pageRuntime(); wrong.browser.window.location.origin = 'https://example.com';
  await assert.rejects(wrong.read('asset://sha256/' + 'a'.repeat(64)), /数学题库网页/); assert.equal(wrong.requests.length, 0);
  const invalid = pageRuntime(200, 'text/html');
  await assert.rejects(invalid.read('asset://sha256/' + 'a'.repeat(64)), /格式不支持/);
  const cancelled = pageRuntime();
  const reader = cancelled.context.__DAGUANYUAN_MATH_IMAGES_GLOBAL__.reader({ webView: {} }, () => { throw Error('已停止导入'); });
  assert.throws(() => reader('asset://sha256/' + 'a'.repeat(64)), /已停止导入/);
  assert.equal(cancelled.requests.length, 0);
});

test('实际单题入口对1716使用网页登录图片传输后建卡，原生端仅请求公开题干', async () => {
  const run = pageRuntime(), context = run.context, requests = [], written = [];
  Object.assign(context, {
    NSURL: { URLWithString(url) { return url; } },
    NSMutableURLRequest: { requestWithURL(url) { return { url, setHTTPMethod() {}, setTimeoutInterval() {}, setAllHTTPHeaderFields() {} }; } },
    NSOperationQueue: { mainQueue() { return {}; } },
    NSJSONSerialization: { JSONObjectWithDataOptions(data) { return data.question; } },
    NSURLConnection: { sendAsynchronousRequestQueueCompletionHandler(request, queue, done) {
      requests.push(request.url);
      if (request.url.includes('question-assets')) done({ statusCode: 401 }, null, { localizedDescription: 'NSURLErrorDomain 错误 -1012' });
      else done({ statusCode: 200 }, { length: 100, question: { id: 1716, category_id: 1, stem: '![图](asset://sha256/' + 'a'.repeat(64) + ')' } }, null);
    } },
    NSUserDefaults: { standardUserDefaults() { return { objectForKey() { return 'child'; } }; } },
    __DAGUANYUAN_MATH_IMPORT_GLOBAL__: { preparedSingleSession() { return { targetTitle: '学习集', hasQuestion() { return false; }, write(question) { written.push(question); return true; } }; }, selectQuestions() {} },
  });
  for (const file of ['DaguanyuanMathApi', 'DaguanyuanSingleImport']) vm.runInContext(fs.readFileSync(new URL('../src/' + file + '.js', import.meta.url), 'utf8'), context);
  const result = await context.__DAGUANYUAN_SINGLE_IMPORT_GLOBAL__.importQuestion({ addon: {}, webView: {} }, { provider: 'math', id: 1716, url: 'https://www.cxyonly.fans/math/practice/1' });
  assert.equal(result.createdCount, 1); assert.equal(result.failed.length, 0); assert.equal(requests.length, 1);
  assert.match(written[0].stem, /data:image\/png;base64/); assert.equal(run.requests[0].options.headers.Authorization, 'Bearer TEST_AUTH_TOKEN');
});

test('1716 图片需要网页登录状态时使用页面读取器，原生未认证图片请求不再触发 -1012', async () => {
  const hash = 'a'.repeat(64), requests = [], pageRequests = [];
  const context = {
    NSURL: { URLWithString(url) { return url; } },
    NSMutableURLRequest: { requestWithURL(url) { return { url, setHTTPMethod() {}, setTimeoutInterval() {}, setAllHTTPHeaderFields() {} }; } },
    NSOperationQueue: { mainQueue() { return {}; } },
    NSJSONSerialization: { JSONObjectWithDataOptions(data) { return data.question; } },
    NSURLConnection: { sendAsynchronousRequestQueueCompletionHandler(request, queue, done) {
      requests.push(request.url);
      if (request.url.endsWith(hash)) done({ statusCode: 401 }, null, { localizedDescription: 'NSURLErrorDomain 错误 -1012' });
      else done({ statusCode: 200 }, { length: 100, question: { id: 1716, category_id: 1, stem: '![图](asset://sha256/' + hash + ')' } }, null);
    } },
  };
  vm.createContext(context); vm.runInContext(fs.readFileSync(new URL('../src/DaguanyuanMathApi.js', import.meta.url), 'utf8'), context);
  const question = await context.__DAGUANYUAN_MATH_API_GLOBAL__.questionDetail(1716, 'question', async reference => {
    pageRequests.push(reference); return 'data:image/png;base64,AQIDBAUGBwg=';
  });
  assert.match(question.stem, /data:image\/png;base64/); assert.equal(question.hasBase64Image, true);
  assert.equal(requests.length, 1); assert.equal(pageRequests.length, 1);
});
