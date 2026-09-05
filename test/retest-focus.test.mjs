import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../src/DaguanyuanRetest.js", import.meta.url), "utf8");

function runtime(overrides = {}) {
  const context = {
    console,
    Application: overrides.Application || {},
    Database: overrides.Database || {},
    Number,
    String,
    Array,
    Object,
    RegExp,
    NSURL: overrides.NSURL,
  };
  if (overrides.storage) context.__DAGUANYUAN_STORAGE_GLOBAL__ = overrides.storage;
  if (overrides.NSTimer) context.NSTimer = overrides.NSTimer;
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.__DAGUANYUAN_RETEST_GLOBAL__;
}

test("从大观园题目地址和插件指令中读取题目 ID", () => {
  const retest = runtime();
  assert.equal(retest.questionIdFromURL("https://cxyonly.fans/math/questions/3571?returnTo=%2Fmath%2Fretest"), "3571");
  assert.equal(retest.questionIdFromURL("https://cxyonly.fans/math/practice/329?page=1&questionId=3592"), "3592");
  assert.equal(retest.questionIdFromURL("https://example.com/math/questions/3571"), "");
  assert.equal(retest.questionIdFromBridgeURL("daguanyuanbridge://focus-question?questionId=3571"), "3571");
  assert.equal(retest.questionIdFromBridgeURL("daguanyuanbridge://focus-question/?questionId=3571"), "3571");
  assert.equal(retest.questionIdFromBridgeURL("daguanyuanbridge://focus-question?questionId=bad"), "");
});

test("错题复测页面为每道题幂等加入定位脑图按钮", () => {
  const retest = runtime();
  const listeners = {};
  const attributes = {};
  let insertCount = 0;
  const parent = {
    inserted: undefined,
    querySelector() {
      return this.inserted;
    },
    insertBefore(button) {
      this.inserted = button;
      insertCount += 1;
    },
  };
  const anchor = {
    className: "question-link",
    parentNode: parent,
    getAttribute(name) {
      return name === "href" ? "/math/questions/3571?returnTo=%2Fmath%2Fretest" : "";
    },
  };
  const document = {
    documentElement: {},
    querySelectorAll(selector) {
      assert.equal(selector, 'a[href*="/math/questions/"]');
      return [anchor];
    },
    createElement(tagName) {
      assert.equal(tagName, "button");
      return {
        style: {},
        setAttribute(name, value) {
          attributes[name] = value;
        },
        addEventListener(name, listener) {
          listeners[name] = listener;
        },
      };
    },
  };
  const location = { hostname: "cxyonly.fans", pathname: "/math/retest", href: "https://cxyonly.fans/math/retest" };
  const window = { location };
  function MutationObserver() {
    this.observe = function () {};
  }

  vm.runInNewContext(retest.enhancementScript(), { document, location, window, MutationObserver });
  vm.runInNewContext(retest.enhancementScript(), { document, location, window, MutationObserver });

  assert.equal(insertCount, 1);
  assert.equal(parent.inserted.textContent, "定位脑图");
  assert.equal(attributes["data-daguanyuan-focus-question"], "3571");
  listeners.click({ preventDefault() {} });
  assert.equal(location.href, "daguanyuanbridge://focus-question?questionId=3571");
});

