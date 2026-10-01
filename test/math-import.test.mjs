import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const apiSource = readFileSync(new URL("../src/DaguanyuanMathApi.js", import.meta.url), "utf8");
const importSource = readFileSync(new URL("../src/DaguanyuanMathImport.js", import.meta.url), "utf8");
const locatorSource = readFileSync(new URL("../src/DaguanyuanCardLocator.js", import.meta.url), "utf8");
const retestSource = readFileSync(new URL("../src/DaguanyuanRetestBridge.js", import.meta.url), "utf8");
const addonSource = readFileSync(new URL("../src/WebAddon.js", import.meta.url), "utf8");
const panelSource = readFileSync(new URL("../src/WebPanelController.js", import.meta.url), "utf8");
const videoSource = readFileSync(new URL("../src/DaguanyuanVideoBrowser.js", import.meta.url), "utf8");

test("数学接口只保留题目内容，不导入答案", () => {
  let api;
  const context = { console };
  vm.createContext(context);
  vm.runInContext(apiSource, context);
  api = context.__DAGUANYUAN_MATH_API_GLOBAL__;
  const item = {
    id: 3356, category_id: 331, source: "1988数一二", stem: "题干",
    option_a: "选项 A", correct_answer: "秘密答案", answer_explanation: "秘密解析",
    question_type: "single_choice", category_full_path: "高等数学 / 极限",
  };
  const parsed = api.summary(item);
  assert.equal(parsed.id, 3356);
  assert.equal(parsed.options[0], "选项 A");
  assert.equal(JSON.stringify(parsed).includes("秘密答案"), false);
  assert.equal(JSON.stringify(parsed).includes("秘密解析"), false);
});

test("原生网络回调的 NSNull 错误值不阻止题目列表显示", async () => {
  class NSNull {}
  const payload = { data: { total: 1, items: [{ id: 3356, category_id: 331, stem: "题干" }] } };
  const context = {
    NSNull,
    NSURL: { URLWithString(url) { return url; } },
    NSMutableURLRequest: { requestWithURL(url) { return {
      url, setHTTPMethod() {}, setTimeoutInterval() {}, setAllHTTPHeaderFields() {},
    }; } },
    NSOperationQueue: { mainQueue() { return {}; } },
    NSJSONSerialization: { JSONObjectWithDataOptions() { return payload; } },
    NSURLConnection: { sendAsynchronousRequestQueueCompletionHandler(request, queue, completion) {
      completion({ statusCode: 200 }, { length: 100 }, new NSNull());
    } },
  };
  vm.createContext(context);
  vm.runInContext(apiSource, context);
  const result = await context.__DAGUANYUAN_MATH_API_GLOBAL__.questionPage(331, 1, "core");
  assert.equal(result.total, 1);
  assert.equal(result.questions[0].id, 3356);
});

test("分类题目接口只读取当前分类直接归属的题目", async () => {
  let requestedURL = "";
  const context = {
    NSURL: { URLWithString(url) { return url; } },
    NSMutableURLRequest: { requestWithURL(url) { return {
      url, setHTTPMethod() {}, setTimeoutInterval() {}, setAllHTTPHeaderFields() {},
    }; } },
    NSOperationQueue: { mainQueue() { return {}; } },
    NSJSONSerialization: { JSONObjectWithDataOptions() { return {
      data: { total: 1, items: [{ id: 7980, category_id: 1035, stem: "题目" }] },
    }; } },
    NSURLConnection: { sendAsynchronousRequestQueueCompletionHandler(request, queue, completion) {
      requestedURL = request.url;
      completion({ statusCode: 200 }, { length: 100 }, null);
    } },
  };
  vm.createContext(context);
  vm.runInContext(apiSource, context);
  const result = await context.__DAGUANYUAN_MATH_API_GLOBAL__.questionPage(1035, 2, "core");
  assert.match(requestedURL, /category_id=1035&include_children=false&page=2&per_page=20&scope=core/);
  assert.equal(result.questions[0].importCategoryId, 1035);
  assert.throws(() => context.__DAGUANYUAN_MATH_API_GLOBAL__.questionPage(1035, 1, "unknown"), /题库范围/);
});

