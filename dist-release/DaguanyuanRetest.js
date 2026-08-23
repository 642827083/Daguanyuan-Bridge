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

  function findQuestionNote(notebook, questionId) {
    const root = findRoot(notebook);
    if (!root) return undefined;
    const stack = [root];
    const visited = [];
    while (stack.length) {
      const note = stack.pop();
      if (!note || visited.indexOf(note) >= 0) continue;
      visited.push(note);
      const title = String(nativeMember(note, "noteTitle") || "");
      const prefix = `题目 ${questionId}`;
      const titleMatches = title === prefix || title.indexOf(`${prefix}｜`) === 0;
      const url = questionURLFromText(noteText(note));
      if (titleMatches && questionIdFromURL(url) === questionId) return note;
      const children = nativeItems(nativeMember(note, "childNotes"));
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
    const notebook = notebookId ? Database.sharedInstance().getNotebookById(notebookId) : undefined;
    if (!notebook) throw new Error("请先打开包含导入题卡的 MarginNote 笔记本");
    const note = findQuestionNote(notebook, questionId);
    if (!note) throw new Error(`当前笔记本中未找到题目 ${questionId}，请先导入所在分类`);
    const noteId = nativeMember(note, "noteId");
    if (!noteId) throw new Error(`题目 ${questionId} 的脑图卡片缺少笔记 ID`);
    if (!notebookController || typeof notebookController.changeFocusToNote !== "function") {
      throw new Error("当前 MarginNote 版本不支持切换脑图焦点");
    }
    if (!studyController || typeof studyController.focusNoteInMindMapById !== "function") {
      throw new Error("当前 MarginNote 版本不支持脑图卡片定位");
    }
    return { questionId, noteId: String(noteId), note };
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
    focusQuestionCard,
    focusQuestionInMindMap,
    questionIdFromBridgeURL,
    questionIdFromURL,
    resolveQuestionCard,
  };
})();
