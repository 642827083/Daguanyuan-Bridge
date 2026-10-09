var __DAGUANYUAN_STORAGE_GLOBAL__ = (function () {
  const DIRECTORY_NAME = "DaguanyuanBridge";
  const FILE_NAME = "bridge-data.json";
  const SCHEMA_VERSION = 1;
  let cachedState;

  function defaultState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      questionMappings: {},
    };
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
    return directory;
  }

  function plainObject(value) {
    return value && typeof value === "object" ? value : {};
  }

  function normalizeState(value) {
    const input = plainObject(value);
    return {
      schemaVersion: SCHEMA_VERSION,
      questionMappings: plainObject(input.questionMappings),
    };
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
      console.log(`[Daguanyuan Bridge] 读取持久化数据失败：${error && error.message ? error.message : error}`);
      cachedState = defaultState();
      return cachedState;
    }
  }

  function writeState(state) {
    ensureDirectory();
    const normalized = normalizeState(state);
    const data = NSJSONSerialization.dataWithJSONObjectOptions(normalized, 1);
    if (!data || !data.writeToFileAtomically(storagePath(), true)) {
      throw new Error("保存 Daguanyuan Bridge 数据失败");
    }
    cachedState = normalized;
    return normalized;
  }

  function normalizePath(items) {
    return (Array.isArray(items) ? items : []).map(function (item) {
      return String(item || "").trim();
    }).filter(Boolean);
  }

  function normalizedMapping(value) {
    const input = plainObject(value);
    const provider = String(input.provider || "").trim();
    const questionId = String(input.questionId || "").trim();
    const url = String(input.url || "").trim();
    if ((provider !== "daguanyuan" && provider !== "408os") || !/^\d+$/.test(questionId) || !url) return undefined;
    return {
      provider,
      questionId,
      url,
      categoryPath: normalizePath(input.categoryPath),
      notebookId: String(input.notebookId || ""),
      updatedAt: String(input.updatedAt || new Date().toISOString()),
    };
  }

  function saveQuestionMappings(entries) {
    const input = Array.isArray(entries) ? entries : [];
    const state = readState();
    let savedCount = 0;
    input.forEach(function (entry) {
      const noteId = String(entry && entry.noteId || "").trim();
      const mapping = normalizedMapping(entry);
      if (!noteId || !mapping) return;
      state.questionMappings[noteId] = mapping;
      savedCount += 1;
    });
    if (savedCount) writeState(state);
    return savedCount;
  }

  function questionForNoteId(noteId) {
    return normalizedMapping(readState().questionMappings[String(noteId || "")]);
  }

  function noteIdForQuestion(provider, questionId, notebookId) {
    const expectedProvider = String(provider || "");
    const expectedQuestionId = String(questionId || "");
    const expectedNotebookId = String(notebookId || "");
    const mappings = readState().questionMappings;
    const noteIds = Object.keys(mappings);
    for (let index = 0; index < noteIds.length; index += 1) {
      const noteId = noteIds[index];
      const mapping = normalizedMapping(mappings[noteId]);
      if (!mapping || mapping.provider !== expectedProvider || mapping.questionId !== expectedQuestionId) continue;
      if (expectedNotebookId && mapping.notebookId && mapping.notebookId !== expectedNotebookId) continue;
      return noteId;
    }
    return "";
  }

  function resetMemoryCache() {
    cachedState = undefined;
  }

  return {
    noteIdForQuestion,
    questionForNoteId,
    resetMemoryCache,
    saveQuestionMappings,
  };
})();
