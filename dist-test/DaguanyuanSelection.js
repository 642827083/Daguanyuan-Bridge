var __DAGUANYUAN_SELECTION_GLOBAL__ = (function () {
  const QUESTION_TAG_PREFIX = "daguanyuan-question:v1|";
  const DAGUANYUAN_CHAPTERS = [
    { practiceId: "329", chapterPath: ["高等数学", "（一）极限"], aliases: ["（一）极限", "(一)极限", "函数极限连续", "极限题目册", "极限不带答案"] },
    { practiceId: "322", chapterPath: ["高等数学", "（二）一元微分"], aliases: ["（二）一元微分", "(二)一元微分", "一元微分"] },
    { practiceId: "224", chapterPath: ["高等数学", "（三）一元积分"], aliases: ["（三）一元积分", "(三)一元积分", "积分计算", "积分应用", "反常积分"] },
    { practiceId: "325", chapterPath: ["高等数学", "（四）微分方程"], aliases: ["（四）微分方程", "(四)微分方程", "微分方程"] },
    { practiceId: "324", chapterPath: ["高等数学", "（五）多元微分"], aliases: ["（五）多元微分", "(五)多元微分", "多元微分"] },
    { practiceId: "326", chapterPath: ["高等数学", "（六）二重积分"], aliases: ["（六）二重积分", "(六)二重积分", "二重积分"] },
  ];
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
      current = nativeMember(current, "parentNote") || nativeMember(current, "parent") || nativeMember(current, "parentNode");
      guard += 1;
    }
    if (titles[0] === "Daguanyuan Bridge") titles.shift();
    return { note, titles };
  }

  function compactTitle(value) {
    return String(value || "")
      .replace(/[\s\u3000]+/g, "")
      .replace(/[（(]/g, "(")
      .replace(/[）)]/g, ")")
      .replace(/[：:]/g, ":")
      .trim()
      .toLowerCase();
  }

  function chapterForTitles(titles) {
    const values = Array.isArray(titles) ? titles : [];
    for (let index = 0; index < values.length; index += 1) {
      const current = compactTitle(values[index]);
      if (!current) continue;
      for (let chapterIndex = 0; chapterIndex < DAGUANYUAN_CHAPTERS.length; chapterIndex += 1) {
        const chapter = DAGUANYUAN_CHAPTERS[chapterIndex];
        if (chapter.aliases.some(function (alias) {
          const normalized = compactTitle(alias);
          return current === normalized || (normalized.length >= 4 && current.indexOf(normalized) >= 0);
        })) return chapter;
      }
    }
    return undefined;
  }

  function isLikelyQuestionNote(note) {
    if (!note) return false;
    const children = nativeItems(nativeMember(note, "childNotes"));
    if (children.length) return false;
    const title = String(nativeMember(note, "noteTitle") || "").trim();
    if (!title) return false;
    return /题|数[一二三]|真题|例题|练习|第\s*\d+|^\d{4}/i.test(title);
  }

  function categoryPathForTitles(note, titles, chapter) {
    const values = (Array.isArray(titles) ? titles : []).slice();
    const chapterPath = chapter && Array.isArray(chapter.chapterPath) ? chapter.chapterPath : [];
    let start = -1;
    for (let index = 0; index <= values.length - chapterPath.length; index += 1) {
      if (chapterPath.every(function (title, offset) {
        return compactTitle(values[index + offset]) === compactTitle(title);
      })) {
        start = index + chapterPath.length;
        break;
      }
    }
    if (start < 0 && chapter) {
      for (let index = values.length - 1; index >= 0; index -= 1) {
        const current = compactTitle(values[index]);
        if (chapter.aliases.some(function (alias) { return current === compactTitle(alias); })) {
          start = index + 1;
          break;
        }
      }
    }
    if (start < 0) start = values.length > 1 ? 1 : 0;
    let path = values.slice(start).filter(function (title) {
      const value = compactTitle(title);
      return value && value !== compactTitle("Daguanyuan Bridge") && value !== compactTitle("高等数学");
    });
    if (isLikelyQuestionNote(note) && path.length) path = path.slice(0, -1);
    return path;
  }

  function questionIndexInParent(note) {
    if (!note) return -1;
    const parent = nativeMember(note, "parentNote") || nativeMember(note, "parent") || nativeMember(note, "parentNode");
    const siblings = nativeItems(nativeMember(parent, "childNotes"));
    const selectedId = noteIdentifier(note);
    for (let index = 0; index < siblings.length; index += 1) {
      const sibling = siblings[index];
      if (sibling === note) return index;
      if (selectedId && noteIdentifier(sibling) === selectedId) return index;
    }
    return -1;
  }

  function firstSelectedDaguanyuanCategory(window) {
    const selected = selectedNotePath(window);
    const chapter = chapterForTitles(selected.titles);
    if (!chapter) throw new Error("未能从选中卡片的目录识别大观园数学章节");
    const questionIndex = questionIndexInParent(selected.note);
    return {
      provider: "daguanyuan",
      practiceId: chapter.practiceId,
      chapterPath: chapter.chapterPath.slice(),
      categoryPath: categoryPathForTitles(selected.note, selected.titles, chapter),
      titles: selected.titles,
      noteId: noteIdentifier(selected.note),
      notebookId: String(nativeMember(selected.note, "notebookId") || ""),
      questionIndex,
      questionNumber: questionIndex >= 0 ? questionIndex + 1 : 0,
    };
  }

  function orderedQuestionLocatorScript(value) {
    const questionIndex = Number(value);
    if (!Number.isInteger(questionIndex) || questionIndex < 0) return "";
    return `(function () {
      if (String(location.hostname || "") !== "cxyonly.fans") return JSON.stringify({ status: "invalid" });
      if (!/^\\/math\\/practice\\/\\d+/.test(String(location.pathname || ""))) return JSON.stringify({ status: "invalid" });
      if (window.__DAGUANYUAN_CATEGORY_NAVIGATION_STATE__) return JSON.stringify({ status: "waiting" });
      var questionIndex = ${JSON.stringify(questionIndex)};
      var cards = Array.prototype.slice.call(document.querySelectorAll("[data-learning-question-card]"));
      var stateKey = "__DAGUANYUAN_ORDERED_QUESTION_STATE__";
      var requestKey = String(location.pathname || "") + "|" + String(location.search || "") + "|" + questionIndex;
      function questionDocumentForCard(card) {
        if (!card) return null;
        var ownId = card.getAttribute && card.getAttribute("data-question-id");
        return ownId ? card : (card.querySelector ? card.querySelector("[data-question-id]") : null);
      }
      function questionIdForCard(card) {
        var questionDocument = questionDocumentForCard(card);
        var questionId = String(questionDocument && questionDocument.getAttribute("data-question-id") || "");
        return /^\\d+$/.test(questionId) ? questionId : "";
      }
      function expectedQuestionCount() {
        var lines = String(document.body && document.body.innerText || "").split(/\\r?\\n/);
        for (var index = 0; index < lines.length; index += 1) {
          var match = String(lines[index] || "").trim().match(/^(\\d+)\\s*\\/\\s*(\\d+)$/);
          if (!match) continue;
          var current = Number(match[1]);
          var total = Number(match[2]);
          if (total > 0 && current >= 0 && current <= total) return total;
        }
        return 0;
      }
      function resetInitialScroll(card) {
        var reset = false;
        var node = card && card.parentElement;
        while (node && node !== document.body) {
          if (Number(node.scrollTop || 0) > 1 && Number(node.scrollHeight || 0) > Number(node.clientHeight || 0)) {
            node.scrollTop = 0;
            reset = true;
          }
          node = node.parentElement;
        }
        var root = document.scrollingElement || document.documentElement || document.body;
        if (root && Number(root.scrollTop || 0) > 1) {
          root.scrollTop = 0;
          reset = true;
        }
        if (Number(window.scrollY || 0) > 1 && typeof window.scrollTo === "function") {
          window.scrollTo(0, 0);
          reset = true;
        }
        return reset;
      }
      function loadMoreButton() {
        var buttons = Array.prototype.slice.call(document.querySelectorAll("button"));
        for (var index = 0; index < buttons.length; index += 1) {
          var button = buttons[index];
          var label = String(button.innerText || button.textContent || "").replace(/\\s+/g, "").trim();
          if (label.indexOf("加载更多题目") >= 0 || label === "加载更多") return button;
        }
        return null;
      }
      var expectedCount = expectedQuestionCount();
      var state = window[stateKey];
      if (!state || state.requestKey !== requestKey) {
        state = { requestKey: requestKey, questionIds: [], stablePasses: 0 };
        window[stateKey] = state;
        if (resetInitialScroll(cards[0])) {
          return JSON.stringify({ status: "waiting", questionCount: 0, expectedQuestionCount: expectedCount });
        }
      }
      var visibleCards = {};
      var discoveredCount = 0;
      cards.forEach(function (card) {
        var questionId = questionIdForCard(card);
        if (!questionId) return;
        visibleCards[questionId] = card;
        if (state.questionIds.indexOf(questionId) >= 0) return;
        state.questionIds.push(questionId);
        discoveredCount += 1;
      });
      state.stablePasses = discoveredCount ? 0 : state.stablePasses + 1;
      var questionId = String(state.questionIds[questionIndex] || "");
      var target = visibleCards[questionId];
      if (!questionId) {
        var loadMore = loadMoreButton();
        if (loadMore && !loadMore.disabled && (!loadMore.getAttribute || loadMore.getAttribute("aria-disabled") !== "true")) {
          state.stablePasses = 0;
          loadMore.click();
          return JSON.stringify({ status: "waiting", questionCount: state.questionIds.length, expectedQuestionCount: expectedCount });
        }
        var lastCard = cards.length ? cards[cards.length - 1] : null;
        if (lastCard && typeof lastCard.scrollIntoView === "function") {
          lastCard.scrollIntoView({ block: "start", inline: "nearest", behavior: "auto" });
        }
        if ((expectedCount && state.questionIds.length >= expectedCount) || state.stablePasses >= 12) {
          return JSON.stringify({ status: "missing", questionCount: state.questionIds.length, expectedQuestionCount: expectedCount });
        }
        return JSON.stringify({ status: "waiting", questionCount: state.questionIds.length, expectedQuestionCount: expectedCount });
      }
      var href = String(location.href || "");
      var hashIndex = href.indexOf("#");
      var hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
      var base = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
      var queryIndex = base.indexOf("?");
      var path = queryIndex >= 0 ? base.slice(0, queryIndex) : base;
      var query = queryIndex >= 0 ? base.slice(queryIndex + 1) : "";
      var parts = query ? query.split("&").filter(function (part) {
        var rawName = String(part || "").split("=")[0].replace(/\\+/g, " ");
        try { return decodeURIComponent(rawName) !== "questionId"; } catch (error) { return rawName !== "questionId"; }
      }) : [];
      parts.push("questionId=" + encodeURIComponent(questionId));
      if (target && typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
      }
      window[stateKey] = undefined;
      return JSON.stringify({
        status: "found",
        questionId: questionId,
        questionCount: state.questionIds.length,
        expectedQuestionCount: expectedCount,
        url: path + "?" + parts.join("&") + hash
      });
    })();`;
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
    firstSelectedDaguanyuanCategory,
    firstSelectedNote,
    noteIdentifier,
    questionIndexInParent,
    orderedQuestionLocatorScript,
    os408QuestionLocatorScript,
    questionIdFromURL,
    questionLocatorScript,
    questionURLFromText,
    questionAIURLFromURL,
    selectedNotePath,
    taggedQuestionFromNote,
  };
})();
