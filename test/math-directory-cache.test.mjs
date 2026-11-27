import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { withMathSite } from './helpers/math-site.mjs';

function runtime() {
  let now = 1000, revision = 7, fail = false;
  const requests = [], replies = new Map();
  const context = vm.createContext({ Date: class extends Date { static now() { return now; } },
    __DAGUANYUAN_MATH_CATALOG_PAGE_SCRIPT__: '',
    __DAGUANYUAN_IMPORT_SELECTION_GLOBAL__: { async evaluate(c, script) {
      const begin = /\.beginRead\(("[^"]+"),("[^"]+")\)$/.exec(script);
      if (begin) {
        const token = JSON.parse(begin[1]), url = JSON.parse(begin[2]); requests.push(url);
        replies.set(token, fail ? { error: true } : JSON.stringify(url.includes('/directory?')
          ? { roots: [{ category_id: 8, label: '分类', children: [] }] } : { revision })); return 'accepted';
      }
      const match = /\.(read|chunk|release)\(("[^"]+")(?:,(\d+))?\)$/.exec(script);
      assert.ok(match, script); const data = replies.get(JSON.parse(match[2]));
      if (match[1] === 'release') return true;
      if (match[1] === 'chunk') return data.slice(Number(match[3]), Number(match[3]) + 65536);
      return JSON.stringify(data.error ? { status: 'error', error: '登录失效', httpStatus: 401 } : { status: 'ready', length: data.length });
    } } });
  vm.runInContext(withMathSite(fs.readFileSync(new URL('../src/DaguanyuanMathApi.js', import.meta.url), 'utf8')), context);
  const controller = { webView: {} }, selection = { listId: 'complete', scope: 'complete', examSubject: 'all', listRevision: 0 };
  const read = (owner = 'account-a', selected = selection, check) => context.__DAGUANYUAN_MATH_API_GLOBAL__.questionListDirectory(selected, controller, check, owner);
  return { controller, selection, read, requests, advance() { now += 31000; }, set revision(n) { revision = n; }, set fail(n) { fail = n; } };
}

test('连续定位每次核验题单版本，同一目录五次只下载一次，调用方修改不污染缓存', async () => {
  const run = runtime();
  const first = await run.read(); first.roots[0].label = '改动';
  for (let i = 0; i < 4; i++) assert.equal((await run.read()).roots[0].label, '分类');
  assert.equal(run.requests.filter(url => url.includes('/directory?')).length, 1);
  assert.equal(run.requests.length, 6);
});

test('账号、题单、范围、科目、版本、网页或缓存时效变化后重新下载', async () => {
  const run = runtime(); await run.read();
  await run.read('account-b');
  await run.read('account-b', { ...run.selection, listId: 'core' });
  await run.read('account-b', { ...run.selection, scope: 'core' });
  await run.read('account-b', { ...run.selection, examSubject: 'math_2' });
  await run.read('account-b');
  run.revision = 8; await run.read('account-b');
  run.controller.webView = {}; await run.read('account-b');
  run.advance(); await run.read('account-b');
  assert.equal(run.requests.filter(url => url.includes('/directory?')).length, 9);
  await run.read(''); await run.read('');
  assert.equal(run.requests.filter(url => url.includes('/directory?')).length, 11);
});

test('登录失败和取消不使用缓存蒙混通过，失败后重新读取目录', async () => {
  const run = runtime(); await run.read();
  run.fail = true; await assert.rejects(run.read(), /登录失效/);
  run.fail = false; await run.read();
  assert.equal(run.requests.filter(url => url.includes('/directory?')).length, 2);
  await assert.rejects(run.read('account-a', run.selection, () => { throw Error('已取消'); }), /已取消/);
  run.revision = 8;
  await assert.rejects(run.read('account-a', { ...run.selection, listRevision: 7 }), /题单版本已变化/);
});
