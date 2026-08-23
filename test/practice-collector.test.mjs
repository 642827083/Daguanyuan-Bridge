import test from "node:test";
import assert from "node:assert/strict";
import { collectPracticeCards } from "../web/src/site/practiceCollector.mjs";

function fakeCard(questionId, source, stemText, tex) {
  return {
    querySelector(selector) {
      if (selector === "[data-question-id]") {
        return {
          getAttribute() { return questionId; },
          innerText: stemText,
        };
      }
      if (selector === "[data-question-source]") {
        return { getAttribute() { return source; } };
      }
      if (selector === 'annotation[encoding="application/x-tex"]') {
        return { textContent: tex };
      }
      return null;
    },
  };
}

test("从可见题目卡片采集 ID、题源和 LaTeX", () => {
  const fakeDocument = {
    querySelectorAll(selector) {
      assert.equal(selector, "[data-learning-question-card]");
      return [fakeCard("3579", "1990数三", "求极限", "\\displaystyle x")];
    },
  };
  const result = collectPracticeCards(fakeDocument, {
    href: "https://cxyonly.fans/math/practice/329?page=1&resumeCategoryId=708",
    pathname: "/math/practice/329",
  });

  assert.equal(result.practiceId, "329");
  assert.equal(result.categoryId, "708");
  assert.equal(result.questions[0].questionId, "3579");
  assert.equal(result.questions[0].tex, "\\displaystyle x");
  assert.equal(result.questions[0].url,
    "https://cxyonly.fans/math/practice/329?page=1&resumeCategoryId=708&questionId=3579");
});
