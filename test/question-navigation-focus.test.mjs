import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const sources = ["DaguanyuanFocusNextCore", "WebAddon"]
  .map(name => readFileSync(new URL(`../src/${name}.js`, import.meta.url), "utf8"));

function runtime() {
  const opened = [];
  const messages = [];
  const parent = { noteId: "parent", noteTitle: "极限", childNotes: [] };
  const notebook = { notebookId: "book" };
  const addon = { window: {}, panelController: {} };
  const context = {
    self: addon,
    JSB: { defineClass(name, methods) { return methods; } },
    Application: { sharedInstance() { return {
      studyController() { return { notebookController: notebook }; },
      showHUD(message) { messages.push(message); },
    }; } },
    __DAGUANYUAN_CATEGORY_MAPPING_STORE_GLOBAL__: {
      binding408ForSource() { return null; },
      bindingForSource() { return { targetCategoryId: 331 }; },
    },
    __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__: {
      resultForCategoryId(id) { return { status: "resolved", categoryId: id }; },
      questionRouteFor(result, index) { return {
        url: `https://www.cxyonly.fans/math/practice/${result.categoryId}`,
        questionNumber: index,
      }; },
    },
    __DAGUANYUAN_WEB_PANEL_GLOBAL__: {
      openDaguanyuanQuestion(controller, route) { opened.push(route); },
      open408Question(controller, url, index) { opened.push({ provider: '408', url, questionNumber: index }); },
      shouldRestorePanel() { return false; },
    },
    console,
  };
  vm.createContext(context);
  sources.forEach(source => vm.runInContext(source, context));
  const methods = context.createDaguanyuanBridgeAddon();
  const core = context.__DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__;
  function card(id, provider) {
    const comments = provider === "math" ? [{ text:
      `题干\n<!-- DAGUANYUAN_QUESTION_ID:${id} -->\n` +
      `<!-- DAGUANYUAN_URL:https://www.cxyonly.fans/math/practice/331?questionId=${id} -->\n` +
      "<!-- DAGUANYUAN_SINGLE_IMPORT:1 -->",
    }] : provider === "408" ? [{ text:
      `题干\n<!-- DAGUANYUAN_408_QUESTION_ID:${id} -->\n` +
      `<!-- DAGUANYUAN_408_URL:https://www.408os.cn/exercise?year=2026&questionId=${id} -->`,
    }] : [];
    const note = { noteId: `card-${id}`, noteTitle: provider === "408" ? "2026年 第5题" : "题目", comments, parentNote: parent };
    parent.childNotes.push(note);
    return note;
  }
  function remember(note) {
    notebook.focusNote = note;
    core.rememberFocus(addon);
    notebook.focusNote = undefined;
  }
  return { addon, notebook, context, methods, core, opened, messages, card, remember };
}

for (const provider of ["math", "408"]) {
  test(`${provider} 导入卡片取消选中后定位按钮按分类序号定位，不读取隐藏原题网址`, () => {
    const run = runtime();
    run.card(1);
    const note = run.card(3356, provider);
    if (provider === '408') run.context.__DAGUANYUAN_CATEGORY_MAPPING_STORE_GLOBAL__.binding408ForSource = () => ({ targetURL: 'https://www.408os.cn/exercise?knowledgeId=7' });
    run.remember(note);
    run.methods.locateQuestion();
    assert.equal(run.opened.length, 1);
    const route = run.opened[0];
    assert.equal(route.questionId, undefined);
    assert.equal(route.imported, undefined);
    assert.equal(route.questionNumber, 2);
    assert.equal(route.url, provider === "408"
      ? "https://www.408os.cn/exercise?knowledgeId=7"
      : "https://www.cxyonly.fans/math/practice/331");
    if (provider === "408") {
      assert.equal(route.provider, "408");
    }
    assert.deepEqual(run.messages, []);
  });
}

