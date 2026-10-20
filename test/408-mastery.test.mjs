import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function browser(options = {}) {
  const storage = new Map([['token', '408-test-token'], ['token_expire', String(Date.now() + 60000)]]);
  const calls = [], imports = [], user = { token: '408-test-token' };
  let score;
  const api = {
    async post(path, body, config) {
      calls.push({ path, body, config, method: 'POST' }); score = body.score;
      if (options.post) return options.post(path, body, config);
      return { id: '9876543210123456789', questionId: String(body.questionId), score };
    },
    async get(path, config) {
      calls.push({ path, config, method: 'GET' });
      if (options.get) return options.get(path, config);
      return { question: { id: '1214' }, currentMastery: { score } };
    }
  };
  const context = {
    location: new URL('https://www.408os.cn/exercise?year=2026'), URL, AbortController, setTimeout, clearTimeout,
    localStorage: { getItem: key => storage.get(key) }, navigator: {},
    document: { querySelector: () => ({ src: options.entry || 'https://www.408os.cn/assets/index-current.js' }) },
    Function: () => async url => { imports.push(url); return options.module || { r: api, u: () => user }; }
  };
  context.window = context;
  vm.runInNewContext(read('web/src/DaguanyuanMasteryPage.js'), context);
  return { context, storage, user, calls, imports, api: context.__DAGUANYUAN_MASTERY_PAGE__ };
}

for (const [mastery, score] of [['mastered', 1], ['needs_practice', 2], ['not_known', 3]]) {
  test('408 同步真实接口并回读核验：' + mastery, async () => {
    const run = browser(); assert.equal(run.api.begin('t', 1214, mastery, '408'), 'ok'); await tick();
    const result = run.api.read('t');
    assert.deepEqual(JSON.parse(result), { status: 'ready', error: '', id: 1214, mastery, mode: 'mastery', provider: '408' });
    assert.equal(run.calls[0].path, '/api/zt/question-mastery/mark');
    assert.deepEqual(JSON.parse(JSON.stringify(run.calls[0].body)), { questionId: 1214, score, isUpdate: false });
    assert.equal(run.calls[1].path, '/api/zt/question/detail/1214');
    assert.doesNotMatch(result, /408-test-token|Bearer/); run.api.release('t');
    run.api.begin('t2', 1214, mastery, '408'); await tick();
    assert.equal(run.calls[2].body.isUpdate, true); run.api.release('t2');
  });
}

test('408 未登录、过期、模拟登录、来源不符时不写入', () => {
  for (const kind of ['anonymous', 'expired', 'mock', 'math', 'foreign']) {
    const run = browser();
    if (kind === 'anonymous') run.storage.clear();
    if (kind === 'expired') run.storage.set('token_expire', '1');
    if (kind === 'mock') run.storage.set('token', 'mock-token');
    if (kind === 'math') run.context.location = new URL('https://www.cxyonly.fans/math');
    if (kind === 'foreign') run.context.location = new URL('https://example.com/exercise');
    assert.throws(() => run.api.begin('t', 1214, 'mastered', '408'), /登录/);
    assert.equal(run.calls.length, 0);
  }
});

test('408 模块来源异常或登录存储与网站账号不一致时不写入', async () => {
  for (const options of [{ entry: 'https://example.com/assets/index-current.js' }, { module: {} }, {}]) {
    const run = browser(options); if (!Object.keys(options).length) run.user.token = 'other-account';
    run.api.begin('t', 1214, 'mastered', '408'); await tick();
    assert.equal(JSON.parse(run.api.read('t')).status, 'error'); assert.equal(run.calls.length, 0); run.api.release('t');
  }
});

test('408 保存失败、回执与回读不一致时不报告成功或重复写入', async () => {
  for (const options of [
    { post: async () => { throw Error('请求失败 429'); } }, { post: async () => null },
    { post: async () => ({ id: '1', questionId: '2', score: 1 }) },
    { post: async () => ({ id: '1', questionId: '1214', score: 3 }) },
    { get: async () => ({ question: { id: '2' }, currentMastery: { score: 1 } }) },
    { get: async () => ({ question: { id: '1214' }, currentMastery: { score: 3 } }) },
    { get: async () => { throw Error('网络中断'); } }
  ]) {
    const run = browser(options); run.api.begin('t', 1214, 'mastered', '408'); await tick();
    assert.equal(JSON.parse(run.api.read('t')).status, 'error');
    assert.equal(run.calls.filter(call => call.method === 'POST').length, 1); run.api.release('t');
  }
});

test('408 取消或切换账号、页面后不接受回执，取消会中止请求', async () => {
  for (const action of ['cancel', 'account', 'route']) {
    let complete;
    const run = browser({ post: () => new Promise(resolve => { complete = resolve; }) });
    run.api.begin('t', 1214, 'mastered', '408'); await tick();
    assert.throws(() => run.api.begin('other', 1, 'not_known', '408'), /正在同步/);
    if (action === 'cancel') { run.api.release('t'); assert.equal(run.calls[0].config.signal.aborted, true); }
    if (action === 'account') run.storage.set('token', 'new-token');
    if (action === 'route') run.context.location = new URL('https://www.408os.cn/overview');
    complete({ id: '1' }); await tick();
    assert.equal(run.calls.length, 1); assert.throws(() => run.api.read('t'), /失效|切换/); run.api.release('t');
  }
});

test('原生同步桥传递 408 来源并拒绝其他来源的同题号回执', async () => {
  for (const provider of ['408', 'math']) {
    const scripts = [], addon = { panelController: { webView: {} } };
    const context = { __DAGUANYUAN_MASTERY_PAGE_SCRIPT__: '', __DAGUANYUAN_IMPORT_SELECTION_GLOBAL__: {
      evaluate: async (controller, script) => {
        scripts.push(script);
        return script.includes('.read(') ? JSON.stringify({ status: 'ready', id: 1214, mastery: 'needs_practice', provider }) : 'ok';
      }
    } };
    vm.runInNewContext(read('src/DaguanyuanMasterySync.js'), context);
    const promise = context.__DAGUANYUAN_MASTERY_SYNC_GLOBAL__.save(addon, { questionId: 1214, provider: '408' }, 'needs_practice');
    if (provider === '408') assert.equal((await promise).provider, '408');
    else await assert.rejects(promise, /不一致/);
    assert.ok(scripts.some(script => script.includes(',1214,"needs_practice","408")')));
    assert.equal(addon.__daguanyuanMasteryTask, null);
  }
});
