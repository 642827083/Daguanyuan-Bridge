import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function browser(options = {}) {
  const requests = [], storage = new Map([['daguan_token', 'fixture-login-secret']]);
  const context = { URL, URLSearchParams, location: new URL('https://www.cxyonly.fans/math/practice'),
    localStorage: { getItem: key => storage.get(key) }, AbortController, setTimeout, clearTimeout,
    fetch: async (url, init) => { requests.push({ url, init }); return options.fetch ? options.fetch(url, init)
      : { ok: true, json: async () => [{ id: 1, parent_id: null, name: '高等数学', children: [] }] }; } };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source('web/src/DaguanyuanMathCatalogPage.js'), context);
  return { context, storage, requests, page: context.__DAGUANYUAN_MATH_CATALOG_PAGE__ };
}
test('题目分页与三个并发详情复用网页身份，互不取消且保留答案导入选项', async () => {
  const run = browser({ fetch: async url => ({ status: 200, ok: true, json: async () => url.includes('?')
    ? { data: { total: 1, items: [{ id: 1214, category_id: 1, stem: '题干' }] } }
    : { id: Number(url.split('/').at(-1)), category_id: 1, stem: '题干', correct_answer: 'C', answer_explanation: '解析' } }) });
  const native = { __DAGUANYUAN_MATH_CATALOG_PAGE_SCRIPT__: source('web/src/DaguanyuanMathCatalogPage.js'),
    NSTimer: { scheduledTimerWithTimeInterval(seconds, repeat, cb) { const timer = setTimeout(cb, seconds === 0.15 ? 1 : seconds * 1000); return { invalidate() { clearTimeout(timer); } }; } },
    NSURLConnection: { sendAsynchronousRequestQueueCompletionHandler() { throw Error('不应发送原生请求'); } } };
  vm.createContext(native);
  for (const name of ['DaguanyuanImportSelection', 'DaguanyuanMathApi']) vm.runInContext(source('src/' + name + '.js'), native);
  const scripts = [], controller = { webView: { evaluateJavaScript(script, cb) { scripts.push(script); try { cb(vm.runInContext(script, run.context), null); } catch (error) { cb(null, error); } } } };
  const api = native.__DAGUANYUAN_MATH_API_GLOBAL__;
  const page = await api.questionPage(1, 1, 'exam', 'math_2', controller);
  assert.equal(page.questions[0].id, 1214);
  const questions = await Promise.all([1214, 1215, 1216].map(id => api.questionDetail(id, 'questionAnswer', undefined, undefined, controller)));
  assert.deepEqual(questions.map(q => q.id), [1214, 1215, 1216]);
  assert.ok(questions.every(q => q.answer === 'C' && q.explanation === '解析'));
  assert.equal(run.requests.length, 4);
  assert.ok(run.requests.every(req => req.init.headers.Authorization === 'Bearer fixture-login-secret'));
  assert.doesNotMatch(scripts.join('\n'), /fixture-login-secret/);
});

test('网页只接受数学分类及题目 GET 地址，拒绝外站及写入接口', () => {
  const run = browser();
  for (const path of ['https://evil.test/api/questions/1', '/api/questions/1/state', '/api/auth/csrf', '/api/questions/1?token=secret']) {
    assert.throws(() => run.page.beginRead('request', path), /地址无效/);
  }
  assert.equal(run.requests.length, 0);
});