test("图片题先读取题目图片，再交给 MarginNote 保存", async () => {
  const hash = "a".repeat(64);
  const requests = [];
  const context = {
    console,
    NSURL: { URLWithString(url) { return url; } },
    NSMutableURLRequest: { requestWithURL(url) { return {
      url, setHTTPMethod() {}, setTimeoutInterval() {}, setAllHTTPHeaderFields() {},
    }; } },
    NSOperationQueue: { mainQueue() { return {}; } },
    NSJSONSerialization: { JSONObjectWithDataOptions(data) { return data.question; } },
    NSURLConnection: { sendAsynchronousRequestQueueCompletionHandler(request, queue, completion) {
      requests.push(request.url);
      if (request.url.endsWith(hash)) {
        completion({ statusCode: 200, allHeaderFields: { "Content-Type": "image/png" } },
          { length: 12, base64Encoding: "iVBORw0KGgo=" }, null);
      } else {
        completion({ statusCode: 200 }, { length: 100, question: {
          id: 10940, category_ids: [848], stem: `图形 ![示意图](asset://sha256/${hash})`,
          option_a: "1", correct_answer: "A", answer_explanation: "解析",
        } }, null);
      }
    } },
  };
  vm.createContext(context);
  vm.runInContext(apiSource, context);
  const question = await context.__DAGUANYUAN_MATH_API_GLOBAL__.questionDetail(10940);
  assert.equal(question.hasBase64Image, true);
  assert.match(question.stem, /data:image\/png;base64,iVBORw0KGgo=/);
  assert.equal(requests.length, 2);
  assert.equal(JSON.stringify(question).includes("解析"), false);
});

test("图片读取失败时不会把失效的图片引用当作题目导入", async () => {
  const hash = "b".repeat(64);
  const context = {
    NSURL: { URLWithString(url) { return url; } },
    NSMutableURLRequest: { requestWithURL(url) { return {
      url, setHTTPMethod() {}, setTimeoutInterval() {}, setAllHTTPHeaderFields() {},
    }; } },
    NSOperationQueue: { mainQueue() { return {}; } },
    NSJSONSerialization: { JSONObjectWithDataOptions(data) { return data.question; } },
    NSURLConnection: { sendAsynchronousRequestQueueCompletionHandler(request, queue, completion) {
      if (request.url.endsWith(hash)) completion({ statusCode: 401 }, null, null);
      else completion({ statusCode: 200 }, { length: 100, question: {
        id: 10940, category_ids: [848], stem: `![图](asset://sha256/${hash})`,
      } }, null);
    } },
  };
  vm.createContext(context);
  vm.runInContext(apiSource, context);
  await assert.rejects(context.__DAGUANYUAN_MATH_API_GLOBAL__.questionDetail(10940), /图片接口请求失败：401/);
});

