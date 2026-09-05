import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function selectionRuntime(note, mapping) {
  const context = {
    Application: {
      sharedInstance() {
        return {
          focusWindow: {},
          studyController() {
            return { notebookController: { mindmapView: { selViewLst: [{ note }] } } };
          },
        };
      },
    },
    encodeURIComponent,
    decodeURIComponent,
    JSON,
    Number,
    String,
    RegExp,
  };
  if (mapping) {
    context.__DAGUANYUAN_STORAGE_GLOBAL__ = {
      questionForNoteId(noteId) { return noteId === note.noteId ? mapping : undefined; },
    };
  }
  const source = readFileSync(new URL("../src/DaguanyuanSelection.js", import.meta.url), "utf8");
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.__DAGUANYUAN_SELECTION_GLOBAL__;
}

test("选中 408 HTML 题卡可从当前 tag 读取原题分类页和题目编号", () => {
  const url = "https://www.408os.cn/exercise?knowledgeId=12&knowledgeName=%E6%93%8D%E4%BD%9C%E7%B3%BB%E7%BB%9F";
  const selection = selectionRuntime({
    noteTitle: "2009 第25题",
    comments: [{ tag: `daguanyuan-question:v1|408os|25|${encodeURIComponent(url)}|操作系统`, text: "题干" }],
  });
  const selected = selection.firstSelectedQuestion({});

  assert.equal(selected.provider, "408os");
  assert.equal(selected.questionId, "25");
  assert.equal(selected.url, url);
  assert.match(selection.os408QuestionLocatorScript("25"), /question-wrapper\[data-question-id/);
});

test("没有 408 原题地址的题卡不会误跳转", () => {
  const selection = selectionRuntime({
    noteTitle: "2009 第25题",
    comments: [{ tag: "daguanyuan-question:v1|408os|25||操作系统", text: "题干" }],
  });

  assert.throws(() => selection.firstSelectedQuestion({}), /没有可用的原题信息/);
});

test("数学与 408 都可从统一隐藏元数据读取原题", () => {
  const mathURL = "https://cxyonly.fans/math/practice/329?resumeCategoryId=708&questionId=3592";
  const selection = selectionRuntime({
    noteId: "note-3592",
    noteTitle: "2020数一",
    comments: [{
      tag: `daguanyuan-question:v1|daguanyuan|3592|${encodeURIComponent(mathURL)}|${encodeURIComponent("高等数学 > （一）极限")}`,
      text: "题干",
    }],
  });

  const selected = selection.firstSelectedQuestion({});
  assert.equal(selected.provider, "daguanyuan");
  assert.equal(selected.questionId, "3592");
  assert.equal(selected.url, mathURL);
});

test("没有隐藏链接的旧题卡可从本地映射打开原题", () => {
  const url = "https://cxyonly.fans/math/questions/3592";
  const selection = selectionRuntime({ noteId: "old-note-1", noteTitle: "旧题卡", comments: [] }, {
    provider: "daguanyuan",
    questionId: "3592",
    url,
  });
  const selected = selection.firstSelectedQuestion({});
  assert.equal(selected.questionId, "3592");
  assert.equal(selected.url, url);
});

test("没有隐藏链接的极限学习集题卡可按祖先目录识别章节和题型", () => {
  const category = { noteTitle: "0/0", childNotes: [] };
  const functionLimit = { noteTitle: "函数极限", childNotes: [category], parentNote: null };
  const limitCalculation = { noteTitle: "极限计算", childNotes: [functionLimit], parentNote: null };
  const limit = { noteTitle: "极限", childNotes: [limitCalculation], parentNote: null };
  const root = { noteTitle: "函数极限连续", childNotes: [limit], parentNote: null };
  const question = { noteTitle: "1991数二", childNotes: [], parentNote: category };
  category.childNotes = [question];
  category.parentNote = functionLimit;
  functionLimit.parentNote = limitCalculation;
  limitCalculation.parentNote = limit;
  limit.parentNote = root;

  const selection = selectionRuntime(question);
  const result = selection.firstSelectedDaguanyuanCategory({});

  assert.equal(result.practiceId, "329");
  assert.deepEqual(Array.from(result.chapterPath), ["高等数学", "（一）极限"]);
  assert.deepEqual(Array.from(result.categoryPath), ["极限", "极限计算", "函数极限", "0/0"]);
});

test("没有隐藏链接的一元积分学习集题卡可识别为 224 章节", () => {
  const category = { noteTitle: "几何应用", childNotes: [] };
  const root = { noteTitle: "积分应用完整版", childNotes: [category], parentNote: null };
  const question = { noteTitle: "2024数二", childNotes: [], parentNote: category };
  category.childNotes = [question];
  category.parentNote = root;

  const selection = selectionRuntime(question);
  const result = selection.firstSelectedDaguanyuanCategory({});

  assert.equal(result.practiceId, "224");
  assert.deepEqual(Array.from(result.categoryPath), ["几何应用"]);
});
