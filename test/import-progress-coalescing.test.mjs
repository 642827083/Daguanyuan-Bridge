import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const tick = () => new Promise(resolve => setImmediate(resolve));
function runtime() {
  const timers = [], calls = [], held = [];
  let defer = false;
  const context = vm.createContext({ NSTimer: { scheduledTimerWithTimeInterval(seconds, repeat, fn) {
    const timer = { seconds, fn, active: true, invalidate() { this.active = false; } }; timers.push(timer); return timer;
  } }, __DAGUANYUAN_IMPORT_REPORT_GLOBAL__: { textFor: r => '新建 ' + r.createdCount } });
  vm.runInContext(fs.readFileSync(new URL('../src/DaguanyuanImportSelection.js', import.meta.url), 'utf8'), context);
  const controller = { importTask: { token: 'task-a', status: 'running', ready: Promise.resolve() }, webView: {
    evaluateJavaScript(script, cb) {
      calls.push(script); if (defer) held.push(cb); else cb('ok', null);
    }
  } };
  return { controller, calls, held, timers, api: context.__DAGUANYUAN_IMPORT_SELECTION_GLOBAL__, set defer(v) { defer = v; },
    async flush() { for (let i = 0; i < 20; i++) { const t = timers.find(t => t.active && t.seconds < 1); if (!t) break; t.active = false; t.fn(); await tick(); } } };
}

test('一百次导入进度最多两次网页调用，末次进度准确，完成结果不会被延迟覆盖', async () => {
  const run = runtime();
  for (let i = 1; i <= 100; i++) run.api.progress(run.controller, { processed: i, total: 100 });
  await tick(); await run.flush();
  assert.ok(run.calls.length <= 2, '实际调用次数 ' + run.calls.length);
  assert.match(run.calls.at(-1), /"processed":100/);
  run.api.progress(run.controller, { processed: 101, total: 101 });
  await run.api.show(run.controller, { createdCount: 101 }); await run.flush();
  assert.match(run.calls.at(-1), /\.result\(/);
  assert.match(run.calls.at(-1), /新建 101/);
});

test('慢网页只保留一条在途进度，取消或替换任务后旧计时器不再更新页面', async () => {
  const run = runtime(); run.defer = true;
  for (let i = 1; i <= 100; i++) run.api.progress(run.controller, { processed: i });
  assert.equal(run.calls.length, 1);
  run.held.shift()('ok', null); await tick();
  run.api.cancel(run.controller, { token: 'task-a' }); await run.flush();
  assert.equal(run.calls.length, 1);
  run.api.progress(run.controller, { processed: 101 }); await run.flush();
  assert.equal(run.calls.length, 1);
  run.controller.importTask = { token: 'task-b', status: 'running' };
  run.api.progress(run.controller, { processed: 1 });
  const next = { token: 'task-c', status: 'running' }; run.controller.importTask = next;
  run.held.shift()(null, Error('旧页面失败')); await tick(); await run.flush();
  assert.notEqual(next.cancelled, true);
});
