var __DAGUANYUAN_SELECTION_GLOBAL__ = (function () {
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

  function noteFromSelectedView(selectedView) {
    const candidates = [
      nativeMember(selectedView, "note"),
      nativeMember(selectedView, "node"),
      nativeMember(selectedView, "mindMapNode"),
      nativeMember(selectedView, "mindmapNode"),
      nativeMember(selectedView, "view"),
      selectedView,
    ];
    for (const candidate of candidates) {
      if (!candidate) continue;
      if (nativeMember(candidate, "noteTitle") !== undefined) return candidate;
      const nested = nativeMember(candidate, "note");
      if (nested && nativeMember(nested, "noteTitle") !== undefined) return nested;
    }
    return undefined;
  }

  function noteText(note) {
    if (!note) return "";
    const parts = [];
    const excerpt = nativeMember(note, "excerptText");
    const notes = nativeMember(note, "notesText");
    if (excerpt) parts.push(String(excerpt));
    if (notes) parts.push(String(notes));
    for (const comment of nativeItems(nativeMember(note, "comments"))) {
      if (nativeMember(comment, "text")) parts.push(String(nativeMember(comment, "text")));
    }
    if (!parts.length) {
      const allText = nativeMember(note, "allNoteText");
      if (allText) parts.push(String(allText));
    }
    return parts.join("\n");
  }

  function questionURLFromText(value) {
    const text = String(value || "");
    const hidden = text.match(/<!--\s*DAGUANYUAN_URL:([^\s]+)\s*-->/);
    if (hidden && /^https:\/\/cxyonly\.fans\/math\/(?:questions\/\d+|practice\/\d+(?:\?[^\s)]+)?)$/.test(hidden[1])) {
      return hidden[1];
    }
    const match = text.match(/https:\/\/cxyonly\.fans\/math\/(?:questions\/\d+|practice\/\d+(?:\?[^\s)]+)?)/);
    return match ? match[0] : "";
  }

  function questionIdFromURL(value) {
    const url = String(value || "");
    const detail = url.match(/^https:\/\/cxyonly\.fans\/math\/questions\/(\d+)(?:[?#][^\s]*)?$/);
    if (detail) return detail[1];
    if (!/^https:\/\/cxyonly\.fans\/math\/practice\/\d+\?[^#\s]+$/.test(url)) return "";
    const practice = url.match(/[?&]questionId=(\d+)(?:&|$)/);
    return practice ? practice[1] : "";
  }

  function questionLocatorScript(value) {
    const questionId = String(value || "");
    if (!/^\d+$/.test(questionId)) return "";
    return `(function () {
      if (String(location.hostname || "") !== "cxyonly.fans") return false;
      if (!/^\\/math\\/practice\\/\\d+/.test(String(location.pathname || ""))) return false;
      var questionId = ${JSON.stringify(questionId)};
      var observerKey = "__DAGUANYUAN_SELECTED_QUESTION_OBSERVER__";
      function locate() {
        var target = document.querySelector('[data-question-id="' + questionId + '"]');
        if (!target) return false;
        target.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
        if (window[observerKey]) {
          window[observerKey].disconnect();
          window[observerKey] = undefined;
        }
        return true;
      }
      if (window[observerKey]) window[observerKey].disconnect();
      if (locate()) return true;
      if (typeof MutationObserver !== "function") return false;
      var observer = new MutationObserver(function () {
        locate();
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      window[observerKey] = observer;
      return false;
    })();`;
  }

  function questionAIURLFromURL(value) {
    const url = String(value || "");
    if (/^https:\/\/cxyonly\.fans\/math\/questions\/\d+(?:\?[^\s]*)?$/.test(url)) return url;
    const practice = url.match(/^https:\/\/cxyonly\.fans(\/math\/practice\/\d+\?[^#\s]+)$/);
    if (!practice) return "";
    const question = practice[1].match(/[?&]questionId=(\d+)(?:&|$)/);
    if (!question) return "";
    return `https://cxyonly.fans/math/questions/${question[1]}?returnTo=${encodeURIComponent(practice[1])}`;
  }

  function firstSelectedQuestionURL(window) {
    const application = Application.sharedInstance();
    const focusWindow = nativeMember(application, "focusWindow");
    const studyController = application.studyController(window || focusWindow);
    const notebookController = nativeMember(studyController, "notebookController");
    const mindmapView = nativeMember(notebookController, "mindmapView");
    const selectedViews = nativeItems(nativeMember(mindmapView, "selViewLst"));
    if (!selectedViews.length) throw new Error("请先在脑图中选中一张题目卡片");
    const url = questionURLFromText(noteText(noteFromSelectedView(selectedViews[0])));
    if (!url) throw new Error("选中的卡片没有可用的大观园原题链接");
    return url;
  }

  function firstSelectedQuestionAIURL(window) {
    const url = firstSelectedQuestionURL(window);
    const aiURL = questionAIURLFromURL(url);
    if (!aiURL) throw new Error("选中的题卡缺少可用的大观园题目编号");
    return aiURL;
  }

  return {
    firstSelectedQuestionURL,
    firstSelectedQuestionAIURL,
    questionIdFromURL,
    questionLocatorScript,
    questionURLFromText,
    questionAIURLFromURL,
  };
})();
