import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../src/DaguanyuanSelection.js", import.meta.url), "utf8");

function runtime() {
  const context = { console, Application: {}, Number, String, Array, Object, RegExp };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.__DAGUANYUAN_SELECTION_GLOBAL__;
}

test("从题卡 Markdown 提取大观园原题链接", () => {
  const selection = runtime();
  assert.equal(
    selection.questionURLFromText("<!-- DAGUANYUAN_URL:https://cxyonly.fans/math/practice/329?page=1&questionId=3592&resumeCategoryId=708 -->"),
    "https://cxyonly.fans/math/practice/329?page=1&questionId=3592&resumeCategoryId=708",
  );
  assert.equal(
    selection.questionURLFromText("## 来源\n\n[查看原题](https://cxyonly.fans/math/questions/3592)"),
    "https://cxyonly.fans/math/questions/3592",
  );
});

test("忽略非题库链接并拒绝没有原题链接的题卡", () => {
  const selection = runtime();
  assert.equal(selection.questionURLFromText("[外部链接](https://example.com/question/1)"), "");
  assert.equal(selection.questionURLFromText("只有题干，没有来源"), "");
});

test("把大观园练习链接转换为对应的 AI 题目助手链接", () => {
  const selection = runtime();
  assert.equal(
    selection.questionAIURLFromURL("https://cxyonly.fans/math/practice/329?page=1&questionId=3592&resumeCategoryId=708"),
    "https://cxyonly.fans/math/questions/3592?returnTo=%2Fmath%2Fpractice%2F329%3Fpage%3D1%26questionId%3D3592%26resumeCategoryId%3D708",
  );
});

test("AI 题目链接保持不变并拒绝无效链接", () => {
  const selection = runtime();
  assert.equal(selection.questionAIURLFromURL("https://cxyonly.fans/math/questions/3592"), "https://cxyonly.fans/math/questions/3592");
  assert.equal(selection.questionAIURLFromURL("https://example.com/math/practice/329?questionId=3592"), "");
  assert.equal(selection.questionAIURLFromURL("https://cxyonly.fans/math/practice/329?page=1"), "");
});

test("从练习地址和单题地址读取题目编号", () => {
  const selection = runtime();
  assert.equal(
    selection.questionIdFromURL("https://cxyonly.fans/math/practice/329?page=1&questionId=3592&resumeCategoryId=708"),
    "3592",
  );
  assert.equal(selection.questionIdFromURL("https://cxyonly.fans/math/questions/3592?returnTo=%2Fmath"), "3592");
  assert.equal(selection.questionIdFromURL("https://cxyonly.fans/math/practice/329?page=1"), "");
  assert.equal(selection.questionIdFromURL("https://example.com/math/questions/3592"), "");
});

test("题目已经渲染时立即滚动到屏幕中央", () => {
  const selection = runtime();
  const scrollCalls = [];
  const target = {
    scrollIntoView(options) {
      scrollCalls.push(options);
    },
  };
  const document = {
    documentElement: {},
    querySelector(selector) {
      assert.equal(selector, '[data-question-id="3592"]');
      return target;
    },
  };
  const window = {};
  const result = vm.runInNewContext(selection.questionLocatorScript("3592"), {
    document,
    location: { hostname: "cxyonly.fans", pathname: "/math/practice/329" },
    window,
    MutationObserver: function () {},
  });

  assert.equal(result, true);
  assert.equal(scrollCalls.length, 1);
  assert.equal(scrollCalls[0].block, "center");
  assert.equal(scrollCalls[0].behavior, "auto");
});

test("题目异步渲染时等待节点出现后自动滚动", () => {
  const selection = runtime();
  const scrollCalls = [];
  let target;
  let observerCallback;
  const observer = {
    disconnect() {},
    observe() {},
  };
  function MutationObserver(callback) {
    observerCallback = callback;
    return observer;
  }
  const document = {
    documentElement: {},
    querySelector() {
      return target;
    },
  };
  const window = {};
  const result = vm.runInNewContext(selection.questionLocatorScript("3592"), {
    document,
    location: { hostname: "cxyonly.fans", pathname: "/math/practice/329" },
    window,
    MutationObserver,
  });

  assert.equal(result, false);
  assert.equal(typeof observerCallback, "function");
  target = { scrollIntoView(options) { scrollCalls.push(options); } };
  observerCallback();
  assert.equal(scrollCalls.length, 1);
  assert.equal(scrollCalls[0].block, "center");
});