test("按直接分类跨页导入完整层级，失败可重试且重复题目跳过", async () => {
  const notebook = { topicId: "topic-1", notes: [] };
  let serial = 0;
  let failLast = true;
  let focused;
  const notes = {};
  function createNote(title) {
    const note = {
      noteId: `note-${++serial}`, noteTitle: title, comments: [], childNotes: [], parentNote: null,
      appendMarkdownComment(body) { this.comments.push({ text: body }); },
      addChild(child) {
        notebook.notes = notebook.notes.filter((item) => item !== child);
        child.parentNote = this;
        this.childNotes.push(child);
      },
    };
    notes[note.noteId] = note;
    notebook.notes.push(note);
    return note;
  }
  const all = Array.from({ length: 22 }, (_, index) => index + 7980);
  const context = {
    console,
    MNUtil: { getNoteById(id) { return notes[id]; } },
    Application: { sharedInstance() { return {
      studyController() { return {
        notebookController: { notebookId: "topic-1", changeFocusToNote(note) { focused = note; } },
        focusNoteInMindMapById() {},
        readerController: { currentDocumentController: { document: {} } },
      }; },
      refreshAfterDBChanged() {},
    }; } },
    Database: { sharedInstance() { return {
      getNotebookById() { return notebook; },
      getNoteById(id) { return notes[id]; },
      deleteBookNoteTree(id) { delete notes[id]; },
    }; } },
    Note: { createWithTitleNotebookDocument(title) { return createNote(title); } },
    UndoManager: { sharedInstance() { return { undoGrouping(label, id, callback) { callback(); } }; } },
    NSTimer: { scheduledTimerWithTimeInterval(delay, repeat, callback) {
      let active = true;
      const timer = { invalidate() { active = false; } };
      if (delay < 1) queueMicrotask(() => { if (active) callback(timer); });
      return timer;
    } },
    __DAGUANYUAN_MATH_API_GLOBAL__: {
      positiveInteger(value) { const number = Number(value); if (!Number.isSafeInteger(number) || number < 1) throw new Error("无效"); return number; },
      questionScope(value) { return value; },
      questionPage(categoryId, page, scope) {
        assert.equal(scope, "core");
        if (categoryId === 855) return Promise.resolve({ page, pageSize: 20, total: 0, questions: [] });
        const ids = all.slice((page - 1) * 20, page * 20);
        return Promise.resolve({ page, pageSize: 20, total: all.length, questions: ids.map((id) => ({ id })) });
      },
      questionDetail(id) {
        if (id === 8001 && failLast) return Promise.reject(new Error("图片缺失"));
        return Promise.resolve({ id, categoryId: id === 7982 ? 1029 : 1035,
          categoryIds: id === 7982 ? [1029, 1035] : [1035],
          source: `2026数二（${id - 7979}）`, stem: `题目 ${id}`, options: [] });
      },
    },
    __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__: {
      resultForCategoryId(id) { return {
        status: "resolved", categoryId: id,
        path: id === 1035 ? ["历年真题", "数二", "2026"] : id === 1029
          ? ["历年真题", "数一", "2026"] : ["历年真题", "数二"],
      }; },
      urlFor(route) { return `https://www.cxyonly.fans/math/practice/${route.categoryId}`; },
      resolve(path) { return { status: "resolved", categoryId: 1035, matchedSegments: path.length }; },
    },
  };
  vm.createContext(context);
  vm.runInContext(importSource, context);
  vm.runInContext(locatorSource, context);
  const importer = context.__DAGUANYUAN_MATH_IMPORT_GLOBAL__;
  const addon = { window: {} };
  const elsewhere = createNote('别处的单题父卡片');
  const single = createNote('单题导入');
  single.appendMarkdownComment('<!-- DAGUANYUAN_QUESTION_ID:7980 -->\n<!-- DAGUANYUAN_SINGLE_IMPORT:1 -->');
  elsewhere.addChild(single);
  const first = await importer.importCategory(addon, 1035, "core");
  assert.equal(first.total, 22);
  assert.equal(first.createdCount, 21);
  assert.equal(first.failed.length, 1);
  const root = notebook.notes.find(note => note.noteTitle === 'Daguanyuan Bridge');
  assert.equal(root.noteTitle, "Daguanyuan Bridge");
  const year = root.childNotes[0].childNotes[0].childNotes[0];
  assert.deepEqual(year.childNotes.map((card) => card.noteTitle),
    all.slice(0, 21).map((id) => `2026数二（${id - 7979}）`));
  assert.match(year.childNotes[2].comments[0].text, /practice\/1035\?questionId=7982/);
  assert.equal(importer.questionForNote(year.childNotes[2]).url.includes("practice/1035"), true);
  failLast = false;
  const second = await importer.importCategory(addon, 1035, "core");
  assert.equal(second.createdCount, 1);
  assert.equal(second.skippedCount, 21);
  assert.equal(second.failed.length, 0);
  assert.equal(serial, 28);
  assert.equal((await importer.focusQuestion(addon, 8001)).noteId, year.childNotes[21].noteId);
  assert.equal(focused, year.childNotes[21]);
  delete notes[year.childNotes[0].noteId];
  const afterDelete = await importer.importCategory(addon, 1035, 'core');
  assert.equal(afterDelete.createdCount, 1, '旧子节点对象残留不能阻止删除后重新导入');
  assert.equal(afterDelete.skippedCount, 21);
  const moved = year.childNotes[1];
  year.childNotes = year.childNotes.filter(note => note !== moved);
  elsewhere.addChild(moved);
  const afterMove = await importer.importCategory(addon, 1035, 'core');
  assert.equal(afterMove.createdCount, 1, '移出目标分类后可以重新导入，不受别处同题卡影响');
  assert.equal(afterMove.skippedCount, 21);
  assert.equal(single.parentNote, elsewhere);
  const empty = await importer.importCategory(addon, 855, "core");
  assert.equal(empty.total, 0);
  assert.equal(empty.createdCount, 0);
});