for (const path of ['/math/practice/core-math-2/326/566', '/math/practice/concepts/42?scope=core&examSubject=math_2']) test('真实网页登录分页读取未加载题目并仅下载勾选详情：' + path, async () => {
  const run = browser({ fetch: async address => {
    const url = new URL(address, 'https://www.cxyonly.fans');
    let payload;
    if (url.pathname === '/api/questions') {
      assert.equal(url.searchParams.get('scope'), 'core');
      assert.equal(url.searchParams.get('exam_subject'), 'math_2');
      if (path.includes('/concepts/')) { assert.equal(url.searchParams.get('concept_id'), '42'); assert.equal(url.searchParams.has('category_id'), false); }
      else {
        assert.equal(url.searchParams.get('category_id'), '566'); assert.equal(url.searchParams.get('include_children'), 'true');
        assert.equal(url.searchParams.get('question_list_id'), 'core-math-2');
      }
      const page = Number(url.searchParams.get('page'));
      const ids = page === 1 ? Array.from({ length: 20 }, (_, i) => i + 1) : [21];
      payload = { data: { total: 21, items: ids.map(id => ({ id, category_id: 566, stem: '题干', source: '题目 ' + id })) } };
    } else if (url.pathname === '/api/categories') payload = [{ id: 566, parent_id: null, name: '积分', children: [] }];
    else { assert.equal(url.pathname, '/api/questions/21'); payload = { id: 21, category_id: 566, stem: '所选题' }; }
    return { status: 200, ok: true, json: async () => payload };
  } });
  const native = { console, __DAGUANYUAN_MATH_CATALOG_PAGE_SCRIPT__: source('web/src/DaguanyuanMathCatalogPage.js'),
    NSTimer: { scheduledTimerWithTimeInterval(seconds, repeat, cb) { const timer = setTimeout(cb, 1); return { invalidate() { clearTimeout(timer); } }; } },
    NSURLConnection: { sendAsynchronousRequestQueueCompletionHandler() { throw Error('不应发送原生请求'); } } };
  vm.createContext(native);
  for (const name of ['DaguanyuanImportSelection', 'DaguanyuanMathApi', 'DaguanyuanCategoryRoutes', 'DaguanyuanMathSelection']) vm.runInContext(source('src/' + name + '.js'), native);
  const controller = { webView: { evaluateJavaScript(script, cb) { try { cb(vm.runInContext(script, run.context), null); } catch (error) { cb(null, error); } } } };
  const api = native.__DAGUANYUAN_MATH_API_GLOBAL__;
  const downloaded = [];
  native.__DAGUANYUAN_MATH_IMPORT_GLOBAL__ = {
    selectQuestions(questions, ids) { return questions.filter(q => ids.includes(q.id)); },
    preparedMathSession() { return { targetTitle: '学习集', check() {}, async importQuestions(ids) {
      for (const id of ids) { downloaded.push(id); await api.questionDetail(id, 'question', undefined, undefined, controller); }
      return { createdCount: ids.length, failed: [] };
    } }; },
  };
  const address = 'https://cxyonly.fans' + path;
  const confirm = async plan => { assert.equal(plan.questions.length, 21); assert.equal(run.requests.length, 2); return [21]; };
  confirm.check = () => {};
  const result = await native.__DAGUANYUAN_MATH_SELECTION_GLOBAL__.importPage({ panelController: controller }, {
    provider: 'math', url: address, questions: [{ id: 1 }], importContext: native.__DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.importContextFromURL(address),
  }, null, confirm);
  assert.equal(result.createdCount, 1); assert.deepEqual(downloaded, [21]);
  assert.equal(run.requests.length, 4);
  assert.ok(run.requests.every(req => req.init.headers.Authorization === 'Bearer fixture-login-secret'));
});

test('分类分页读取地址拒绝凭证参数、重复条件和超范围页码', () => {
  const run = browser();
  const path = '/api/questions?category_id=566&include_children=true&page=1&per_page=20&scope=core&exam_subject=math_2';
  for (const invalid of [path + '&token=secret', path + '&category_id=999', path.replace('page=1', 'page=1001'), path + '#state']) {
    assert.throws(() => run.page.beginRead('invalid', invalid), /地址无效/);
  }
  assert.equal(run.requests.length, 0);
});

test('网页登录请求仍遵守 Retry-After；401 不重试并中止导入', async () => {
  for (const status of [429, 401]) {
    let now = 0; const times = [];
    class Clock extends Date { static now() { return now; } }
    const run = browser({ fetch: async () => {
      times.push(now);
      return times.length === 1 ? { status, ok: false, headers: { get: () => '2' } }
        : { status: 200, ok: true, json: async () => ({ id: 1214, category_id: 1, stem: '题干' }) };
    } });
    const native = { Date: Clock, __DAGUANYUAN_MATH_CATALOG_PAGE_SCRIPT__: source('web/src/DaguanyuanMathCatalogPage.js'),
      NSTimer: { scheduledTimerWithTimeInterval(seconds, repeat, cb) {
        let active = true;
        queueMicrotask(() => { if (active) { now += seconds * 1000; cb(); } });
        return { invalidate() { active = false; } };
      } } };
    vm.createContext(native);
    for (const name of ['DaguanyuanImportSelection', 'DaguanyuanMathApi']) vm.runInContext(source('src/' + name + '.js'), native);
    const controller = { webView: { evaluateJavaScript(script, cb) { try { cb(vm.runInContext(script, run.context), null); } catch (error) { cb(null, error); } } } };
    const reading = native.__DAGUANYUAN_MATH_API_GLOBAL__.questionDetail(1214, 'question', undefined, undefined, controller);
    if (status === 429) { assert.equal((await reading).id, 1214); assert.equal(times.length, 2); assert.ok(times[1] - times[0] >= 2000); }
    else { await assert.rejects(reading, error => error.httpStatus === 401 && error.stopImport === true); assert.equal(times.length, 1); }
  }
});
test('数学分类从已登录网页读取，原生未认证接口返回 -1012 时仍可加载且凭据不出网页', async () => {
  const calls = [], tree = [{ id: 1, parent_id: null, name: '高等数学', children: [] }];
  const controller = { activePage: 'import', webView: { evaluateJavaScript(script, cb) {
    calls.push(script);
    cb(script.includes('.read(') ? JSON.stringify({ status: 'ready', length: JSON.stringify(tree).length })
      : script.includes('.chunk(') ? JSON.stringify(tree) : 'accepted', null);
  } } };
  let nativeRequests = 0;
  const context = { __DAGUANYUAN_MATH_CATALOG_PAGE_SCRIPT__: '/* fixture */',
    __DAGUANYUAN_MATH_IMPORT_GLOBAL__: {}, NSUserDefaults: { standardUserDefaults: () => ({ setObjectForKey() {} }) },
    NSTimer: { scheduledTimerWithTimeInterval(t, r, fn) { return { invalidate() {} }; } },
    NSURL: { URLWithString: value => value }, NSOperationQueue: { mainQueue: () => ({}) },
    NSMutableURLRequest: { requestWithURL: () => ({ setHTTPMethod() {}, setTimeoutInterval() {}, setAllHTTPHeaderFields() {} }) },
    NSURLConnection: { sendAsynchronousRequestQueueCompletionHandler(req, queue, cb) { nativeRequests++; cb({ statusCode: 401 }, null, { localizedDescription: 'NSURLErrorDomain 错误 -1012' }); } }
  };
  vm.createContext(context);
  for (const name of ['DaguanyuanImportSelection', 'DaguanyuanMathApi', 'DaguanyuanImportWorkspace']) vm.runInContext(source('src/' + name + '.js'), context);
  const { records } = await context.__DAGUANYUAN_IMPORT_WORKSPACE_GLOBAL__.loadCatalog(controller, { scope: 'exam', examSubject: 'math_2' });
  assert.deepEqual(JSON.parse(JSON.stringify(records)), [[1, 0, '高等数学']]);
  assert.equal(nativeRequests, 0); assert.ok(calls.some(s => s.includes('.release(')));
  assert.equal(controller.importMathCatalog.examSubject, 'math_2');
  assert.doesNotMatch(calls.join('\n'), /Bearer|fixture-token/);
});