test("按父节点顺序取得网页题目并生成可复用原题地址", () => {
  const selection = runtime();
  const scrollCalls = [];
  function card(questionId) {
    return {
      getAttribute() { return ""; },
      querySelector(selector) {
        return selector === "[data-question-id]" ? { getAttribute() { return questionId; } } : null;
      },
      scrollIntoView(options) { scrollCalls.push(options); },
    };
  }
  const result = JSON.parse(vm.runInNewContext(selection.orderedQuestionLocatorScript(1), {
    document: {
      querySelectorAll(selector) {
        if (selector === "[data-learning-question-card]") return [card("101"), card("102")];
        if (selector === "button") return [];
        return [];
      },
    },
    location: {
      hostname: "cxyonly.fans",
      pathname: "/math/practice/329",
      href: "https://cxyonly.fans/math/practice/329?resumeCategoryId=708&questionId=old",
    },
    window: {},
    JSON,
    Array,
    String,
    RegExp,
    Number,
    encodeURIComponent,
    decodeURIComponent,
  }));

  assert.equal(result.status, "found");
  assert.equal(result.questionId, "102");
  assert.equal(result.url, "https://cxyonly.fans/math/practice/329?resumeCategoryId=708&questionId=102");
  assert.equal(scrollCalls.length, 1);
});

test("目标顺序尚未加载时点击加载更多且不提前绑定", () => {
  const selection = runtime();
  let clickCount = 0;
  const loadMore = {
    innerText: "加载更多题目",
    disabled: false,
    getAttribute() { return "false"; },
    click() { clickCount += 1; },
  };
  const result = JSON.parse(vm.runInNewContext(selection.orderedQuestionLocatorScript(20), {
    document: {
      querySelectorAll(selector) {
        if (selector === "[data-learning-question-card]") return [];
        if (selector === "button") return [loadMore];
        return [];
      },
    },
    location: { hostname: "cxyonly.fans", pathname: "/math/practice/329", href: "https://cxyonly.fans/math/practice/329" },
    window: {},
    JSON,
    Array,
    String,
    RegExp,
    Number,
    encodeURIComponent,
    decodeURIComponent,
  }));

  assert.equal(result.status, "waiting");
  assert.equal(clickCount, 1);
});

test("虚拟列表初始只渲染两题时逐题滚动并定位第七题", () => {
  const selection = runtime();
  const questionIds = ["101", "102", "103", "104", "105", "106", "107"];
  let virtualStart = 0;
  let scrollCount = 0;

  function card(questionId, visibleIndex) {
    return {
      getAttribute() { return ""; },
      querySelector(selector) {
        return selector === "[data-question-id]" ? { getAttribute() { return questionId; } } : null;
      },
      scrollIntoView(options) {
        if (options.block === "start" && visibleIndex === 1 && virtualStart < questionIds.length - 2) {
          virtualStart += 1;
          scrollCount += 1;
        }
      },
    };
  }

  const context = {
    document: {
      body: { innerText: "0/7" },
      querySelectorAll(selector) {
        if (selector === "[data-learning-question-card]") {
          return questionIds.slice(virtualStart, virtualStart + 2).map(card);
        }
        if (selector === "button") return [];
        return [];
      },
    },
    location: {
      hostname: "cxyonly.fans",
      pathname: "/math/practice/329",
      href: "https://cxyonly.fans/math/practice/329?resumeCategoryId=708",
    },
    window: { scrollY: 0, scrollTo() {} },
    JSON,
    Array,
    String,
    RegExp,
    Number,
    encodeURIComponent,
    decodeURIComponent,
  };
  vm.createContext(context);

  let result;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    result = JSON.parse(vm.runInContext(selection.orderedQuestionLocatorScript(6), context));
    if (result.status === "found") break;
    assert.equal(result.status, "waiting");
  }

  assert.equal(result.status, "found");
  assert.equal(result.questionId, "107");
  assert.equal(result.questionCount, 7);
  assert.equal(result.expectedQuestionCount, 7);
  assert.equal(result.url, "https://cxyonly.fans/math/practice/329?resumeCategoryId=708&questionId=107");
  assert.equal(scrollCount, 5);
});