test("错题复测待复测题和未来计划都显示定位按钮并回传题目 ID", () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(retestSource, context);
  const script = context.__DAGUANYUAN_RETEST_BRIDGE_GLOBAL__.script(true, true);
  function element(attributes = {}) {
    return {
      attributes, children: [], parentNode: null, handlers: {}, style: {},
      get nextSibling() {
        if (!this.parentNode) return null;
        return this.parentNode.children[this.parentNode.children.indexOf(this) + 1] || null;
      },
      getAttribute(name) { return this.attributes[name] || null; },
      setAttribute(name, value) { this.attributes[name] = value; },
      appendChild(child) { child.parentNode = this; this.children.push(child); },
      insertBefore(child, sibling) {
        if (child.parentNode) child.parentNode.removeChild(child);
        child.parentNode = this;
        const index = this.children.indexOf(sibling);
        this.children.splice(index < 0 ? this.children.length : index, 0, child);
      },
      removeChild(child) { this.children = this.children.filter((item) => item !== child); child.parentNode = null; },
      querySelector(selector) {
        if (selector === "[data-daguanyuan-locate-card]")
          return this.children.find((child) => child.attributes["data-daguanyuan-locate-card"]) || null;
        if (selector === "[data-daguanyuan-retest-add-note]")
          return this.children.find((child) => child.attributes["data-daguanyuan-retest-add-note"]) || null;
        return null;
      },
      addEventListener(name, callback) { this.handlers[name] = callback; },
    };
  }
  const due = element({ "data-retest-question-id": "3356" });
  const future = element({ "data-retest-schedule-question-id": "3356" });
  const other = element({ "data-retest-question-id": "7980" });
  const timers = [];
  const body = element();
  const browser = {
    window: { location: { pathname: "/math/retest" }, setTimeout(callback) { timers.push(callback); return timers.length; } },
    document: {
      documentElement: element(), body,
      querySelectorAll(selector) {
        if (selector === "[data-retest-question-id]") return [due, other];
        if (selector === "[data-retest-schedule-question-id]") return [future];
        if (selector === "[data-retest-question-id], [data-retest-schedule-question-id]") return [due, other, future];
        return [];
      },
      createElement() { return element(); },
    },
    MutationObserver: class { observe() {} },
    encodeURIComponent,
  };
  vm.createContext(browser);
  vm.runInContext(script, browser);
  timers.shift()();
  const dueButton = due.querySelector("[data-daguanyuan-locate-card]");
  const futureButton = future.querySelector("[data-daguanyuan-locate-card]");
  const otherButton = other.querySelector("[data-daguanyuan-locate-card]");
  assert.equal(dueButton?.textContent, "定位卡片");
  assert.equal(futureButton?.textContent, "定位卡片");
  assert.equal(otherButton?.textContent, "定位卡片");
  const noteButton = due.querySelector("[data-daguanyuan-retest-add-note]");
  assert.equal(noteButton?.textContent, "添加笔记");
  assert.deepEqual(due.children.slice(0, 2), [dueButton, noteButton]);
  assert.equal(noteButton.style.cssText, dueButton.style.cssText);
  noteButton.handlers.click.call(noteButton, { preventDefault() {}, stopPropagation() {} });
  assert.equal(body.children.at(-1).src, "daguanyuanbridge://add-note?id=3356");
  timers.shift()();
  vm.runInContext(context.__DAGUANYUAN_RETEST_BRIDGE_GLOBAL__.script(false), browser);
  timers.shift()();
  assert.equal(due.querySelector("[data-daguanyuan-locate-card]"), null);
  assert.equal(future.querySelector("[data-daguanyuan-locate-card]"), null);
  vm.runInContext(context.__DAGUANYUAN_RETEST_BRIDGE_GLOBAL__.script(true), browser);
  timers.shift()();
  const restoredButton = future.querySelector("[data-daguanyuan-locate-card]");
  assert.equal(restoredButton?.textContent, "定位卡片");
  restoredButton.handlers.click.call(restoredButton, { preventDefault() {}, stopPropagation() {} });
  assert.equal(body.children[0].src, "daguanyuanbridge://locate-card?id=3356");
});

