var __DAGUANYUAN_408_ROUTES_GLOBAL__ = (function () {
  function yearFromURL(urlString) {
    const value = String(urlString || "").trim();
    if (!/^https:\/\/www\.408os\.cn\/exercise(?:\?|#|$)/i.test(value)) return 0;
    const match = value.match(/[?&]year=(\d{4})(?:[&#]|$)/i);
    const year = Number(match && match[1]);
    return Number.isSafeInteger(year) && year >= 2009 && year <= 2100 ? year : 0;
  }

  function normalizedURL(urlString) {
    const value = String(urlString || "").trim();
    if (!yearFromURL(value)) throw new Error("请先进入 408 网站的某一年真题练习页");
    const withoutHash = value.split("#")[0];
    return withoutHash
      .replace(/([?&])questionId=[^&]*(?:&|$)/i, "$1")
      .replace(/[?&]$/, "");
  }

  function questionURL(urlString, questionNumber) {
    const baseURL = normalizedURL(urlString);
    const year = yearFromURL(baseURL);
    const number = Number(questionNumber);
    if (!Number.isSafeInteger(number) || number < 1 || number > 47) {
      throw new Error("当前卡片序号不在 408 真题的 1—47 题范围内");
    }
    const questionId = 47 * (year - 2009) + number;
    return `${baseURL}${baseURL.indexOf("?") >= 0 ? "&" : "?"}questionId=${questionId}`;
  }

  function detailURL(urlString, questionId, sourceYear) {
    if (!/^https:\/\/www\.408os\.cn\/exercise\?/.test(String(urlString || ""))) throw new Error("408 题目地址无效");
    const id = Number(questionId);
    if (!Number.isSafeInteger(id) || id < 1) throw new Error("408 题目 ID 无效");
    const year = Number(sourceYear) || yearFromURL(urlString);
    const yearQuery = Number.isSafeInteger(year) && year >= 2009 && year <= 2100 ? `year=${year}&` : "";
    // 网站的知识点加载分支不处理 questionId，定位时必须使用独立单题入口。
    return `https://www.408os.cn/exercise?${yearQuery}questionId=${id}`;
  }

  return { yearFromURL, normalizedURL, questionURL, detailURL };
})();
