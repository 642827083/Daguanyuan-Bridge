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
