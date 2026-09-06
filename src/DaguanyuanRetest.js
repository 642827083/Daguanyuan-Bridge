var __DAGUANYUAN_RETEST_GLOBAL__ = (function () {
  const ROOT_TITLE = "Daguanyuan Bridge";
  const BRIDGE_SCHEME = "daguanyuanbridge";

  function nativeMember(object, key) {
    if (!object) return undefined;
    let value = object[key];
    if (value === undefined && typeof object.objectForKey === "function") value = object.objectForKey(key);
    if (value === undefined && typeof object.valueForKey === "function") value = object.valueForKey(key);
    if (typeof value === "function") {
      try {
        value = value.call(object);
      } catch (ignored) {
        return undefined;
      }
    }
    return value;
  }

  function nativeItems(list) {
    if (!list) return [];
    const rawCount = typeof list.count === "function" ? list.count() : list.count !== undefined ? list.count : list.length;
    const count = Number(rawCount);
    if (!Number.isFinite(count) || count < 1) return [];
    const items = [];
    for (let index = 0; index < count; index += 1) {
      items.push(typeof list.objectAtIndex === "function" ? list.objectAtIndex(index) : list[index]);
    }
    return items;
  }

  function noteText(note) {
    if (!note) return "";
    const parts = [];
    const title = nativeMember(note, "noteTitle");
    const excerpt = nativeMember(note, "excerptText");
    const notes = nativeMember(note, "notesText");
    const allText = nativeMember(note, "allNoteText");
    if (title) parts.push(String(title));
    if (excerpt) parts.push(String(excerpt));
    if (notes) parts.push(String(notes));
    for (const comment of nativeItems(nativeMember(note, "comments"))) {
      const text = nativeMember(comment, "text");
      if (text) parts.push(String(text));
    }
    if (allText) parts.push(String(allText));
    return parts.join("\n");
  }

  function questionURLFromText(value) {
    const text = String(value || "");
    const hidden = text.match(/<!--\s*DAGUANYUAN_URL:([^\s]+)\s*-->/);
    if (hidden) return hidden[1];
    const visible = text.match(/https:\/\/cxyonly\.fans\/math\/(?:questions\/\d+|practice\/\d+\?[^\s)<>]+)/);
    return visible ? visible[0] : "";
  }

  function questionIdFromURL(value) {
    const url = String(value || "");
    const detail = url.match(/^https:\/\/cxyonly\.fans\/math\/questions\/(\d+)(?:[?#][^\s]*)?$/);
    if (detail) return detail[1];
    if (!/^https:\/\/cxyonly\.fans\/math\/practice\/\d+\?[^#\s]+$/.test(url)) return "";
    const practice = url.match(/[?&]questionId=(\d+)(?:&|$)/);
    return practice ? practice[1] : "";
  }

  function questionIdFromBridgeURL(value) {
    const match = String(value || "").match(/^daguanyuanbridge:\/\/focus-question\/?\?questionId=(\d+)$/);
    return match ? match[1] : "";
  }

  function retestEnhancer() {
    if (String(location.hostname || "") !== "cxyonly.fans") return;

    function enhance() {
      if (!/^\/math\/retest(?:\/|$)/.test(String(location.pathname || ""))) return;
      var anchors = document.querySelectorAll('a[href*="/math/questions/"]');
      for (var index = 0; index < anchors.length; index += 1) {
        var anchor = anchors[index];
        var href = String(anchor.getAttribute("href") || "");
        var match = href.match(/\/math\/questions\/(\d+)/);
        if (!match || !anchor.parentNode) continue;
        var questionId = match[1];
        var selector = '[data-daguanyuan-focus-question="' + questionId + '"]';
        if (anchor.parentNode.querySelector(selector)) continue;
        var button = document.createElement("button");
        button.type = "button";
        button.className = anchor.className || "";
        button.textContent = "定位脑图";
        button.setAttribute("data-daguanyuan-focus-question", questionId);
        button.setAttribute("aria-label", "定位第 " + questionId + " 题脑图卡片");
        button.style.border = "0";
        button.style.background = "transparent";
        button.style.color = "#2563eb";
        button.style.cursor = "pointer";
        button.style.font = "inherit";
        button.style.marginRight = "16px";
        button.style.padding = "0";
        button.addEventListener("click", (function (id) {
          return function (event) {
            event.preventDefault();
            window.location.href = "daguanyuanbridge://focus-question?questionId=" + id;
          };
        })(questionId));
        anchor.parentNode.insertBefore(button, anchor);
      }
    }

    if (window.__DAGUANYUAN_RETEST_ENHANCER__) {
      window.__DAGUANYUAN_RETEST_ENHANCER__.enhance();
      return;
    }
    var observer = new MutationObserver(function () {
      enhance();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.__DAGUANYUAN_RETEST_ENHANCER__ = { enhance: enhance, observer: observer };
    enhance();
  }

  function enhancementScript() {
    return `(${retestEnhancer.toString()})();`;
  }

  function findRoot(notebook) {
    const candidates = nativeItems(nativeMember(notebook, "notes")).concat(nativeItems(nativeMember(notebook, "childNotes")));
    return candidates.find(function (note) {
      return String(nativeMember(note, "noteTitle") || "") === ROOT_TITLE;
    });
  }

  function taggedQuestionId(note, provider) {
    const comments = nativeItems(nativeMember(note, "comments"));
    for (let index = 0; index < comments.length; index += 1) {
      const tag = String(nativeMember(comments[index], "tag") || "");
      const match = tag.match(/^daguanyuan-question:v1\|(daguanyuan|408os)\|(\d+)\|/);
      if (match && (!provider || match[1] === provider)) return match[2];
    }
    return "";
  }

  function findNoteById(notebook, noteId) {
    const expected = String(noteId || "");
    const roots = nativeItems(nativeMember(notebook, "notes")).concat(nativeItems(nativeMember(notebook, "childNotes")));
    const stack = roots.slice();
    const visited = [];
    while (stack.length) {
      const note = stack.pop();
      if (!note || visited.indexOf(note) >= 0) continue;
      visited.push(note);
      if (String(nativeMember(note, "noteId") || "") === expected) return note;
      const children = nativeItems(nativeMember(note, "childNotes"));
      for (let index = children.length - 1; index >= 0; index -= 1) stack.push(children[index]);
    }
    return undefined;
  }

  function notebookIdentifier(notebook) {
    return notebookIdentifiers(notebook)[0] || "";
  }

  function notebookIdentifiers(notebook) {
    const values = [
      nativeMember(notebook, "topicId"),
      nativeMember(notebook, "notebookId"),
      nativeMember(notebook, "id"),
    ].map(function (value) { return String(value || ""); }).filter(Boolean);
    return values.filter(function (value, index) { return values.indexOf(value) === index; });
  }

  function knownNotebooks(database) {
    if (!database) return [];
    const values = ["notebooks", "allNotebooks", "notebookList"];
    for (let index = 0; index < values.length; index += 1) {
      const list = nativeItems(nativeMember(database, values[index]));
      if (list.length) return list;
    }
    return [];
  }

  function findQuestionNote(notebook, questionId) {
    const root = findRoot(notebook);
    if (!root) return undefined;
    const stack = [root];
    const visited = [];
    while (stack.length) {
      const note = stack.pop();
      if (!note || visited.indexOf(note) >= 0) continue;
      visited.push(note);
      const allText = noteText(note);
      const markerMatches = allText.indexOf(`DAGUANYUAN_QUESTION_ID:${questionId}`) >= 0;
      const url = questionURLFromText(allText);
      const children = nativeItems(nativeMember(note, "childNotes"));
      const tagMatches = taggedQuestionId(note, "daguanyuan") === questionId;
      if (!children.length && (tagMatches || (markerMatches && questionIdFromURL(url) === questionId))) return note;
      for (let index = children.length - 1; index >= 0; index -= 1) stack.push(children[index]);
    }
    return undefined;
  }

  function resolveQuestionCard(addon, value) {
    const questionId = String(value || "");
    if (!/^\d+$/.test(questionId)) throw new Error("错题复测题目编号无效");
    const application = Application.sharedInstance();
    const studyController = application.studyController(addon && addon.window);
    const notebookController = nativeMember(studyController, "notebookController");
    const notebookId = nativeMember(notebookController, "notebookId");
    const database = Database.sharedInstance();
    let notebook = notebookId && database && typeof database.getNotebookById === "function"
      ? database.getNotebookById(notebookId) : undefined;
    let note = notebook ? findQuestionNote(notebook, questionId) : undefined;
    if (!note && notebook && typeof __DAGUANYUAN_STORAGE_GLOBAL__ !== "undefined") {
      const cachedNoteId = __DAGUANYUAN_STORAGE_GLOBAL__.noteIdForQuestion("daguanyuan", questionId, String(notebookId || ""));
      if (cachedNoteId) note = findNoteById(notebook, cachedNoteId);
    }
    let cachedAnyNoteId = "";
    if (!note && typeof __DAGUANYUAN_STORAGE_GLOBAL__ !== "undefined") {
      cachedAnyNoteId = __DAGUANYUAN_STORAGE_GLOBAL__.noteIdForQuestion("daguanyuan", questionId, "");
      if (cachedAnyNoteId && notebook) note = findNoteById(notebook, cachedAnyNoteId);
    }
    if (!notebook || !note) throw new Error(`当前笔记本中未找到题目 ${questionId}，请先导入该题目所在学习集`);
    const noteId = nativeMember(note, "noteId");
    if (!noteId) throw new Error(`题目 ${questionId} 的脑图卡片缺少笔记 ID`);
    if (!studyController || !nativeMember(studyController, "notebookController")) {
      throw new Error("当前 MarginNote 版本不支持脑图卡片定位");
    }
    const notebookIds = notebookIdentifiers(notebook);
    return {
      questionId,
      noteId: String(noteId),
      note,
      notebookId: notebookIds[0] || String(notebookId || ""),
      notebookIds,
    };
  }

  function currentNotebookIdentifiers(addon) {
    try {
      const studyController = Application.sharedInstance().studyController(addon && addon.window);
      const notebookController = nativeMember(studyController, "notebookController");
      return notebookIdentifiers(notebookController).concat(notebookIdentifiers(studyController)).filter(function (value, index, values) {
        return values.indexOf(value) === index;
      });
    } catch (ignored) { return []; }
  }

  function isCurrentTargetNotebook(addon, notebookId, notebookIds) {
    const targets = (Array.isArray(notebookIds) ? notebookIds : []).concat(String(notebookId || "")).filter(Boolean);
    if (!targets.length) return true;
    const current = currentNotebookIdentifiers(addon);
    return current.some(function (value) { return targets.indexOf(value) >= 0; });
  }

  function focusRetestQuestionCard(addon, value) {
    const noteId = String(value || "");
    if (!noteId) throw new Error("脑图卡片信息不完整");
    const studyController = Application.sharedInstance().studyController(addon && addon.window);
    if (!studyController || typeof studyController.focusNoteInMindMapById !== "function") {
      throw new Error("当前 MarginNote 版本不支持脑图卡片定位");
    }
    // 错题复测只使用宿主提供的定位接口，避免直接操作 MindMapView 导致闪退。
    studyController.focusNoteInMindMapById(noteId);
    return noteId;
  }

  function noteIdentifier(note) {
    return String(nativeMember(note, "noteId") || nativeMember(note, "noteid") || nativeMember(note, "id") || "");
  }

  function isRetestQuestionCardFocused(addon, value) {
    const noteId = String(value || "");
    if (!noteId) return false;
    try {
      const studyController = Application.sharedInstance().studyController(addon && addon.window);
      const notebookController = nativeMember(studyController, "notebookController");
      const focusId = noteIdentifier(nativeMember(notebookController, "focusNote"));
      const visibleFocusId = noteIdentifier(nativeMember(notebookController, "visibleFocusNote"));
      return focusId === noteId || visibleFocusId === noteId;
    } catch (error) {
      console.log(`[Daguanyuan Bridge] 读取错题脑图定位状态失败：${error && error.message || error}`);
      return false;
    }
  }

  function clearPendingNavigation(addon, runId) {
    const pending = addon && addon.__daguanyuanPendingNavigation;
    if (pending && pending.runId === runId) addon.__daguanyuanPendingNavigation = null;
  }

  function scheduleNavigationRetry(addon, noteId, notebookId, notebookIds, runId, attempt) {
    const pending = addon && addon.__daguanyuanPendingNavigation;
    if (!pending || pending.runId !== runId) return;
    if (attempt >= 60) {
      console.log(`[Daguanyuan Bridge] 错题脑图定位超时：${noteId}`);
      clearPendingNavigation(addon, runId);
      return;
    }
    if (typeof NSTimer === "undefined" || !NSTimer.scheduledTimerWithTimeInterval) return;
    try {
      pending.timerScheduled = true;
      NSTimer.scheduledTimerWithTimeInterval(0.25, false, function () {
        scheduleNavigation(addon, noteId, notebookId, notebookIds, runId, attempt);
      });
    } catch (error) {
      console.log(`[Daguanyuan Bridge] 错题脑图定位重试失败：${error && error.message || error}`);
    }
  }

  function verifyNavigationFocus(addon, noteId, notebookId, notebookIds, runId, attempt) {
    const pending = addon && addon.__daguanyuanPendingNavigation;
    if (!pending || pending.runId !== runId) return;
    if (typeof NSTimer === "undefined" || !NSTimer.scheduledTimerWithTimeInterval) return;
    try {
      pending.timerScheduled = true;
      NSTimer.scheduledTimerWithTimeInterval(0.08, false, function () {
        const active = addon && addon.__daguanyuanPendingNavigation;
        if (!active || active.runId !== runId) return;
        active.timerScheduled = false;
        if (isRetestQuestionCardFocused(addon, noteId)) {
          clearPendingNavigation(addon, runId);
          return;
        }
        scheduleNavigationRetry(addon, noteId, notebookId, notebookIds, runId, attempt + 1);
      });
    } catch (error) {
      console.log(`[Daguanyuan Bridge] 错题脑图定位验证失败：${error && error.message || error}`);
      scheduleNavigationRetry(addon, noteId, notebookId, notebookIds, runId, attempt + 1);
    }
  }

  function scheduleNavigation(addon, noteId, notebookId, notebookIds, runId, attempt) {
    const pending = addon && addon.__daguanyuanPendingNavigation;
    if (!pending || pending.runId !== runId) return;
    pending.timerScheduled = false;
    pending.attempt = attempt;
    if (isCurrentTargetNotebook(addon, notebookId, notebookIds)) {
      try {
        focusRetestQuestionCard(addon, noteId);
        verifyNavigationFocus(addon, noteId, notebookId, notebookIds, runId, attempt);
        return;
      } catch (error) {
        console.log(`[Daguanyuan Bridge] 错题脑图定位尝试失败：${error && error.message || error}`);
      }
    }
    scheduleNavigationRetry(addon, noteId, notebookId, notebookIds, runId, attempt + 1);
  }

  function openNotebookForNote(noteId) {
    const target = `marginnote3app://note/${encodeURIComponent(String(noteId || ""))}`;
    try {
      if (typeof NSURL === "undefined" || !NSURL.URLWithString) {
        console.log("[Daguanyuan Bridge] 当前 MarginNote 版本缺少 NSURL，无法打开目标学习集");
        return false;
      }
      const url = NSURL.URLWithString(encodeURI(target));
      if (!url) {
        console.log("[Daguanyuan Bridge] 无法创建目标学习集地址");
        return false;
      }
      const application = Application.sharedInstance();
      if (application && typeof application.openURL === "function") {
        application.openURL(url);
        return true;
      }
      console.log("[Daguanyuan Bridge] 当前 MarginNote 版本不支持打开目标学习集");
    } catch (error) {
      console.log(`[Daguanyuan Bridge] 打开目标学习集失败：${error && error.message || error}`);
    }
    return false;
  }

  function startQuestionNavigation(addon, result) {
    if (!addon || !result || !result.noteId) throw new Error("脑图卡片信息不完整");
    const runId = `${Date.now()}-${Math.random()}`;
    const notebookIds = Array.isArray(result.notebookIds) ? result.notebookIds.map(String).filter(Boolean) : [];
    addon.__daguanyuanNavigationRunId = runId;
    addon.__daguanyuanPendingNavigation = {
      runId,
      noteId: String(result.noteId),
      notebookId: String(result.notebookId || ""),
      notebookIds,
      attempt: 0,
      timerScheduled: false,
    };
    if (!isCurrentTargetNotebook(addon, result.notebookId, notebookIds)) openNotebookForNote(result.noteId);
    scheduleNavigation(addon, String(result.noteId), String(result.notebookId || ""), notebookIds, runId, 0);
    return runId;
  }

  function resumePendingNavigation(addon, openedNotebookId) {
    const pending = addon && addon.__daguanyuanPendingNavigation;
    if (!pending) return false;
    const opened = String(openedNotebookId || "");
    if (!opened || opened !== pending.notebookId) return false;
    if (typeof NSTimer === "undefined" || !NSTimer.scheduledTimerWithTimeInterval) return false;
    const runId = `${Date.now()}-${Math.random()}`;
    pending.runId = runId;
    pending.timerScheduled = true;
    try {
      // 目标学习集打开后重新建立定位请求，废弃切换前遗留的计时器。
      NSTimer.scheduledTimerWithTimeInterval(0.2, false, function () {
        scheduleNavigation(addon, pending.noteId, pending.notebookId, pending.notebookIds, runId, pending.attempt || 0);
      });
    } catch (error) {
      console.log(`[Daguanyuan Bridge] 切换学习集后定位失败：${error && error.message || error}`);
      return false;
    }
    return true;
  }

  function focusQuestionCard(addon, note, value) {
    const noteId = String(value || "");
    if (!note || !noteId) throw new Error("脑图卡片信息不完整");
    const studyController = Application.sharedInstance().studyController(addon && addon.window);
    const notebookController = nativeMember(studyController, "notebookController");
    if (!notebookController || typeof notebookController.changeFocusToNote !== "function") {
      throw new Error("当前 MarginNote 版本不支持切换脑图焦点");
    }
    if (!studyController || typeof studyController.focusNoteInMindMapById !== "function") {
      throw new Error("当前 MarginNote 版本不支持脑图卡片定位");
    }
    notebookController.changeFocusToNote(note);
    studyController.focusNoteInMindMapById(noteId);
    return noteId;
  }

  function focusQuestionInMindMap(addon, value) {
    const result = resolveQuestionCard(addon, value);
    focusQuestionCard(addon, result.note, result.noteId);
    return result;
  }

  return {
    bridgeScheme: BRIDGE_SCHEME,
    enhancementScript,
    findQuestionNote,
    findNoteById,
    isCurrentTargetNotebook,
    focusQuestionCard,
    focusQuestionInMindMap,
    focusRetestQuestionCard,
    isRetestQuestionCardFocused,
    startQuestionNavigation,
    resumePendingNavigation,
    questionIdFromBridgeURL,
    questionIdFromURL,
    resolveQuestionCard,
  };
})();