test("新导入题卡使用默认字号", () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(importSource, context);
  const markdown = context.__DAGUANYUAN_MATH_IMPORT_GLOBAL__.questionMarkdown(
    { id: 3356, stem: "题干", options: ["选项一", "选项二"] },
    "https://www.cxyonly.fans/math/practice/855?questionId=3356",
  );
  assert.match(markdown, /题干\n\nA\. 选项一/);
  assert.doesNotMatch(markdown, /<small>/);
});

test("408 建卡整理格式时保留代码块缩进、连续空行和美元符号", () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(importSource, context);
  const code = '```\nwhile (x) {\n  x--;\n\n\n  price = "$ value $";  \n}\n```';
  const markdown = context.__DAGUANYUAN_MATH_IMPORT_GLOBAL__.questionMarkdown({
    id: 806, stem: '若 $ G $ 无环。\n\n' + code, options: ['代码选项\n\n' + code, code],
  }, 'https://www.408os.cn/exercise?year=2026', '408');
  assert.equal(markdown.split(code).length, 4);
  assert.ok(markdown.includes('B.\n\n' + code));
  assert.ok(markdown.includes('若 $G$ 无环。'));
  assert.ok(markdown.includes('DAGUANYUAN_408_QUESTION_ID:806'));
});

test("新题卡规范网站公式边界空格并保留公式内部内容", () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(importSource, context);
  const markdown = context.__DAGUANYUAN_MATH_IMPORT_GLOBAL__.questionMarkdown({
    id: 3382,
    stem: String.raw`设 $ f(u) $ 为偶函数，求 $ \int_{0}^{x} f(t)\,dt $；另有 $$\int_0^x f(t)dt$$`,
    options: [String.raw`$ \int_{a}^{x}\left[\int_{0}^{u}tf(t)dt\right]du $ 为偶函数`, "$f(x)$ 不变"],
  }, "https://www.cxyonly.fans/math/practice/345?questionId=3382");
  assert.match(markdown, /\$f\(u\)\$/);
  assert.match(markdown, /\$\\int_\{0\}\^\{x\} f\(t\)\\,dt\$/);
  assert.match(markdown, /\$\$\n\\int_0\^x f\(t\)dt\n\$\$/);
  assert.match(markdown, /A\. \$\\int_\{a\}/);
  assert.match(markdown, /B\. \$f\(x\)\$/);
  assert.doesNotMatch(markdown, /\$ f\(u\) \$|\$ \\int_\{a\}/);
});