test("打开选中题目流程先解析当前笔记本中的题卡，再按 noteId 执行聚焦", () => {
  const focusOrder = [];
  const question = {
    noteId: "note-3571",
    noteTitle: "2002数二",
    comments: [{ text: "<!-- DAGUANYUAN_QUESTION_ID:3571 -->\n<!-- DAGUANYUAN_URL:https://cxyonly.fans/math/practice/329?page=1&questionId=3571 -->" }],
    childNotes: [],
  };
  const root = {
    noteId: "root-note",
    noteTitle: "Daguanyuan Bridge",
    allNoteText() {
      return question.comments[0].text;
    },
    childNotes: [{ noteTitle: "高等数学", childNotes: [question] }],
  };
  const studyController = {
    notebookController: {
      notebookId: "notebook-1",
      changeFocusToNote(note) {
        focusOrder.push(`select:${note.noteId}`);
      },
    },
    focusNoteInMindMapById(noteId) {
      focusOrder.push(`scroll:${noteId}`);
    },
  };
  const retest = runtime({
    Application: { sharedInstance() { return { studyController() { return studyController; } }; } },
    Database: { sharedInstance() { return { getNotebookById() { return { notes: [root] }; } }; } },
  });

  const addon = { window: {} };
  const result = retest.resolveQuestionCard(addon, "3571");
  assert.equal(result.questionId, "3571");
  assert.equal(result.noteId, "note-3571");
  assert.equal(result.note, question);
  assert.deepEqual(focusOrder, []);
  retest.focusQuestionCard(addon, result.note, result.noteId);
  assert.deepEqual(focusOrder, ["select:note-3571", "scroll:note-3571"]);
});

test("当前笔记本没有对应导入题卡时给出明确提示", () => {
  const studyController = {
    notebookController: { notebookId: "notebook-1", changeFocusToNote() {} },
    focusNoteInMindMapById() {},
  };
  const retest = runtime({
    Application: { sharedInstance() { return { studyController() { return studyController; } }; } },
    Database: { sharedInstance() { return { getNotebookById() { return { notes: [] }; } }; } },
  });

  assert.throws(
    () => retest.focusQuestionInMindMap({ window: {} }, "3571"),
    /当前笔记本中未找到题目 3571，请先导入该题目/,
  );
});

test("错题复测只调用官方定位接口，不切换卡片焦点或直接滚动脑图", () => {
  let focusCalls = 0;
  let focusChangeCalls = 0;
  const studyController = {
    notebookController: {
      changeFocusToNote() { focusChangeCalls += 1; },
    },
    focusNoteInMindMapById(noteId) {
      assert.equal(noteId, "note-3571");
      focusCalls += 1;
    },
  };
  const retest = runtime({
    Application: { sharedInstance() { return { studyController() { return studyController; } }; } },
  });

  assert.equal(retest.focusRetestQuestionCard({ window: {} }, "note-3571"), "note-3571");
  assert.equal(focusCalls, 1);
  assert.equal(focusChangeCalls, 0);
  assert.doesNotMatch(source, /setContentOffsetAnimated|mindmapNodes|scrollQuestionCard/);
});

test("错题复测缺少官方定位接口时给出明确提示", () => {
  const studyController = { notebookController: {} };
  const retest = runtime({
    Application: { sharedInstance() { return { studyController() { return studyController; } }; } },
  });

  assert.throws(
    () => retest.focusRetestQuestionCard({ window: {} }, "note-3571"),
    /当前 MarginNote 版本不支持脑图卡片定位/,
  );
});

test("错题复测调用后验证可见焦点，未成功时按参考插件节奏重试", () => {
  const timers = [];
  let focusCalls = 0;
  const notebookController = { notebookId: "book-1" };
  const studyController = {
    notebookController,
    focusNoteInMindMapById() { focusCalls += 1; },
  };
  const retest = runtime({
    Application: { sharedInstance() { return { studyController() { return studyController; } }; } },
    NSTimer: {
      scheduledTimerWithTimeInterval(interval, repeats, callback) {
        timers.push({ interval, repeats, callback });
      },
    },
  });
  const addon = { window: {} };

  retest.startQuestionNavigation(addon, { noteId: "note-3571", notebookId: "book-1" });
  assert.equal(focusCalls, 1);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].interval, 0.08);
  timers.shift().callback();
  assert.equal(timers.length, 1);
  assert.equal(timers[0].interval, 0.25);
  assert.equal(timers[0].repeats, false);

  notebookController.visibleFocusNote = { noteId: "note-3571" };
  timers.shift().callback();
  assert.equal(focusCalls, 2);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].interval, 0.08);
  timers.shift().callback();
  assert.equal(addon.__daguanyuanPendingNavigation, null);
  assert.equal(retest.isRetestQuestionCardFocused(addon, "note-3571"), true);
});

