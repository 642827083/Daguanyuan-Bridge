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
