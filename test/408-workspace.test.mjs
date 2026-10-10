import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function runtime() {
  const timers = [], views = [], loaded = [];
  const context = { console,
    NSTimer: { scheduledTimerWithTimeInterval(delay, repeat, callback) { const timer = { callback, stopped: false, invalidate() { this.stopped = true; } }; timers.push(timer); return timer; } },
    UIWebView: function (frame) { this.frame = frame; this.stopLoading = () => { this.stopped = true; }; this.removeFromSuperview = () => { this.removed = true; }; views.push(this); },
    MNUtil: { loadRequest(view, url) { loaded.push({ view, url }); } },
  };
  vm.createContext(context); vm.runInContext(readFileSync(new URL('../src/Daguanyuan408Workspace.js', import.meta.url), 'utf8'), context);
  const controller = { importWebView: { frame: { width: 960 } }, containerView: { addSubview() {} } };
  return { worker: context.__DAGUANYUAN_408_WORKSPACE_GLOBAL__, controller, timers, views, loaded };
}

test('408 独立读取窗口只接受网站地址，等待原生加载回调后交接，复用并释放窗口', async () => {
  const run = runtime();
  assert.throws(() => run.worker.load(run.controller, 'https://other.cn/exercise?year=2026'), /地址无效/);
  const first = run.worker.load(run.controller, 'https://www.408os.cn/exercise?year=2026');
  assert.equal(run.views[0].hidden, true); assert.equal(run.views[0].delegate, run.controller);
  run.worker.loaded(run.controller, {}); assert.ok(run.controller.import408WorkerState);
  run.worker.loaded(run.controller, run.views[0]); assert.equal((await first).webView, run.views[0]);
  assert.equal(run.timers[0].stopped, true);
  const second = run.worker.load(run.controller, 'https://www.408os.cn/exercise?year=2025');
  assert.equal(run.views.length, 1); run.worker.loaded(run.controller, run.views[0]); await second;
  run.worker.release(run.controller);
  assert.equal(run.views[0].removed, true); assert.equal(run.views[0].stopped, true); assert.equal(run.views[0].delegate, null);
  assert.equal(run.controller.import408Worker, null);
});

test('408 加载失败、超时、主动停止都会完成等待，迟到回调不恢复旧连接', async () => {
  for (const reason of ['failed', 'timeout', 'stop']) {
    const run = runtime(), operation = run.worker.load(run.controller, 'https://www.408os.cn/exercise?year=2026');
    const rejection = assert.rejects(operation, /加载失败|超时|已停止/);
    if (reason === 'failed') run.worker.failed(run.controller, run.views[0], { localizedDescription: '断网' });
    else if (reason === 'timeout') run.timers[0].callback();
    else run.worker.release(run.controller);
    await rejection; run.worker.release(run.controller); run.worker.loaded(run.controller, run.views[0]);
    assert.equal(run.controller.import408WorkerState, null); assert.equal(run.views[0].removed, true);
  }
});