test("点击时的新焦点优先于记住的卡片，并供取消选中后的再次定位使用", () => {
  const run = runtime();
  run.remember(run.card(3356, "math"));
  const next = run.card(3357, "math");
  run.notebook.focusNote = next;
  run.methods.locateQuestion();
  assert.equal(run.opened[0].questionNumber, 2);
  assert.equal(run.addon.__daguanyuanFocusNextLastFocus, next);
  run.notebook.focusNote = undefined;
  run.methods.locateQuestion();
  assert.equal(run.opened[1].questionNumber, 2);
});

test("普通卡片取消选中后仍按记住的卡片所属分类和同级序号定位", () => {
  const run = runtime();
  run.card(1);
  run.remember(run.card(2));
  run.methods.locateQuestion();
  assert.equal(run.opened.length, 1);
  assert.equal(run.opened[0].questionNumber, 2);
  assert.equal(run.opened[0].questionId, undefined);
  assert.deepEqual(run.messages, []);
});

test("定位不依赖导入模块，分类序号读取期间焦点变化仍使用点击时确定的卡片", () => {
  const run = runtime();
  const first = run.card(1);
  const second = run.card(2);
  run.notebook.focusNote = first;
  const original = run.core.currentQuestionContext;
  run.core.currentQuestionContext = (addon, note) => {
    assert.equal(note, first);
    run.notebook.focusNote = second;
    return original(addon, note);
  };
  run.methods.locateQuestion();
  assert.equal(run.opened.length, 1);
  assert.equal(run.opened[0].questionNumber, 1);
});

test('新格式导入卡含查看原题链接和注释时，定位按钮仍使用当前分类与同级位置', () => {
  const run = runtime(); run.card(1); const note = run.card(3356, 'math');
  note.comments = [{ text: '题干' }, { text: '[查看原题](marginnote4app://addon/daguanyuan-bridge?action=open&provider=math&question=3356&year=0&url=https%3A%2F%2Fwww.cxyonly.fans%2Fmath%2Fpractice%2F99%3FquestionId%3D3356)\n\n<!-- DAGUANYUAN_QUESTION_ID:3356 -->\n\n<!-- DAGUANYUAN_URL:https://www.cxyonly.fans/math/practice/99?questionId=3356 -->' }];
  run.notebook.focusNote = note;
  run.methods.locateQuestion();
  assert.equal(run.opened[0].questionNumber, 2); assert.equal(run.opened[0].questionId, undefined);
  assert.equal(run.opened[0].url, 'https://www.cxyonly.fans/math/practice/331');
});

test('导入卡的分类无法识别时提示绑定分类，不退回原题 ID 精确打开', () => {
  const run = runtime(); run.remember(run.card(3356, 'math'));
  run.context.__DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.resultForCategoryId = () => ({ status: 'missing' });
  const bindings = []; run.context.__DAGUANYUAN_WEB_PANEL_GLOBAL__.prepareCategoryBinding = (controller, message) => bindings.push(message);
  run.methods.locateQuestion();
  assert.equal(run.opened.length, 0); assert.match(bindings[0], /绑定分类/);
});

test("没有当前焦点及历史卡片时提示先进入卡片焦点，不打开题目", () => {
  const run = runtime();
  run.methods.locateQuestion();
  assert.equal(run.opened.length, 0);
  assert.deepEqual(run.messages, ["请先双击进入一张脑图卡片焦点"]);
});

test("打开学习集清空历史卡片，避免取消选中后沿用上一学习集题目", () => {
  const run = runtime();
  run.remember(run.card(3356, "math"));
  run.context.__DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__ = { show() {}, syncQuestionLocator() {} };
  run.methods.notebookWillOpen();
  run.methods.locateQuestion();
  assert.equal(run.addon.__daguanyuanFocusNextLastFocus, null);
  assert.equal(run.opened.length, 0);
  assert.deepEqual(run.messages, ["请先双击进入一张脑图卡片焦点"]);
});
