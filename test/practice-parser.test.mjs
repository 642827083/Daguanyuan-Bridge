import test from "node:test";
import assert from "node:assert/strict";
import { normalizePracticePayload } from "../web/src/domain/practiceParser.mjs";

test("规范化当前分类题目并保留 LaTeX", () => {
  const payload = normalizePracticePayload({
    practiceId: "329",
    categoryId: "708",
    categoryName: "",
    url: "https://cxyonly.fans/math/practice/329?resumeCategoryId=708",
    questions: [{
      questionId: "3579",
      source: "1990数三",
      stemText: "求极限",
      tex: "\\displaystyle\\lim_{n\\to\\infty}x_n",
    }],
  });

  assert.equal(payload.categoryTitle, "分类 708");
  assert.deepEqual(payload.questions[0], {
    questionId: "3579",
    source: "1990数三",
    stemText: "求极限",
    tex: "\\displaystyle\\lim_{n\\to\\infty}x_n",
    url: "https://cxyonly.fans/math/practice/329?resumeCategoryId=708&questionId=3579",
  });
});

test("拒绝重复或非法题目 ID", () => {
  assert.throws(() => normalizePracticePayload({
    practiceId: "329",
    categoryId: "708",
    url: "https://cxyonly.fans/math/practice/329",
    questions: [{ questionId: "3579" }, { questionId: "3579" }],
  }), /题目 ID/);
});
