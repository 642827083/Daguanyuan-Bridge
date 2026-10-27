var __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__ = (function createRoutes(initialCatalog) {
  const SITE_BASE_URL = "https://www.cxyonly.fans";
  const QUESTIONS_PER_PAGE = 20;
  let activeCatalog = { records: [], updatedAt: "" };
  let records = [];
  let recordsById = {};
  let pathCache = {};

  function replaceCatalog(catalog) {
    const input = catalog && typeof catalog === "object" ? catalog : { records: [] };
    const nextRecords = [];
    const nextRecordsById = {};
    for (const item of input.records || []) {
      const record = { id: Number(item[0]), parentId: Number(item[1]) || 0, name: String(item[2] || "").trim() };
      if (!Number.isSafeInteger(record.id) || record.id <= 0 || !record.name) continue;
      nextRecords.push(record);
      nextRecordsById[record.id] = record;
    }
    if (!nextRecords.length) throw new Error("没有可用的大观园分类数据");
    activeCatalog = input;
    records = nextRecords;
    recordsById = nextRecordsById;
    pathCache = {};
    return records.length;
  }

  function reloadFromStore() {
    const catalog = typeof __DAGUANYUAN_CATEGORY_CATALOG_STORE_GLOBAL__ !== "undefined"
      ? __DAGUANYUAN_CATEGORY_CATALOG_STORE_GLOBAL__.currentCatalog()
      : { records: [], updatedAt: "" };
    if (catalog.records.length) return replaceCatalog(catalog);
    // 首次安装允许目录为空，分类数据由用户手动下载。
    activeCatalog = catalog;
    records = [];
    recordsById = {};
    pathCache = {};
    return 0;
  }

  function unavailableResult() {
    return {
      status: "unavailable",
      message: "尚未下载数学分类数据，请前往“设置 → 题型分类管理”下载分类数据",
      candidates: [],
    };
  }

  if (initialCatalog) replaceCatalog(initialCatalog);
  else reloadFromStore();

  function normalizeSegment(value) {
    return String(value || "").trim();
  }

  function pathFor(record) {
    if (!record) return [];
    if (pathCache[record.id]) return pathCache[record.id];
    const result = [];
    const visited = {};
    let cursor = record;
    while (cursor && !visited[cursor.id]) {
      visited[cursor.id] = true;
      result.unshift(cursor);
      cursor = recordsById[cursor.parentId];
    }
    pathCache[record.id] = result;
    return result;
  }

  function matchingSuffixLength(sourcePath, candidatePath) {
    let sourceIndex = sourcePath.length - 1;
    let candidateIndex = candidatePath.length - 1;
    let matched = 0;
    while (sourceIndex >= 0 && candidateIndex >= 0) {
      if (sourcePath[sourceIndex] !== candidatePath[candidateIndex]) break;
      matched += 1;
      sourceIndex -= 1;
      candidateIndex -= 1;
    }
    return matched;
  }

  function resolve(path) {
    if (!records.length) return unavailableResult();
    const sourcePath = (path || []).map(normalizeSegment).filter(Boolean);
    if (!sourcePath.length) return { status: "missing", candidates: [] };
    let bestScore = 0;
    let candidates = [];
    for (const record of records) {
      const recordPath = pathFor(record);
      const candidatePath = recordPath.map(function (item) { return normalizeSegment(item.name); });
      const score = matchingSuffixLength(sourcePath, candidatePath);
      if (!score || score < bestScore) continue;
      if (score > bestScore) {
        bestScore = score;
        candidates = [];
      }
      candidates.push({ record, recordPath, score });
    }
    if (!candidates.length) return { status: "missing", candidates: [] };
    if (candidates.length > 1) {
      return {
        status: "ambiguous",
        candidates: candidates.map(function (candidate) { return candidate.recordPath.map(function (item) { return item.name; }); }),
        matchedSegments: bestScore,
      };
    }
    const candidate = candidates[0];
    const routeRecord = candidate.recordPath[1] || candidate.recordPath[0] || candidate.record;
    return {
      status: "resolved",
      categoryId: candidate.record.id,
      routeCategoryId: routeRecord.id,
      name: candidate.record.name,
      path: candidate.recordPath.map(function (item) { return item.name; }),
      matchedSegments: candidate.score,
    };
  }

  function resultForCategoryId(categoryId) {
    if (!records.length) return unavailableResult();
    const record = recordsById[Number(categoryId)];
    if (!record) return { status: "missing", candidates: [] };
    const recordPath = pathFor(record);
    const routeRecord = recordPath[1] || recordPath[0] || record;
    return {
      status: "resolved",
      categoryId: record.id,
      routeCategoryId: routeRecord.id,
      name: record.name,
      path: recordPath.map(function (item) { return item.name; }),
      matchedSegments: recordPath.length,
    };
  }

  function childNames(path) {
    let parentId = 0;
    for (const name of path || []) {
      const matches = records.filter(function (record) { return record.parentId === parentId && record.name === name; });
      if (matches.length !== 1) return [];
      parentId = matches[0].id;
    }
    return records.filter(function (record) { return record.parentId === parentId; }).map(function (record) { return record.name; });
  }

  // 纯函数同时交给网页执行，两个入口共用网址与范围解析。
  function importContextFromURL(urlString) {
    const value = String(urlString || '');
    const match = value.match(/^https:\/\/(?:www\.)?cxyonly\.fans(\/[^?#]*)(?:\?([^#]*))?(?:#.*)?$/i);
    if (!match) return { categoryId: 0, scope: '', examSubject: 'all' };
    const query = {};
    (match[2] || '').split('&').forEach(function (part) {
      const pair = part.split('=');
      try { query[decodeURIComponent(pair[0])] = decodeURIComponent((pair[1] || '').replace(/\+/g, ' ')); } catch (ignored) {}
    });
    const path = match[1], simple = path.match(/^\/math\/practice\/(?:categories\/)?([1-9]\d*)\/?$/);
    const concept = path.match(/^\/math\/practice\/concepts\/([1-9]\d*)\/?$/);
    const grouped = path.match(/^\/math\/practice\/([^/]+)\/(?:all|[1-9]\d*)\/([1-9]\d*)\/?$/);
    const practice = /^\/math\/practice\/?$/.test(path) || Boolean(simple || grouped || concept);
    const listId = query.listId || (grouped ? grouped[1] : '');
    const categoryId = practice ? Number(query.resumeCategoryId || simple && simple[1] || grouped && grouped[2] || query.categoryId || query.categoryIds
      || !concept && !query.conceptId && query.rootCategoryId || 0) : 0;
    const subjectMatch = /(?:^|-)math[-_]([123])$/.exec(listId);
    const subject = query.examSubject || query.exam_subject || (subjectMatch ? 'math_' + subjectMatch[1] : 'all');
    const scope = query.scope || (/^exam(?:-|$)/.test(listId) ? 'exam' : /^core(?:-|$)/.test(listId) ? 'core' : listId ? 'complete' : '');
    return { categoryId: Number.isSafeInteger(categoryId) && categoryId > 0 ? categoryId : 0,
      conceptId: practice ? Number(concept && concept[1] || query.conceptId || 0) : 0,
      scope: scope, examSubject: subject, listId: listId, listRevision: query.listRevision || '',
      query: query.q || '', mastery: query.mastery || '', favorite: query.favorite === 'true', hasNote: query.hasNote === 'true',
      sort: query.sort || '', filters: query.filters || '', externalCategories: query.externalCategories || '' };
  }

  function categoryIdFromURL(urlString) {
    const categoryId = importContextFromURL(urlString).categoryId;
    return Number.isSafeInteger(categoryId) && categoryId > 0 && recordsById[categoryId] ? categoryId : 0;
  }

  function urlFor(result) {
    if (!result || result.status !== "resolved") return "";
    const routeId = Number(result.routeCategoryId);
    const categoryId = Number(result.categoryId);
    if (!Number.isSafeInteger(routeId) || routeId <= 0 || !Number.isSafeInteger(categoryId) || categoryId <= 0) return "";
    const suffix = routeId === categoryId ? "" : `?resumeCategoryId=${categoryId}`;
    return `${SITE_BASE_URL}/math/practice/${routeId}${suffix}`;
  }

  function questionRouteFor(result, questionNumber) {
    const url = urlFor(result);
    const number = Number(questionNumber);
    if (!url || !Number.isSafeInteger(number) || number <= 0) return undefined;
    const page = Math.ceil(number / QUESTIONS_PER_PAGE);
    return {
      url,
      categoryId: Number(result.categoryId),
      page,
      indexOnPage: (number - 1) % QUESTIONS_PER_PAGE + 1,
      questionNumber: number,
    };
  }

  return {
    normalizeSegment,
    resolve,
    resultForCategoryId,
    categoryIdFromURL,
    importContextFromURL,
    urlFor,
    questionRouteFor,
    replaceCatalog,
    reloadFromStore,
    forCatalog: createRoutes,
    childNames,
    get size() { return records.length; },
    get updatedAt() { return String(activeCatalog.updatedAt || ""); },
  };
})();
