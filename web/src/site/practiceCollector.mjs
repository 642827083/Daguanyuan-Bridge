function compactText(value) {
  let result = String(value || "").replace(/\s+/g, " ").trim();
  let previous = "";
  while (previous !== result) {
    previous = result;
    result = result.replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g, "$1");
  }
  return result.replace(/\s*\(/g, "(").replace(/\(\s*/g, "(").replace(/\s*\)/g, ")");
}

function questionURL(location, questionId) {
  const href = String(location && location.href || "");
  if (!href || !questionId) return "";
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

export function collectPracticeCards(doc, location) {
  const params = new URL(location.href).searchParams;
  const pathParts = String(location.pathname || "").split("/").filter(Boolean);
  const practiceId = pathParts[pathParts.length - 1] || "";
  const categoryId = params.get("resumeCategoryId") || "";
  const questions = Array.from(doc.querySelectorAll("[data-learning-question-card]"))
    .map((card) => {
      const questionDocument = card.querySelector("[data-question-id]");
      const sourceNode = card.querySelector("[data-question-source]") || card.querySelector("[title]");
      const annotation = card.querySelector('annotation[encoding="application/x-tex"]');
      return {
        questionId: questionDocument && questionDocument.getAttribute("data-question-id"),
        source: sourceNode && sourceNode.getAttribute("data-question-source") ||
          sourceNode && sourceNode.getAttribute("title") || "",
        stemText: compactText(questionDocument && questionDocument.innerText),
        tex: annotation && annotation.textContent || "",
        url: questionURL(location, questionDocument && questionDocument.getAttribute("data-question-id")),
      };
    })
    .filter((item) => item.questionId);

  return {
    practiceId,
    categoryId,
    categoryName: "",
    url: location.href,
    questions,
  };
}

export function collectorScript() {
  return `(${collectPracticeCards.toString()})(document, window.location)`;
}
