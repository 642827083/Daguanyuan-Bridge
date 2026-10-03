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

  function knowledgeSource(urlString) {
    // 此函数同时用于原生路由和注入网页，保持自包含以共用来源校验。
    function query(address, key) {
      const match = String(address).split("#")[0].match(new RegExp("[?&]" + key + "=([^&]*)"));
      if (!match) return "";
      try { return decodeURIComponent(match[1].replace(/\+/g, " ")); } catch (ignored) { return ""; }
    }
    function valid(address) { return /^https:\/\/www\.408os\.cn\/exercise\?/.test(address); }
    let address = String(urlString || "").trim();
    if (!valid(address)) return null;
    if (!query(address, "knowledgeId")) address = query(address, "daguanyuanKnowledgeSource");
    if (!valid(address) || /[?&](?:mode|collectionId)=/.test(address)) return null;
    const rawId = query(address, "knowledgeId");
    const id = Number(rawId);
    if (!/^[1-9]\d*$/.test(rawId) || !Number.isSafeInteger(id)) return null;
    const name = query(address, "knowledgeName").trim();
    // 网站通过来源页限定知识点题目范围，定位和后续分页都必须保留原值。
    const sourcePage = query(address, "sourcePage");
    const url = `https://www.408os.cn/exercise?knowledgeId=${id}` +
      (name ? `&knowledgeName=${encodeURIComponent(name)}` : "") +
      (sourcePage ? `&sourcePage=${encodeURIComponent(sourcePage)}` : "");
    return { id, name: name || `知识点 ${id}`, url };
  }

  function detailURL(urlString, questionId, sourceYear) {
    if (!/^https:\/\/www\.408os\.cn\/exercise\?/.test(String(urlString || ""))) throw new Error("408 题目地址无效");
    const id = Number(questionId);
    if (!Number.isSafeInteger(id) || id < 1) throw new Error("408 题目 ID 无效");
    const source = knowledgeSource(urlString);
    // 保留真实知识点参数，网站的上下题才能沿该分类切换；选中目标由网页定位器完成。
    // 不能使用网站的 questionId，否则仅一题的分类会被自动切题逻辑误判为年份单题。
    if (source) return `${source.url}&daguanyuanQuestionId=${id}`;
    const year = Number(sourceYear) || yearFromURL(urlString);
    if (Number.isSafeInteger(year) && year >= 2009 && year <= 2100) {
      return `https://www.408os.cn/exercise?year=${year}&questionId=${id}`;
    }
    return `https://www.408os.cn/exercise?questionId=${id}`;
  }

  return { yearFromURL, normalizedURL, questionURL, detailURL, knowledgeSource };
})();
