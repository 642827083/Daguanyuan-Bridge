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
  };
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

test("先解析当前笔记本中的题卡，再按 noteId 执行聚焦", () => {
  const focusOrder = [];
  const question = {
    noteId: "note-3571",
    noteTitle: "题目 3571｜2002数二",
    comments: [{ text: "<!-- DAGUANYUAN_URL:https://cxyonly.fans/math/practice/329?page=1&questionId=3571 -->" }],
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
    /当前笔记本中未找到题目 3571，请先导入所在分类/,
  );
});