test("分段公式选项让双美元符号独占行，避免显示 cases 原文", () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(importSource, context);
  const markdown = context.__DAGUANYUAN_MATH_IMPORT_GLOBAL__.questionMarkdown({
    id: 3359,
    stem: String.raw`设
$$
f(x)=\begin{cases}x^2, & x\le 0,\\x^2+x, & x\gt 0,\end{cases}
$$
则 $f(-x)=$（ ）。`,
    options: [String.raw`$$
\begin{cases}-x^2, & x\le 0,\\-x^2-x, & x\gt 0.\end{cases}
$$`, String.raw`文字 $$\begin{cases}x, & x\le 0\end{cases}$$ 结束`],
  }, "https://www.cxyonly.fans/math/practice/321?resumeCategoryId=331&questionId=3359");
  assert.match(markdown, /A\.\n\n\$\$\n\\begin\{cases\}-x\^2/);
  assert.match(markdown, /B\. 文字\n\n\$\$\n\\begin\{cases\}x/);
  assert.match(markdown, /\n\$\$\n\n结束/);
  assert.doesNotMatch(markdown, /A\. \$\$|B\. 文字 \$\$/);
  assert.match(markdown, /<\!-- DAGUANYUAN_QUESTION_ID:3359 -->/);
});

test("导入卡片点击定位题目时按保存的 ID 打开大观园", () => {
  let opened;
  const context = {
    JSB: { defineClass(name, methods) { return methods; } },
    __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__: { currentFocus() { return { noteId: "card-1" }; } },
    __DAGUANYUAN_MATH_IMPORT_GLOBAL__: { questionForNote() {
      return { id: 3356, url: "https://www.cxyonly.fans/math/practice/321?resumeCategoryId=331&questionId=3356" };
    } },
    __DAGUANYUAN_WEB_PANEL_GLOBAL__: { openDaguanyuanQuestion(controller, route) { opened = route; } },
    console,
  };
  vm.createContext(context);
  vm.runInContext(addonSource, context);
  context.self = { panelController: {} };
  context.createDaguanyuanBridgeAddon().locateQuestion();
  assert.equal(opened.questionId, 3356);
  assert.equal(opened.questionNumber, 0);
  assert.equal(opened.imported, true);
});

test("导入卡片定位会选择网站完整题库范围", () => {
  const context = { JSB: { defineClass(name, methods) { return methods; } }, console };
  vm.createContext(context);
  vm.runInContext(panelSource, context);
  const script = context.__DAGUANYUAN_WEB_PANEL_GLOBAL__.questionLocatorScript({ questionId: 3356, questionNumber: 0, imported: true });
  assert.match(script, /var imported = true/);
  assert.match(script, /'完整'/);
  assert.match(script, /aria-pressed/);
});

test("错题复测按钮命令在插件层等待题卡定位完成", async () => {
  let focusedId;
  let panelMethods;
  const context = {
    JSB: { defineClass(name, methods) { panelMethods = methods; return { new() { return {}; } }; } },
    __DAGUANYUAN_MATH_IMPORT_GLOBAL__: { focusQuestion(addon, id) { focusedId = id; } },
    Application: { sharedInstance() { return { showHUD() {} }; } },
    console,
  };
  vm.createContext(context);
  vm.runInContext(videoSource, context);
  vm.runInContext(panelSource, context);
  const webView = {};
  context.self = { webView, addon: { window: {} } };
  const allowed = panelMethods.webViewShouldStartLoadWithRequestNavigationType(webView, {
    URL: { absoluteString: "daguanyuanbridge://locate-card?id=3356" },
  });
  assert.equal(allowed, false);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(focusedId, 3356);
});

