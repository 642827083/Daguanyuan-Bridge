const SITE_ROOT = "https://cxyonly.fans";

function questionURL(pageURL, questionId) {
  const href = String(pageURL || "");
  if (!href || !questionId) return `${SITE_ROOT}/math/questions/${questionId}`;
  const hashIndex = href.indexOf("#");
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
  const base = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const queryIndex = base.indexOf("?");
  const path = queryIndex >= 0 ? base.slice(0, queryIndex) : base;
  const query = queryIndex >= 0 ? base.slice(queryIndex + 1) : "";
  const parts = query ? query.split("&").filter((part) => {
    let name = String(part || "").split("=")[0].replace(/\+/g, " ");
    try { name = decodeURIComponent(name); } catch (error) { /* 忽略无法解码的参数名 */ }
    return name !== "questionId";
  }) : [];
  parts.push(`questionId=${encodeURIComponent(String(questionId))}`);
  return `${path}?${parts.join("&")}${hash}`;
}

export function normalizePracticePayload(input) {
  const practiceId = String(input && input.practiceId || "").trim();
  const categoryId = String(input && input.categoryId || "").trim();
  if (!/^\d+$/.test(practiceId) || !/^\d+$/.test(categoryId)) {
    throw new Error("缺少练习分类信息");
  }

  const seen = new Set();
  const pageURL = String(input && input.url || "").trim();
  const questions = (Array.isArray(input.questions) ? input.questions : []).map((item) => {
    const questionId = String(item && item.questionId || "").trim();
    if (!/^\d+$/.test(questionId) || seen.has(questionId)) {
      throw new Error("题目 ID 无效或重复");
    }
    seen.add(questionId);
    return {
      questionId,
      source: String(item && item.source || "").trim(),
      stemText: String(item && item.stemText || "").trim(),
      tex: String(item && item.tex || "").trim(),
      url: questionURL(pageURL, questionId),
    };
  });

  if (!questions.length) throw new Error("当前页面没有可导入题目");

  const categoryName = String(input && input.categoryName || "").trim();
  return {
    practiceId,
    categoryId,
    categoryTitle: categoryName || `分类 ${categoryId}`,
    sourceUrl: String(input && input.url || "").trim(),
    questions,
  };
}