test('真实网页与原生桥串联读取目录，令牌和 Cookie 不传回原生', async () => {
  const run = browser(), scripts = [];
  const native = { __DAGUANYUAN_MATH_CATALOG_PAGE_SCRIPT__: source('web/src/DaguanyuanMathCatalogPage.js'),
    NSTimer: { scheduledTimerWithTimeInterval(seconds, repeat, cb) { const timer = setTimeout(cb, seconds === 0.15 ? 1 : seconds * 1000); return { invalidate() { clearTimeout(timer); } }; } } };
  vm.createContext(native);
  for (const name of ['DaguanyuanImportSelection', 'DaguanyuanMathApi']) vm.runInContext(source('src/' + name + '.js'), native);
  const controller = { webView: { evaluateJavaScript(script, cb) { scripts.push(script); try { cb(vm.runInContext(script, run.context), null); } catch (error) { cb(null, error); } } } };
  const result = await native.__DAGUANYUAN_MATH_API_GLOBAL__.categoryRecords('exam', 'math_2', controller);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), [[1, 0, '高等数学']]);
  assert.equal(run.requests[0].url, '/api/categories?scope=exam&exam_subject=math_2');
  assert.equal(run.requests[0].init.headers.Authorization, 'Bearer fixture-login-secret');
  assert.equal(run.requests[0].init.credentials, 'same-origin'); assert.equal(run.requests[0].init.redirect, 'error');
  assert.doesNotMatch(scripts.join('\n'), /fixture-login-secret/);
  assert.equal(run.requests[0].init.signal.aborted, true);
});

for (const status of [401, 403, 428, 429]) test('目录请求失败给出可操作提示，不返回假空目录：' + status, async () => {
  const run = browser({ fetch: async () => ({ status, ok: false }) });
  run.page.begin('task', 'exam', 'math_2'); await tick();
  const result = JSON.parse(run.page.read('task'));
  assert.equal(result.status, 'error');
  assert.match(result.error, status === 401 ? /登录已过期/ : status === 403 ? /权限/ : status === 428 ? /验证/ : /频繁/);
  assert.equal(run.requests.length, 1); run.page.release('task');
});

test('未登录和外站不请求；换账号或换页拒绝旧目录，新筛选中止旧请求', async () => {
  const anonymous = browser(); anonymous.storage.clear();
  assert.throws(() => anonymous.page.begin('task', 'complete', 'all'), /登录/); assert.equal(anonymous.requests.length, 0);
  const foreign = browser(); foreign.context.location = new URL('https://www.408os.cn/exercise');
  assert.throws(() => foreign.page.begin('task', 'complete', 'all'), /登录/); assert.equal(foreign.requests.length, 0);
  for (const change of ['account', 'route']) {
    const run = browser(); run.page.begin('task', 'complete', 'all'); await tick();
    if (change === 'account') run.storage.set('daguan_token', 'different-account'); else run.context.location = new URL('https://www.cxyonly.fans/math/paper');
    assert.throws(() => run.page.read('task'), /已变化/); run.page.release('task');
  }
  const run = browser({ fetch: () => new Promise(() => {}) });
  run.page.begin('old', 'complete', 'all'); run.page.begin('new', 'exam', 'math_2');
  assert.equal(run.requests[0].init.signal.aborted, true); assert.throws(() => run.page.read('old'), /失效/); run.page.release('new');
});