test("错题复测页面无需先读取笔记本索引也能注入定位按钮", () => {
  const injected = [];
  const context = {
    JSB: { defineClass() { return { new() { return {}; } }; } },
    __DAGUANYUAN_RETEST_BRIDGE_GLOBAL__: { script() { return "retest-buttons"; } },
    __DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__: {
      practiceScript() { return "practice-buttons"; },
      bindCategoryScript() { return "bind-button"; },
      singleImportScript() { return "single-button"; },
    },
    NSUserDefaults: { standardUserDefaults() { return { objectForKey() { return true; } }; } },
    __DAGUANYUAN_MATH_IMPORT_GLOBAL__: { importedQuestionIds() { throw new Error("笔记本未打开"); } },
    console,
  };
  vm.createContext(context);
  vm.runInContext(panelSource, context);
  context.__DAGUANYUAN_WEB_PANEL_GLOBAL__.refreshRetestButtons({
    webView: { evaluateJavaScript(script, callback) { injected.push(script); callback(true, null); } },
  });
  assert.deepEqual(injected, ["retest-buttons", "practice-buttons", "bind-button", "single-button"]);
});

test("题目导航开关同时控制题目页和错题复测网页按钮", () => {
  let methods;
  const stored = {};
  const injected = [];
  const context = {
    JSB: { defineClass(name, instanceMethods) { methods = instanceMethods; return { new() { return {}; } }; } },
    NSUserDefaults: { standardUserDefaults() {
      return {
        objectForKey(key) { return stored[key]; },
        setObjectForKey(value, key) { stored[key] = value; },
      };
    } },
    __DAGUANYUAN_RETEST_BRIDGE_GLOBAL__: { script(enabled) { return `retest-${enabled}`; } },
    __DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__: { practiceScript(enabled) { return `practice-${enabled}`; } },
    console,
  };
  vm.createContext(context);
  vm.runInContext(panelSource, context);
  context.self = {
    websiteLocateSwitch: { on: true },
    webView: { evaluateJavaScript(script, callback) { injected.push(script); callback(true, null); } },
  };
  methods.toggleWebsiteLocateCards({ on: false });
  assert.equal(context.self.websiteLocateSwitch.on, false);
  assert.deepEqual(injected, ["retest-false", "practice-false"]);
  assert.equal(stored["cn.marginnote.daguanyuan-bridge.question-navigation.website-locate-card-visible"], false);
  methods.toggleWebsiteLocateCards({ on: true });
  assert.equal(context.self.websiteLocateSwitch.on, true);
  assert.deepEqual(injected.slice(2), ["retest-true", "practice-true"]);
});

test("题目工具中的添加笔记开关默认关闭并独立控制两个网页按钮", () => {
  let methods;
  const stored = {};
  const injected = [];
  const context = {
    JSB: { defineClass(name, instanceMethods) { methods = instanceMethods; return { new() { return {}; } }; } },
    NSUserDefaults: { standardUserDefaults() {
      return {
        objectForKey(key) { return stored[key]; },
        setObjectForKey(value, key) { stored[key] = value; },
      };
    } },
    __DAGUANYUAN_RETEST_BRIDGE_GLOBAL__: { script(locate, note) { return `retest-${locate}-${note}`; } },
    __DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__: { practiceScript(locate, note) { return `practice-${locate}-${note}`; } },
    console,
  };
  vm.createContext(context);
  vm.runInContext(panelSource, context);
  context.self = {
    noteAddSwitch: { on: false },
    webView: { evaluateJavaScript(script, callback) { injected.push(script); callback(true, null); } },
  };
  methods.toggleNoteAddDisplay({ on: true });
  assert.equal(context.self.noteAddSwitch.on, true);
  assert.deepEqual(injected, ["retest-true-true", "practice-true-true"]);
  assert.equal(stored["cn.marginnote.daguanyuan-bridge.question-tools.add-note-visible"], true);
  methods.toggleNoteAddDisplay({ on: false });
  assert.equal(context.self.noteAddSwitch.on, false);
  assert.deepEqual(injected.slice(2), ["retest-true-false", "practice-true-false"]);
});
