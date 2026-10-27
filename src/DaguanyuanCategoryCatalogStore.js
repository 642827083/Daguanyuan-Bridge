var __DAGUANYUAN_CATEGORY_CATALOG_STORE_GLOBAL__ = (function () {
  const DIRECTORY_NAME = "DaguanyuanBridge";
  const FILE_NAME = "category-catalog.json";
  const SOURCE_URL = "https://www.cxyonly.fans/api/categories";
  const SCHEMA_VERSION = 1;
  const MIN_REMOTE_RECORD_COUNT = 100;
  let cachedCatalog;
  let cachedSourceKind = "empty";
  let updating = false;

  function applicationValue(key) {
    const application = Application.sharedInstance();
    let value = application && application[key];
    if (typeof value === "function") value = value.call(application);
    return String(value || "");
  }

  function storageDirectory() {
    const documentPath = applicationValue("documentPath");
    if (!documentPath) throw new Error("无法读取 MarginNote 文稿目录");
    return `${documentPath}/${DIRECTORY_NAME}`;
  }

  function storagePath() {
    return `${storageDirectory()}/${FILE_NAME}`;
  }

  function ensureDirectory() {
    const directory = storageDirectory();
    const manager = NSFileManager.defaultManager();
    if (!manager.fileExistsAtPath(directory)) {
      const created = manager.createDirectoryAtPathWithIntermediateDirectoriesAttributes(directory, true, null);
      if (!created) throw new Error("无法创建 Daguanyuan Bridge 数据目录");
    }
  }

  function normalizeCatalog(value, minimumCount) {
    const input = value && typeof value === "object" ? value : {};
    const sourceRecords = Array.isArray(input.records) ? input.records : [];
    const records = [];
    const ids = {};
    sourceRecords.forEach(function (item) {
      const id = Number(item && item[0]);
      const parentId = Number(item && item[1]) || 0;
      const name = String(item && item[2] || "").trim();
      if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(parentId) || parentId < 0 || !name) {
        throw new Error("分类数据包含无效节点");
      }
      if (ids[id]) throw new Error("分类数据包含重复节点");
      ids[id] = true;
      records.push([id, parentId, name]);
    });
    if (records.length < Number(minimumCount || 1)) throw new Error("分类数量异常，已保留原数据");
    records.forEach(function (record) {
      if (record[1] > 0 && !ids[record[1]]) throw new Error("分类数据包含不存在的父节点");
    });
    return {
      schemaVersion: SCHEMA_VERSION,
      source: String(input.source || SOURCE_URL),
      updatedAt: String(input.updatedAt || ""),
      records,
    };
  }

  function currentCatalog() {
    if (cachedCatalog) return cachedCatalog;
    try {
      const path = storagePath();
      if (NSFileManager.defaultManager().fileExistsAtPath(path)) {
        const data = NSData.dataWithContentsOfFile(path);
        if (data) {
          cachedCatalog = normalizeCatalog(NSJSONSerialization.JSONObjectWithDataOptions(data, 1), MIN_REMOTE_RECORD_COUNT);
          cachedSourceKind = "local";
          return cachedCatalog;
        }
      }
    } catch (error) {
      console.log(`[Daguanyuan Bridge] 读取本地分类数据失败：${error && error.message ? error.message : error}`);
    }
    cachedCatalog = { schemaVersion: SCHEMA_VERSION, source: SOURCE_URL, updatedAt: "", records: [] };
    cachedSourceKind = "empty";
    return cachedCatalog;
  }

  function metadata() {
    const catalog = currentCatalog();
    return {
      sourceKind: cachedSourceKind,
      updatedAt: catalog.updatedAt,
      size: catalog.records.length,
      source: catalog.source,
    };
  }

  function flattenTree(nodes, records) {
    if (!Array.isArray(nodes)) throw new Error("分类接口没有返回分类树");
    nodes.forEach(function (node) {
      const id = Number(node && node.id);
      const parentId = Number(node && node.parent_id) || 0;
      const name = String(node && node.name || "").trim();
      if (!Number.isSafeInteger(id) || id <= 0 || !name) throw new Error("分类接口返回了无效节点");
      records.push([id, parentId, name]);
      flattenTree(Array.isArray(node.children) ? node.children : [], records);
    });
  }

  function catalogFromTree(tree, updatedAt) {
    const records = [];
    flattenTree(tree, records);
    return normalizeCatalog({
      source: SOURCE_URL,
      updatedAt: String(updatedAt || new Date().toISOString().slice(0, 10)),
      records,
    }, MIN_REMOTE_RECORD_COUNT);
  }

  function writeCatalog(catalog) {
    ensureDirectory();
    const normalized = normalizeCatalog(catalog, MIN_REMOTE_RECORD_COUNT);
    const data = NSJSONSerialization.dataWithJSONObjectOptions(normalized, 1);
    if (!data || !data.writeToFileAtomically(storagePath(), true)) throw new Error("保存分类数据失败");
    cachedCatalog = normalized;
    cachedSourceKind = "local";
    return normalized;
  }

  function compareCatalog(previousCatalog, nextCatalog) {
    const previous = {};
    const next = {};
    previousCatalog.records.forEach(function (record) { previous[record[0]] = record; });
    nextCatalog.records.forEach(function (record) { next[record[0]] = record; });
    let added = 0;
    let changed = 0;
    let removed = 0;
    Object.keys(next).forEach(function (id) {
      if (!previous[id]) added += 1;
      else if (previous[id][1] !== next[id][1] || previous[id][2] !== next[id][2]) changed += 1;
    });
    Object.keys(previous).forEach(function (id) {
      if (!next[id]) removed += 1;
    });
    return { added, changed, removed };
  }

  function replaceWithTree(tree, updatedAt) {
    const previous = currentCatalog();
    const catalog = catalogFromTree(tree, updatedAt);
    const changes = compareCatalog(previous, catalog);
    writeCatalog(catalog);
    return { catalog, changes };
  }

  function replaceWithRecords(records) {
    const previous = currentCatalog();
    const catalog = normalizeCatalog({ source: SOURCE_URL, records: records, updatedAt: new Date().toISOString().slice(0, 10) }, MIN_REMOTE_RECORD_COUNT);
    const changes = compareCatalog(previous, catalog);
    writeCatalog(catalog);
    return { catalog, changes };
  }

  function isNil(value) {
    return value === null || typeof value === "undefined" || (typeof NSNull !== "undefined" && value instanceof NSNull);
  }

  function errorMessage(error) {
    if (isNil(error)) return "分类接口请求失败";
    const description = error.localizedDescription;
    return String(typeof description === "function" ? description.call(error) : description || error.message || error);
  }

  function responseStatus(response) {
    if (isNil(response)) return 0;
    const value = response.statusCode;
    return Number(typeof value === "function" ? value.call(response) : value) || 0;
  }

  function dataLength(data) {
    if (isNil(data)) return 0;
    const value = data.length;
    return Number(typeof value === "function" ? value.call(data) : value) || 0;
  }

  function fetchLatest(completion, controller) {
    const done = typeof completion === "function" ? completion : function () {};
    if (updating) {
      done(new Error("分类数据正在更新，请稍候"));
      return;
    }
    updating = true;
    if (controller) {
      // 在已登录的数学网页内读取，登录凭据留在网页，校验通过后才替换本地目录。
      Promise.resolve().then(function () {
        if (!controller.webView || typeof __DAGUANYUAN_MATH_API_GLOBAL__ === 'undefined') throw new Error('请先打开插件“数学”页并登录大观园后重试');
        return __DAGUANYUAN_MATH_API_GLOBAL__.categoryRecords('complete', 'all', controller);
      }).then(replaceWithRecords).then(function (result) {
        updating = false; done(null, result);
      }, function (error) {
        updating = false;
        if (typeof __DAGUANYUAN_DIAGNOSTICS_GLOBAL__ !== 'undefined') __DAGUANYUAN_DIAGNOSTICS_GLOBAL__.error('category.catalog.update', error, { stage: '更新数学分类' });
        done(error);
      });
      return;
    }
    try {
      const request = NSMutableURLRequest.requestWithURL(NSURL.URLWithString(SOURCE_URL));
      request.setHTTPMethod("GET");
      request.setTimeoutInterval(15);
      request.setAllHTTPHeaderFields({ Accept: "application/json" });
      NSURLConnection.sendAsynchronousRequestQueueCompletionHandler(
        request,
        NSOperationQueue.mainQueue(),
        function (response, data, error) {
          updating = false;
          try {
            if (!isNil(error)) throw new Error(errorMessage(error));
            const status = responseStatus(response);
            if (status && (status < 200 || status >= 300)) throw new Error(`分类接口请求失败：${status}`);
            if (!dataLength(data)) throw new Error("分类接口没有返回数据");
            const tree = NSJSONSerialization.JSONObjectWithDataOptions(data, 1);
            done(null, replaceWithTree(tree));
          } catch (requestError) {
            done(requestError);
          }
        }
      );
    } catch (error) {
      updating = false;
      done(error);
    }
  }

  function resetMemoryCache() {
    cachedCatalog = undefined;
    cachedSourceKind = "empty";
  }

  return {
    currentCatalog,
    metadata,
    catalogFromTree,
    replaceWithTree,
    fetchLatest,
    resetMemoryCache,
    storagePath,
  };
})();
