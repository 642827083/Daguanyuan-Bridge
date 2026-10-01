import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../src/DaguanyuanNotePaste.js", import.meta.url), "utf8");

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
    querySelector() { return editor; },
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

test("窄面板的题目笔记弹窗在卡片外仍能添加图片", async () => {
  const image = { pngData() { return { length: 3, base64Encoding() { return "AQID"; } }; } };
  const { controller, scripts, paste } = runtime(image, "https://cxyonly.fans/math/retest");
  await paste.start(controller, 4042);
  const receiver = scripts.find((script) => script.includes("function pageReceiver()"));
  const queued = [];
  const frames = [];
  let dialogOpen = false;
  let uploaded = false;
  const note = { textContent: "查看笔记", hasAttribute() { return false; }, click() { dialogOpen = true; } };
  const plugin = { textContent: "添加笔记", disabled: false };
  const editor = { lastChild: null, focus() {} };
  const wrapper = {
    querySelector() { return editor; },
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
    getAttribute(name) { return name === "data-retest-question-id" ? "4042" : null; },
    querySelector(selector) { return selector.includes("data-daguanyuan") ? plugin : null; },
    querySelectorAll() { return [note]; },
  };
  const context = {
    window: {
      location: { hostname: "cxyonly.fans", pathname: "/math/retest" },
      setTimeout(callback) { queued.push(callback); },
      getSelection() { return { removeAllRanges() {}, addRange() {} }; },
    },
    document: {
      body: { appendChild(frame) { frames.push(frame); frame.parentNode = { removeChild() {} }; } },
      querySelectorAll(selector) { return selector.includes("role=\"dialog\"") ? (dialogOpen ? [dialog] : []) : [row]; },
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
