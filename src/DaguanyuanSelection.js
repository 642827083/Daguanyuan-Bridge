var __DAGUANYUAN_SELECTION_GLOBAL__ = (function () {
  const QUESTION_TAG_PREFIX = "daguanyuan-question:v1|";
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

  function taggedQuestionFromNote(note) {
    const comments = nativeItems(nativeMember(note, "comments"));
    for (let index = 0; index < comments.length; index += 1) {
      const tag = String(nativeMember(comments[index], "tag") || "");
      if (tag.indexOf(QUESTION_TAG_PREFIX) !== 0) continue;
      const match = tag.match(/^daguanyuan-question:v1\|(daguanyuan|408os)\|(\d+)\|([^|]*)\|?(.*)$/);
      if (!match) continue;
      let url = "";
      try { url = decodeURIComponent(match[3] || ""); } catch (error) { continue; }
      if (match[1] === "daguanyuan" && !/^https:\/\/cxyonly\.fans\/math\//.test(url)) continue;
      if (match[1] === "408os" && !/^https:\/\/www\.408os\.cn\/exercise(?:[/?#]|$)/.test(url)) continue;
      return { provider: match[1], questionId: match[2], url };
    }
    return undefined;
  }

  function noteIdentifier(note) {
    return String(nativeMember(note, "noteId") || "");
  }

  function firstSelectedNote(window) {
    const application = Application.sharedInstance();
    const focusWindow = nativeMember(application, "focusWindow");
    const studyController = application.studyController(window || focusWindow);
    const notebookController = nativeMember(studyController, "notebookController");
    const mindmapView = nativeMember(notebookController, "mindmapView");
    const selectedViews = nativeItems(nativeMember(mindmapView, "selViewLst"));
    if (!selectedViews.length) throw new Error("请先在脑图中选中一张题目卡片");
    const note = noteFromSelectedView(selectedViews[0]);
    if (!note) throw new Error("未能读取选中的脑图卡片");
    return note;
  }

  function firstSelectedQuestion(window) {
    const note = firstSelectedNote(window);
    const tagged = taggedQuestionFromNote(note);
    if (tagged) return tagged;
    const url = questionURLFromText(noteText(note));
    if (url) return { provider: "daguanyuan", url, questionId: questionIdFromURL(url) };
    if (typeof __DAGUANYUAN_STORAGE_GLOBAL__ !== "undefined") {
      const cached = __DAGUANYUAN_STORAGE_GLOBAL__.questionForNoteId(noteIdentifier(note));
      if (cached) return cached;
    }
    throw new Error("选中的卡片没有可用的原题信息");
  }

  function selectedNotePath(window) {
    const note = firstSelectedNote(window);
    const titles = [];
    let current = note;
    let guard = 0;
    while (current && guard < 20) {
      const title = String(nativeMember(current, "noteTitle") || "").trim();
      if (title) titles.unshift(title);
      current = nativeMember(current, "parentNote");
      guard += 1;
    }
    if (titles[0] === "Daguanyuan Bridge") titles.shift();
    return { note, titles };
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

  function os408QuestionLocatorScript(value) {
    const questionId = String(value || "");
    if (!/^\d+$/.test(questionId)) return "";
    return `(function () {
      if (String(location.hostname || "") !== "www.408os.cn") return false;
      if (!/^\\/exercise(?:\\/|$)/.test(String(location.pathname || ""))) return false;
      var questionId = ${JSON.stringify(questionId)};
      var observerKey = "__DAGUANYUAN_408_SELECTED_QUESTION_OBSERVER__";
      function locate() {
        var target = document.querySelector('.question-wrapper[data-question-id="' + questionId + '"]');
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
      var observer = new MutationObserver(function () { locate(); });
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
    const selected = firstSelectedQuestion(window);
    if (selected.provider !== "daguanyuan") throw new Error("选中的卡片不是大观园数学题");
    return selected.url;
  }

  function firstSelectedQuestionAIURL(window) {
    const url = firstSelectedQuestionURL(window);
    const aiURL = questionAIURLFromURL(url);
    if (!aiURL) throw new Error("选中的题卡缺少可用的大观园题目编号");
    return aiURL;
  }

  return {
    firstSelectedQuestionURL,
    firstSelectedQuestion,
    firstSelectedQuestionAIURL,
    firstSelectedNote,
    noteIdentifier,
    os408QuestionLocatorScript,
    questionIdFromURL,
    questionLocatorScript,
    questionURLFromText,
    questionAIURLFromURL,
    selectedNotePath,
    taggedQuestionFromNote,
  };
})();
