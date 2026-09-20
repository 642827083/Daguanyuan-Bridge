var __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__ = (function () {
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
    if (typeof __DAGUANYUAN_CATEGORY_CATALOG_STORE_GLOBAL__ !== "undefined") {
      return replaceCatalog(__DAGUANYUAN_CATEGORY_CATALOG_STORE_GLOBAL__.currentCatalog());
    }
    return replaceCatalog(typeof __DAGUANYUAN_CATEGORY_CATALOG_DATA__ === "undefined"
      ? { records: [] }
      : __DAGUANYUAN_CATEGORY_CATALOG_DATA__);
  }

  reloadFromStore();

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


  function pathKey(path) {
    return (path || []).map(normalizeSegment).filter(Boolean).join("\u001f");
  }

  function resultForCategoryId(categoryId) {
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

  function allCategories() {
    return records.map(function (record) {
      const path = pathFor(record).map(function (item) { return item.name; });
      return {
        id: record.id,
        name: record.name,
        path,
        searchText: path.join(" / ").toLowerCase(),
      };
    });
  }

  function categoryIdFromURL(urlString) {
    const value = String(urlString || "");
    const resumed = value.match(/[?&]resumeCategoryId=(\d+)/i);
    const routed = value.match(/\/math\/practice\/(\d+)/i);
    const categoryId = Number(resumed && resumed[1] || routed && routed[1] || 0);
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
    pathKey,
    resolve,
    resultForCategoryId,
    allCategories,
    categoryIdFromURL,
    urlFor,
    questionRouteFor,
    replaceCatalog,
    reloadFromStore,
    get size() { return records.length; },
    get updatedAt() { return String(activeCatalog.updatedAt || ""); },
  };
})();