test("错题复测以原生 URL 打开目标学习集，并只在目标学习集打开后重新定位", () => {
  const timers = [];
  let focusCalls = 0;
  const openCalls = [];
  const nativeURLs = [];
  const notebookController = { topicId: "old-topic", notebookId: "controller-1" };
  const studyController = {
    notebookController,
    focusNoteInMindMapById() { focusCalls += 1; },
  };
  const retest = runtime({
    Application: { sharedInstance() { return {
      studyController() { return studyController; },
      openURL(url) { openCalls.push({ url, argumentsLength: arguments.length }); },
    }; } },
    NSURL: {
      URLWithString(value) {
        nativeURLs.push(value);
        return { value };
      },
    },
    NSTimer: {
      scheduledTimerWithTimeInterval(interval, repeats, callback) {
        timers.push({ interval, repeats, callback });
      },
    },
  });
  const addon = {
    window: {},
  };

  retest.startQuestionNavigation(addon, {
    noteId: "note-3571",
    notebookId: "topic-1",
    notebookIds: ["topic-1", "notebook-1"],
  });
  assert.deepEqual(nativeURLs, ["marginnote3app://note/note-3571"]);
  assert.equal(openCalls.length, 1);
  assert.deepEqual(openCalls[0].url, { value: "marginnote3app://note/note-3571" });
  assert.equal(openCalls[0].argumentsLength, 1);
  assert.equal(retest.resumePendingNavigation(addon, "another-topic"), false);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].interval, 0.25);
  assert.equal(retest.resumePendingNavigation(addon, "topic-1"), true);
  assert.equal(timers.length, 2);
  assert.equal(timers[1].interval, 0.2);
  notebookController.topicId = "topic-1";
  timers[1].callback();
  assert.equal(focusCalls, 1);
  assert.equal(timers.length, 3);
  assert.equal(timers[2].interval, 0.08);
});

test("错题复测不会在旧学习集打开回调后开始定位", () => {
  const timers = [];
  let focusCalls = 0;
  const studyController = {
    notebookController: { notebookId: "old-book" },
    focusNoteInMindMapById() { focusCalls += 1; },
  };
  const retest = runtime({
    Application: { sharedInstance() { return { studyController() { return studyController; } }; } },
    NSTimer: {
      scheduledTimerWithTimeInterval(interval, repeats, callback) {
        timers.push({ interval, repeats, callback });
      },
    },
  });
  const addon = {
    window: {},
    __daguanyuanPendingNavigation: {
      runId: "pending-run",
      noteId: "note-3571",
      notebookId: "target-book",
      notebookIds: ["target-book"],
      attempt: 0,
      timerScheduled: false,
    },
  };

  assert.equal(retest.resumePendingNavigation(addon, "old-book"), false);
  assert.equal(timers.length, 0);
  assert.equal(focusCalls, 0);
});

test("错题复测可通过旧学习集本地映射找到任意根目录下的题卡", () => {
  const question = { noteId: "old-note-3571", noteTitle: "无隐藏链接题卡", comments: [], childNotes: [] };
  const notebook = { notes: [{ noteId: "custom-root", noteTitle: "极限题目册", childNotes: [question] }] };
  const studyController = {
    notebookController: { notebookId: "book-1", changeFocusToNote() {} },
    focusNoteInMindMapById() {},
  };
  const retest = runtime({
    Application: { sharedInstance() { return { studyController() { return studyController; } }; } },
    Database: { sharedInstance() { return { getNotebookById() { return notebook; } }; } },
    storage: {
      noteIdForQuestion(provider, questionId, notebookId) {
        return provider === "daguanyuan" && questionId === "3571" && notebookId === "book-1" ? "old-note-3571" : "";
      },
    },
  });

  const result = retest.resolveQuestionCard({ window: {} }, "3571");
  assert.equal(result.noteId, "old-note-3571");
  assert.equal(result.note, question);
});
