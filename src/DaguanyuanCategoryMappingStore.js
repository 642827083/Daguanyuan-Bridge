var __DAGUANYUAN_CATEGORY_MAPPING_STORE_GLOBAL__ = (function () {
  const DIRECTORY_NAME = "DaguanyuanBridge";
  const FILE_NAME = "category-mappings.json";
  const SCHEMA_VERSION = 3;
  let cachedState;

  function defaultState() {
    return { schemaVersion: SCHEMA_VERSION, categoryBindings: {}, os408Bindings: {} };
  }

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

  function plainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function normalizePath(path) {
    return (Array.isArray(path) ? path : []).map(function (item) {
      return String(item || "").trim();
    }).filter(Boolean);
  }

  function sourceKey(source) {
    const input = plainObject(source);
    const notebookId = String(input.notebookId || "").trim();
    const parentNoteId = String(input.parentNoteId || "").trim();
    return notebookId && parentNoteId ? `${notebookId}\u001f${parentNoteId}` : "";
  }

  function normalizeBinding(value) {
    const input = plainObject(value);
    const notebookId = String(input.notebookId || "").trim();
    const parentNoteId = String(input.parentNoteId || "").trim();
    const targetCategoryId = Number(input.targetCategoryId);
    if (!notebookId || !parentNoteId || !Number.isSafeInteger(targetCategoryId) || targetCategoryId <= 0) return undefined;
    return {
      notebookId,
      parentNoteId,
      parentTitle: String(input.parentTitle || "").trim(),
      sourcePath: normalizePath(input.sourcePath),
      targetCategoryId,
      updatedAt: String(input.updatedAt || ""),
    };
  }

  function normalize408Binding(value) {
    const input = plainObject(value);
    const notebookId = String(input.notebookId || "").trim();
    const parentNoteId = String(input.parentNoteId || "").trim();
    let targetURL;
    try { targetURL = __DAGUANYUAN_408_ROUTES_GLOBAL__.normalizedURL(input.targetURL); } catch (ignored) { return undefined; }
    if (!notebookId || !parentNoteId) return undefined;
    return {
      notebookId,
      parentNoteId,
      parentTitle: String(input.parentTitle || "").trim(),
      sourcePath: normalizePath(input.sourcePath),
      targetURL,
      updatedAt: String(input.updatedAt || ""),
    };
  }

  function normalizeState(value) {
    const input = plainObject(value);
    const bindings = {};
    const source = plainObject(input.categoryBindings);
    Object.keys(source).forEach(function (key) {
      const binding = normalizeBinding(source[key]);
      if (!binding) return;
      const expectedKey = sourceKey(binding);
      if (expectedKey) bindings[expectedKey] = binding;
    });
    const os408Bindings = {};
    Object.keys(plainObject(input.os408Bindings)).forEach(function (key) {
      const binding = normalize408Binding(input.os408Bindings[key]);
      if (!binding) return;
      const expectedKey = sourceKey(binding);
      if (expectedKey) os408Bindings[expectedKey] = binding;
    });
    return { schemaVersion: SCHEMA_VERSION, categoryBindings: bindings, os408Bindings };
  }

  function readState() {
    if (cachedState) return cachedState;
    try {
      const path = storagePath();
      if (!NSFileManager.defaultManager().fileExistsAtPath(path)) {
        cachedState = defaultState();
        return cachedState;
      }
      const data = NSData.dataWithContentsOfFile(path);
      if (!data) {
        cachedState = defaultState();
        return cachedState;
      }
      cachedState = normalizeState(NSJSONSerialization.JSONObjectWithDataOptions(data, 1));
      return cachedState;
    } catch (error) {
      console.log(`[Daguanyuan Bridge] 读取题型绑定失败：${error && error.message ? error.message : error}`);
      cachedState = defaultState();
      return cachedState;
    }
  }

  function writeState(state) {
    ensureDirectory();
    const normalized = normalizeState(state);
    const data = NSJSONSerialization.dataWithJSONObjectOptions(normalized, 1);
    if (!data || !data.writeToFileAtomically(storagePath(), true)) throw new Error("保存题型绑定失败");
    cachedState = normalized;
    return normalized;
  }

  function bindingForSource(source) {
    const key = sourceKey(source);
    if (!key) return undefined;
    return normalizeBinding(readState().categoryBindings[key]);
  }

  function saveBinding(source, targetCategoryId) {
    const input = plainObject(source);
    const key = sourceKey(input);
    const target = __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.resultForCategoryId(targetCategoryId);
    if (!key) throw new Error("无法识别当前学习集或题型父节点");
    if (target.status !== "resolved") throw new Error("当前大观园分类不存在");
    const state = readState();
    state.categoryBindings[key] = {
      notebookId: String(input.notebookId || "").trim(),
      parentNoteId: String(input.parentNoteId || "").trim(),
      parentTitle: String(input.parentTitle || "").trim(),
      sourcePath: normalizePath(input.sourcePath),
      targetCategoryId: target.categoryId,
      updatedAt: new Date().toISOString(),
    };
    writeState(state);
    return state.categoryBindings[key];
  }

  function binding408ForSource(source) {
    const key = sourceKey(source);
    if (!key) return undefined;
    return normalize408Binding(readState().os408Bindings[key]);
  }

  function save408Binding(source, urlString) {
    const input = plainObject(source);
    const key = sourceKey(input);
    if (!key) throw new Error("无法识别当前学习集或题型父节点");
    const targetURL = __DAGUANYUAN_408_ROUTES_GLOBAL__.normalizedURL(urlString);
    const state = readState();
    state.os408Bindings[key] = {
      notebookId: String(input.notebookId || "").trim(),
      parentNoteId: String(input.parentNoteId || "").trim(),
      parentTitle: String(input.parentTitle || "").trim(),
      sourcePath: normalizePath(input.sourcePath),
      targetURL,
      updatedAt: new Date().toISOString(),
    };
    writeState(state);
    return state.os408Bindings[key];
  }

  function allBindings() {
    const bindings = readState().categoryBindings;
    const mathBindings = Object.keys(bindings).map(function (key) {
      const binding = normalizeBinding(bindings[key]);
      if (!binding) return undefined;
      binding.key = key;
      binding.provider = "math";
      return binding;
    }).filter(Boolean);
    const os408Bindings = readState().os408Bindings;
    const siteBindings = Object.keys(os408Bindings).map(function (key) {
      const binding = normalize408Binding(os408Bindings[key]);
      if (!binding) return undefined;
      binding.key = key;
      binding.provider = "408";
      return binding;
    }).filter(Boolean);
    return mathBindings.concat(siteBindings).sort(function (left, right) {
      return String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""));
    });
  }

  function deleteBinding(bindingKey, provider) {
    const key = String(bindingKey || "");
    const state = readState();
    const bindings = provider === "408" ? state.os408Bindings : state.categoryBindings;
    if (!key || !bindings[key]) return false;
    delete bindings[key];
    writeState(state);
    return true;
  }

  function clearBindings() {
    const state = readState();
    const count = Object.keys(state.categoryBindings).length + Object.keys(state.os408Bindings).length;
    if (!count) return 0;
    state.categoryBindings = {};
    state.os408Bindings = {};
    writeState(state);
    return count;
  }

  function resetMemoryCache() {
    cachedState = undefined;
  }

  return { bindingForSource, saveBinding, binding408ForSource, save408Binding, allBindings, deleteBinding, clearBindings, resetMemoryCache };
})();
