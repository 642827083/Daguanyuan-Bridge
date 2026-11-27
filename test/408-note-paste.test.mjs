import { withMathSite } from './helpers/math-site.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function runtime(options = {}) {
  const target = { id: 843, provider: '408', year: 2026, number: 44, url: 'https://www.408os.cn/exercise?year=2026' };
  const queue = [], frames = [], timers = [], scripts = [], warnings = [], late = [];
  let opened = false, editing = !options.preview, mine = !options.community, uploaded = false, error = false, switched = false;
  let imagePending = Boolean(options.uploadingPlaceholder);
  const imageMarker = options.currentMarkers ? '【图片1】' : '[图片1]';
  const editor = { value: '已有笔记', focus() {}, getAttribute(name) { return name === 'aria-busy' ? String(imagePending) : null; },
    setSelectionRange(start, end) { assert.equal(start, this.value.length); assert.equal(end, start); },
    dispatchEvent(event) {
      assert.equal(event.clipboardData.items[0].kind, 'file');
      assert.equal(event.clipboardData.items[0].getAsFile().type, 'image/png');
      if (options.permission) { warnings.push({ textContent: '笔记图片功能暂未对当前账号开放' }); return; }
      uploaded = true;
      if (!options.delayUpload) this.value += '\n\n' + imageMarker;
    } };
  const codeMirror = {
    get textContent() { return editor.value.replace(/【图片\d+】/g, ''); },
    focus() {}, getAttribute() { return null; },
    querySelectorAll(selector) {
      assert.equal(selector, '[data-image-token]');
      return (editor.value.match(/【图片\d+】/g) || []).map(token => ({ getAttribute() { return token; } }));
    },
    dispatchEvent(event) { editor.dispatchEvent(event); },
  };
  const scope = {
    querySelector(selector) {
      if (selector === '.modal-header') return { textContent: '题目笔记' };
      if (selector.includes('textarea')) return !options.codeMirror && opened && mine && editing ? editor : null;
      if (selector.includes('.cm-content')) return options.codeMirror && opened && mine && editing ? codeMirror : null;
      if (selector.includes('is-uploading')) return imagePending ? {} : null;
      if (selector.includes('auto-save-status')) return { textContent: error ? '自动保存失败，将重试' : options.waitSaved ? '等待自动保存' : '已保存' };
      return null;
    },
    querySelectorAll(selector) {
      if (selector.includes('note-tab')) return [ { textContent: '我的笔记', click() { mine = true; } }, { textContent: '仅编辑', click() { editing = true; } } ];
      return [];
    },
  };
  const row = {
    querySelector(selector) {
      if (selector === '.year-tag') return { textContent: '2026' };
      if (selector === '.index-tag') return { textContent: switched ? '第45题' : '第44题' };
      if (selector === '.note-tabs') return opened ? {} : null;
      if (options.modal) return null;
      return scope.querySelector(selector);
    },
    querySelectorAll(selector) {
      if (selector === 'button') return [{ textContent: '笔记', click() { opened = true; } }];
      return options.modal ? [] : scope.querySelectorAll(selector);
    },
  };
  const browser = { URL, console, window: { location: { hostname: 'www.408os.cn', pathname: '/exercise', href: target.url }, setTimeout(fn) { queue.push(fn); },
    __DAGUANYUAN_QUESTION_TOOLS__: { finishNotePaste() {} } },
    document: { querySelectorAll(selector) { if (selector === '.question-card') return [row]; if (selector === '.n-message') return warnings; assert.equal(selector, '.modal.active, .n-modal'); return options.modal && opened ? [scope] : []; },
      createRange() { return { selectNodeContents(node) { assert.equal(node, codeMirror); }, collapse(toStart) { assert.equal(toStart, false); } }; },
      createElement() { return { style: {} }; }, body: { appendChild(frame) { frames.push(frame); frame.parentNode = { removeChild() {} }; } } },
    File: class { constructor(parts, name, options) { this.parts = parts; this.name = name; this.type = options.type; } },
    Event: class {}, atob(value) { return Buffer.from(value, 'base64').toString('binary'); } };
  vm.createContext(browser);
  browser.window.getSelection = () => ({ removeAllRanges() {}, addRange() {} });
  const image = { pngData() { return { length: 3, base64Encoding() { return 'AQID'; } }; } };
  const context = { console, UIPasteboard: { generalPasteboard() { return { image: options.noImage ? null : image }; } },
    NSTimer: { scheduledTimerWithTimeInterval(seconds, repeat, fn) { const timer = { seconds, active: true, invalidate() { this.active = false; }, fire() { if (this.active) fn(); } }; timers.push(timer); return timer; } },
    Application: { sharedInstance() { return { showHUD() {} }; } } };
  vm.createContext(context);
  for (const file of ['DaguanyuanNotePaste', 'Daguanyuan408NotePaste']) vm.runInContext(withMathSite(fs.readFileSync(new URL(`../src/${file}.js`, import.meta.url), 'utf8')), context);
  const controller = { addon: { window: {} }, webView: { evaluateJavaScript(script, callback) {
    scripts.push(script);
    if (options.stall && script.includes('.prepare(')) { late.push(() => callback('true')); return; }
    try { const result = vm.runInContext(script, browser); callback(result, null); } catch (error) { callback(null, error); }
  } } };
  function tick() { if (queue.length) queue.shift()(); }
  function finishTicks() { for (let i = 0; i < 100 && queue.length && !frames.length; i++) tick(); }
  return { target, controller, context, browser, editor, frames, timers, scripts, late, tick, finishTicks,
    paste: context.__DAGUANYUAN_408_NOTE_PASTE_GLOBAL__, result: context.__DAGUANYUAN_NOTE_PASTE_GLOBAL__.result,
    upload() { if (imagePending) imagePending = false; else editor.value += '\n\n' + imageMarker; }, failSave() { error = true; }, switch() { switched = true; },
    get uploaded() { return uploaded; } };
}

