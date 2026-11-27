import { withMathSite } from './helpers/math-site.mjs';
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { parseHTML } from 'linkedom';

const source = withMathSite(readFileSync(new URL("../src/DaguanyuanNotePaste.js", import.meta.url), "utf8"));

function runtime(image, address = "https://cxyonly.fans/math/practice/360") {
  const scripts = [];
  const timers = [];
  const context = {
    UIPasteboard: { generalPasteboard() { return { image }; } },
    NSTimer: { scheduledTimerWithTimeInterval(seconds, repeats, callback) { timers.push({ seconds, repeats, callback }); } },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  const controller = {
    webView: {
      evaluateJavaScript(script, callback) {
        scripts.push(script);
        callback(script.includes("window.location.href") ? address : true, null);
      },
    },
  };
  return { controller, scripts, timers, paste: context.__DAGUANYUAN_NOTE_PASTE_GLOBAL__ };
}

test("剪贴板图片按块交给当前题目的网页笔记，保存结果解除占用", async () => {
  const base64 = "A".repeat(300000);
  const image = { pngData() { return { length: 225000, base64Encoding() { return base64; } }; } };
  const { controller, scripts, timers, paste } = runtime(image);
  const token = await paste.start(controller, 4042);
  assert.ok(token);
  assert.equal(scripts.filter((script) => script.includes(".append(")).length, 3);
  assert.match(scripts.find((script) => script.includes(".prepare(")), /4042/);
  assert.match(scripts.at(-1), /\.commit\(/);
  assert.equal(timers[0].seconds, 55);
  assert.equal(paste.result(controller, token, "saved"), "图片已添加到题目笔记");
  assert.equal(controller.notePasteOperation, null);
});

test("没有图片或不是大观园题目页时不传输图片", async () => {
  const empty = runtime(null);
  await assert.rejects(empty.paste.start(empty.controller, 4042), /剪贴板中没有图片/);
  assert.equal(empty.scripts.filter((script) => script.includes(".append(")).length, 0);

  const image = { pngData() { return { length: 3, base64Encoding() { return "AAAA"; } }; } };
  const foreign = runtime(image, "https://example.com/math/practice/360");
  await assert.rejects(foreign.paste.start(foreign.controller, 4042), /请先打开大观园/);
  assert.equal(foreign.scripts.length, 2);
  assert.equal(foreign.controller.notePasteOperation, null);
});

test("WebView 已执行脚本但布尔返回值为空时仍能连接笔记编辑器", async () => {
  const image = { pngData() { return { length: 3, base64Encoding() { return "AQID"; } }; } };
  const { controller, paste } = runtime(image);
  const original = controller.webView.evaluateJavaScript;
  controller.webView.evaluateJavaScript = function (script, callback) {
    if (script.includes("window.location.href")) return callback("https://cxyonly.fans/math/practice/360", null);
    if (script.startsWith("String(")) return callback("true", null);
    original.call(this, script, function (result, error) { callback(undefined, error); });
  };
  await assert.doesNotReject(paste.start(controller, 4042));
});

test("复测页笔记藏在更多操作时先展开，再粘贴到当前题目并等待保存", async () => {
  const image = { pngData() { return { length: 3, base64Encoding() { return "AQID"; } }; } };
  const { controller, scripts, paste } = runtime(image, "https://cxyonly.fans/math/retest");
  await paste.start(controller, 4042);
  const receiver = scripts.find((script) => script.includes("function pageReceiver()"));
  assert.ok(receiver);

  const queued = [];
  const frames = [];
  let expanded = false;
  let editorOpen = false;
  let uploaded = false;
  const more = { textContent: "更多操作", hasAttribute() { return false; }, click() { expanded = true; } };
  const note = { textContent: "添加笔记", hasAttribute() { return false; }, click() { editorOpen = true; } };
  const plugin = { textContent: "添加笔记", disabled: false };
  const editor = { lastChild: null, focus() {} };
  const wrapper = {
    querySelector(selector) { return selector.includes("data-note-editor") ? editor : null; },
    querySelectorAll() { return uploaded ? [{}] : []; },
    dispatchEvent(event) { assert.equal(event.clipboardData.files[0].type, "image/png"); uploaded = true; },
  };
  const row = {
    getAttribute(name) { return name === "data-retest-question-id" ? "4042" : null; },
    querySelector(selector) {
      if (selector.includes("data-note-rich-editor")) return editorOpen ? wrapper : null;
      if (selector.includes("data-state")) return { getAttribute() { return "saved"; } };
      if (selector.includes("data-daguanyuan")) return plugin;
      return null;
    },
    querySelectorAll() { return expanded ? [more, note] : [more]; },
  };
  const body = { appendChild(frame) { frames.push(frame); frame.parentNode = { removeChild() {} }; } };
  const context = {
    window: {
      location: { hostname: "cxyonly.fans", pathname: "/math/retest" },
      setTimeout(callback) { queued.push(callback); },
      getSelection() { return { removeAllRanges() {}, addRange() {} }; },
    },
    document: {
      body,
      querySelectorAll() { return [row]; },
      createElement() { return { style: {} }; },
      createRange() { return { selectNodeContents() {}, collapse() {} }; },
    },
    File: class { constructor(parts, name, options) { this.parts = parts; this.name = name; this.type = options.type; } },
    Event: class {},
    atob(value) { return Buffer.from(value, "base64").toString("binary"); },
  };
  vm.createContext(context);
  assert.equal(vm.runInContext(receiver, context), true);
  const page = context.window.__DAGUANYUAN_NOTE_PASTE__;
  assert.equal(page.version, 9);
  assert.equal(page.prepare(4042, "token", "image/png", "note.png"), true);
  assert.equal(page.append("token", "AQID"), true);
  assert.equal(page.commit("token"), true);
  while (queued.length && !frames.length) queued.shift()();
  assert.equal(expanded, true);
  assert.equal(editorOpen, true);
  assert.equal(uploaded, true);
  assert.match(frames[0].src, /status=saved/);
  assert.equal(plugin.disabled, false);
});

for (const modern of [false, true]) for (const mode of ['retest', 'category', 'focus', 'paper']) test('卡片外的题目笔记编辑器仍能添加图片：' + mode + (modern ? ' 新数学站' : ' 旧数学站'), async () => {
  const image = { pngData() { return { length: 3, base64Encoding() { return "AQID"; } }; } };
  const oldPath = mode === 'retest' ? '/math/retest' : mode === 'category' ? '/math/practice/categories/345' : mode === 'paper' ? '/math/paper' : '/math/practice';
  const path = modern ? oldPath.slice(5) : oldPath, hostname = modern ? 'math.cxyonly.fans' : 'cxyonly.fans';
  const { controller, scripts, paste } = runtime(image, 'https://' + hostname + path);
  await paste.start(controller, 4042);
  const receiver = scripts.find((script) => script.includes("function pageReceiver()"));
  const queued = [];
  const frames = [];
  let dialogOpen = false;
  let uploaded = false;
  const note = { textContent: "查看笔记", getAttribute(name) { return name === 'aria-label' ? '笔记' : name === 'aria-controls' && mode === 'focus' ? 'note-4042' : null; }, hasAttribute() { return false; }, click() { dialogOpen = true; } };
  const plugin = { textContent: "添加笔记", disabled: false };
  const editor = { lastChild: null, focus() {} };
  const wrapper = {
    querySelector(selector) { return selector.includes("data-note-editor") ? editor : null; },
    querySelectorAll() { return uploaded ? [{}] : []; },
    dispatchEvent(event) { assert.equal(event.clipboardData.files[0].type, "image/png"); uploaded = true; },
  };
  const dialog = {
    querySelector(selector) {
      if (selector === "h2") return { textContent: "题目笔记" };
      if (selector.includes("data-note-rich-editor")) return wrapper;
      if (selector.includes("data-state")) return { getAttribute() { return "saved"; } };
      return null;
    },
  };
  const row = {
    getAttribute(name) { return name === (mode === 'retest' ? 'data-retest-question-id' : 'data-learning-question-id') ? '4042' : null; },
    querySelector(selector) { return selector.includes("data-daguanyuan") ? plugin : null; },
    querySelectorAll() { return [note]; },
  };
  const context = {
    window: {
      location: { hostname: hostname, pathname: path },
      setTimeout(callback) { queued.push(callback); },
      getSelection() { return { removeAllRanges() {}, addRange() {} }; },
    },
    document: {
      body: { appendChild(frame) { frames.push(frame); frame.parentNode = { removeChild() {} }; } },
      getElementById(id) { return mode === 'focus' && dialogOpen && id === 'note-4042' ? dialog : null; },
      querySelectorAll(selector) { return selector.includes("role=\"dialog\"") ? (dialogOpen && mode !== 'focus' ? [dialog] : []) : [row]; },
      createElement() { return { style: {} }; },
      createRange() { return { selectNodeContents() {}, collapse() {} }; },
    },
    File: class { constructor(parts, name, options) { this.parts = parts; this.name = name; this.type = options.type; } },
    Event: class {},
    atob(value) { return Buffer.from(value, "base64").toString("binary"); },
  };
  vm.createContext(context);
  vm.runInContext(receiver, context);
  const page = context.window.__DAGUANYUAN_NOTE_PASTE__;
  assert.equal(page.prepare(4042, "token", "image/png", "note.png"), true);
  page.append("token", "AQID");
  page.commit("token");
  for (let attempt = 0; queued.length && !frames.length && attempt < 100; attempt += 1) queued.shift()();
  assert.equal(dialogOpen, true);
  assert.equal(uploaded, true, frames[0] && frames[0].src);
  assert.match(frames[0].src, /status=saved/);
});

test('新版分类页和题单页均允许开始传输笔记图片', async () => {
  const image = { pngData() { return { length: 3, base64Encoding() { return 'AQID'; } }; } };
  for (const address of ['https://www.cxyonly.fans/math/practice/categories/345', 'https://www.cxyonly.fans/math/practice?listId=core&categoryId=345']) {
    const run = runtime(image, address);
    await assert.doesNotReject(run.paste.start(run.controller, 1214));
    assert.ok(run.scripts.some(script => script.includes('.commit(')));
  }
});

async function focusPage({ alreadyOpen = false, preview = false, anotherQuestion = false, rowShortcut = false, saveState = 'saved', markdown = false, uploadError = false, noUpload = false } = {}) {
  const image = { pngData() { return { length: 3, base64Encoding() { return 'AQID'; } }; } };
  const native = runtime(image, 'https://www.cxyonly.fans/math/practice?listId=core&categoryId=345');
  await native.paste.start(native.controller, 4042);
  const { document, Event } = parseHTML('<html><body><nav aria-label="当前题目工具"><button aria-controls="focus-tool-panel-note">笔记</button></nav>'
    + '<li data-learning-question-id="4042"><button data-daguanyuan-practice-add-note>添加笔记</button></li>'
    + (anotherQuestion ? '<li data-learning-question-id="4050"></li>' : '')
    + '<section id="focus-tool-panel-note" role="tabpanel"></section></body></html>');
  const row = document.querySelector('[data-learning-question-id]'), button = document.querySelector('nav button'), panel = document.getElementById('focus-tool-panel-note');
  const queued = [];
  let now = 0, opens = 0, edits = 0, uploads = 0;
  function mount() {
    panel.hidden = false; button.setAttribute('aria-expanded', 'true');
    panel.innerHTML = '<section aria-label="富文本题目笔记"><span data-state="' + saveState + '"></span><div data-note-rich-editor="true"' + (preview ? ' data-note-preview="true"' : '')
      + '><button aria-label="返回编辑">编辑</button><div data-note-editor="true" contenteditable="' + !preview + '"><p>原有笔记</p><img data-attachment-id="old"></div></div></section>';
    if (markdown) panel.innerHTML = '<section data-note-workspace="true" aria-label="题目笔记"><div data-note-save-feedback="full"><span data-state="' + saveState + '"></span></div><div data-note-markdown-editor="true"><button aria-label="返回编辑">编辑</button><textarea data-note-editor="true"' + (preview ? ' hidden' : '') + '>原有笔记</textarea></div></section>';
    const wrapper = panel.querySelector('[data-note-rich-editor], [data-note-markdown-editor]'), editor = wrapper.querySelector('[data-note-editor]');
    if (markdown) {
      editor.setSelectionRange = (start, end) => { editor.selectionStart = start; editor.selectionEnd = end; };
      wrapper.querySelector('button').addEventListener('click', () => { edits++; editor.hidden = false; });
      editor.addEventListener('paste', event => {
        assert.equal(event.target, editor); assert.equal(editor.selectionStart, editor.value.length);
        uploads++; event.preventDefault();
        if (uploadError) { wrapper.insertAdjacentHTML('beforeend', '<p role="status" data-tone="error">图片上传失败</p>'); return; }
        if (noUpload) return;
        const status = panel.querySelector('[data-state]'); status.setAttribute('data-state', 'saving');
        queued.push({ delay: 500, callback() { editor.value += '\n\n![图片说明](/v1/user/note-attachments/new-id)'; } });
        queued.push({ delay: 500, callback() { status.setAttribute('data-state', saveState); } });
      });
      editor.focus = () => {}; return;
    }
    editor.focus = () => {};
    wrapper.querySelector('button').addEventListener('click', () => { edits++; wrapper.removeAttribute('data-note-preview'); editor.setAttribute('contenteditable', 'true'); });
    wrapper.addEventListener('paste', event => {
      assert.equal(editor.getAttribute('contenteditable'), 'true');
      assert.equal(event.clipboardData.files[0].type, 'image/png');
      uploads++; editor.appendChild(document.createElement('img')).setAttribute('data-attachment-id', 'new');
    });
  }
  panel.hidden = !alreadyOpen; button.setAttribute('aria-expanded', String(alreadyOpen));
  if (alreadyOpen) mount();
  button.addEventListener('click', () => { opens++; mount(); });
  if (rowShortcut) {
    const shortcut = document.createElement('button'); shortcut.textContent = '查看笔记';
    shortcut.addEventListener('click', () => { throw Error('专注模式应使用有明确面板关联的工具栏入口'); }); row.appendChild(shortcut);
  }
  document.createRange = () => ({ selectNodeContents() {}, collapse() {} });
  const window = { location: { hostname: 'www.cxyonly.fans', pathname: '/math/practice', href: 'https://www.cxyonly.fans/math/practice?listId=core&categoryId=345' },
    setTimeout(callback, delay) { queued.push({ callback, delay }); }, getSelection() { return { removeAllRanges() {}, addRange() {} }; } };
  const context = vm.createContext({ document, window, Event, File: class { constructor(parts, name, options) { this.type = options.type; } },
    Date: { now() { return now; } }, atob(value) { return Buffer.from(value, 'base64').toString('binary'); } });
  vm.runInContext(native.scripts.find(script => script.includes('function pageReceiver()')), context);
  const api = window.__DAGUANYUAN_NOTE_PASTE__;
  assert.equal(api.prepare(4042, 'focus', 'image/png', 'note.png'), true);
  api.append('focus', 'AQID'); api.commit('focus');
  function step() { const task = queued.shift(); if (task) { now += task.delay; task.callback(); } }
  function flush() { for (let i = 0; queued.length && !document.querySelector('iframe') && i < 500; i++) step(); }
  return { document, row, panel, window, step, flush, stats() { return { opens, edits, uploads }; }, status() { return new URL(document.querySelector('iframe').src).searchParams.get('status'); } };
}

for (const alreadyOpen of [false, true]) test('专注练题页识别题卡外的笔记按钮，预览切换为编辑后追加图片：' + alreadyOpen, async () => {
  const run = await focusPage({ alreadyOpen, preview: true }); run.flush();
  assert.equal(run.status(), 'saved');
  assert.deepEqual(run.stats(), { opens: alreadyOpen ? 0 : 1, edits: 1, uploads: 1 });
  assert.match(run.panel.textContent, /原有笔记/);
  assert.equal(run.panel.querySelectorAll('img[data-attachment-id]').length, 2);
});

test('题卡外的笔记入口不会在多个题目之间猜测目标', async () => {
  const run = await focusPage({ anotherQuestion: true }); run.flush();
  assert.equal(run.stats().uploads, 0); assert.equal(run.stats().opens, 0);
  assert.equal(run.status(), 'editor-missing');
});

test('专注模式题卡也有查看笔记入口时优先使用明确关联外部面板的按钮', async () => {
  const run = await focusPage({ rowShortcut: true }); run.flush();
  assert.equal(run.status(), 'saved'); assert.equal(run.stats().uploads, 1);
});

for (const stage of ['before-paste', 'after-paste']) test('添加图片期间切题立即结束，避免向新题目的笔记粘贴：' + stage, async () => {
  const run = await focusPage({ alreadyOpen: true, saveState: 'saving' });
  if (stage === 'after-paste') for (let i = 0; run.stats().uploads === 0 && i < 10; i++) run.step();
  run.row.setAttribute('data-learning-question-id', '4050'); run.flush();
  assert.equal(run.status(), 'question-changed');
  assert.equal(run.stats().uploads, stage === 'after-paste' ? 1 : 0);
});

test('添加笔记区分编辑器未打开、题目已切换、图片粘贴失败与保存超时', () => {
  const run = runtime(null);
  for (const [status, expected] of [['editor-missing', /笔记编辑器/], ['question-changed', /题目已切换/], ['paste', /粘贴/], ['timeout', /尚未确认图片保存/]]) {
    run.controller.notePasteOperation = { token: 'test' };
    assert.match(run.paste.result(run.controller, 'test', status), expected);
  }
});

for (const preview of [false, true]) test('新版 Markdown 笔记向 textarea 粘贴，追加附件且确认保存：' + preview, async () => {
  const run = await focusPage({ alreadyOpen: true, markdown: true, preview }); run.flush();
  assert.equal(run.status(), 'saved'); assert.equal(run.stats().uploads, 1);
  assert.match(run.panel.querySelector('textarea').value, /^原有笔记\n\n!\[图片说明\]\(\/v1\/user\/note-attachments\/new-id\)$/);
});
test('新版 Markdown 图片上传失败及时结束，不把旧的已保存误认为成功', async () => {
  const run = await focusPage({ alreadyOpen: true, markdown: true, uploadError: true }); run.flush();
  assert.equal(run.status(), 'upload'); assert.equal(run.panel.querySelector('textarea').value, '原有笔记');
});
test('新版 Markdown 没有新增附件时，即使状态已保存也不能报成功', async () => {
  const run = await focusPage({ alreadyOpen: true, markdown: true, noUpload: true }); run.flush();
  assert.equal(run.status(), 'timeout');
});