test('408 图片粘贴使用网站文件项接口，保留原笔记并确认保存', async () => {
  for (const options of [{}, { modal: true, preview: true, community: true }]) {
    const run = runtime(options); const token = await run.paste.start(run.controller, run.target);
    run.finishTicks(); assert.equal(run.uploaded, true);
    assert.match(run.editor.value, /^已有笔记\n\n\[图片1\]/);
    assert.match(run.frames[0].src, /status=saved/);
    assert.equal(run.result(run.controller, token, 'saved'), '图片已添加到题目笔记');
    assert.equal(run.controller.notePasteOperation, null);
  }
});

test('408 当前网站的中文图片标记保存后能够确认成功', async () => {
  const run = runtime({ currentMarkers: true });
  await run.paste.start(run.controller, run.target); run.finishTicks();
  assert.equal(run.uploaded, true);
  assert.match(run.editor.value, /^已有笔记\n\n【图片1】/);
  assert.ok(run.frames.some(frame => /status=saved/.test(frame.src)));
});

test('408 CodeMirror 弹窗编辑器通过粘贴事件添加图片，识别图片控件并确认保存', async () => {
  const run = runtime({ modal: true, codeMirror: true, currentMarkers: true, preview: true, community: true });
  await run.paste.start(run.controller, run.target); run.finishTicks();
  assert.equal(run.uploaded, true);
  assert.match(run.editor.value, /^已有笔记\n\n【图片1】/);
  assert.ok(run.frames.some(frame => /status=saved/.test(frame.src)));
});

test('408 图片占位符出现而上传尚未完成时，即使保存文字仍为已保存也不能报告成功', async () => {
  for (const codeMirror of [false, true]) {
    const run = runtime({ modal: codeMirror, codeMirror, currentMarkers: true, uploadingPlaceholder: true });
    await run.paste.start(run.controller, run.target); run.finishTicks();
    assert.equal(run.uploaded, true);
    assert.match(run.editor.value, /【图片1】/);
    assert.equal(run.frames.length, 0);
    run.upload(); run.finishTicks();
    assert.ok(run.frames.some(frame => /status=saved/.test(frame.src)));
  }
});

test('原笔记显示已保存时仍等待新图片内容，避免误报粘贴成功', async () => {
  const run = runtime({ delayUpload: true }); await run.paste.start(run.controller, run.target);
  run.tick(); run.tick(); assert.equal(run.frames.length, 0);
  run.upload(); run.finishTicks(); assert.match(run.frames[0].src, /status=saved/);
});

test('图片上传期间只修改文字并保存不会误报图片已添加', async () => {
  const run = runtime({ delayUpload: true }); await run.paste.start(run.controller, run.target);
  run.tick(); run.editor.value += '\n手动补充文字'; run.tick(); run.tick();
  assert.equal(run.frames.length, 0);
  run.upload(); run.finishTicks(); assert.match(run.frames[0].src, /status=saved/);
});

test('408 保存失败、账号未开放图片权限与翻题均返回明确结果', async () => {
  for (const failure of ['save', 'permission', 'changed']) {
    const run = runtime({ delayUpload: true, permission: failure === 'permission' });
    await run.paste.start(run.controller, run.target);
    if (failure === 'save') run.failSave(); if (failure === 'changed') run.switch();
    run.finishTicks(); assert.match(run.frames[0].src, new RegExp('status=' + failure));
  }
});

test('408 无剪贴板图片不上传，网页不回调时限时失败且迟到回调不继续传图', async () => {
  const empty = runtime({ noImage: true });
  await assert.rejects(empty.paste.start(empty.controller, empty.target), /剪贴板中没有图片/);
  assert.equal(empty.controller.notePasteOperation, null);
  const stalled = runtime({ stall: true }); const operation = stalled.paste.start(stalled.controller, stalled.target);
  await new Promise(resolve => setImmediate(resolve));
  stalled.timers.find(t => t.active && t.seconds === 15).fire();
  await assert.rejects(operation, /网页调用超时/); stalled.late[0](); await Promise.resolve();
  assert.equal(stalled.scripts.some(s => s.includes('.append(')), false);
  assert.equal(stalled.controller.notePasteOperation, null);
});

test('408 图片未返回保存回执时原生超时清理网页传输与按钮状态', async () => {
  const run = runtime({ delayUpload: true }); await run.paste.start(run.controller, run.target);
  run.timers.find(t => t.seconds === 55).fire(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(run.controller.notePasteOperation, null);
  assert.ok(run.scripts.some(s => s.includes('.cancel(')));
  assert.ok(run.scripts.some(s => s.includes('.finishNotePaste()')));
});
