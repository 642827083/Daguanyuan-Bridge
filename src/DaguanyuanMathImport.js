var __DAGUANYUAN_MATH_IMPORT_GLOBAL__ = (function () {
  const ROOT_TITLE = "Daguanyuan Bridge";
  const ROOT_MARKER = "DAGUANYUAN_ROOT:1";
  const QUESTION_PREFIX = "DAGUANYUAN_QUESTION_ID:";
  const URL_PREFIX = "DAGUANYUAN_URL:";

  function nativeItems(list) {
    if (!list) return [];
    const countValue = typeof list.count === "function" ? list.count() : list.length;
    const count = Number(countValue) || 0;
    const result = [];
    for (let index = 0; index < count; index += 1) {
      result.push(typeof list.objectAtIndex === "function" ? list.objectAtIndex(index) : list[index]);
    }
    return result;
  }

  function value(object, key) {
    const member = object && object[key];
    return typeof member === "function" ? member.call(object) : member;
  }

  function noteId(note) {
    return String(value(note, "noteId") || "");
  }

  function commentText(comment) {
    return String(value(comment, "text") || "");
  }

  function marker(name) {
    return `<!-- ${name} -->`;
  }

  function commentBody(note) {
    return nativeItems(note && note.comments).map(commentText).join("\n");
  }

  function linkedQuestion(note) {
    const body = commentBody(note);
    const os408 = body.match(/<!--\s*DAGUANYUAN_408_QUESTION_ID:(\d+)\s*-->/);
    if (os408) {
      const id = Number(os408[1]);
      const address = body.match(/<!--\s*DAGUANYUAN_408_URL:(https:\/\/www\.408os\.cn\/exercise\?[^\s<>]+)\s*-->/);
      const sourceYear = String(value(note, "noteTitle") || "").match(/^\s*(\d{4})年\s+第\d+题/);
      return Number.isSafeInteger(id) && id > 0
        ? { id, provider: "408", url: address ? address[1] : "", noteId: noteId(note), year: sourceYear ? Number(sourceYear[1]) : undefined } : null;
    }
    const idMatch = body.match(/<!--\s*DAGUANYUAN_QUESTION_ID:(\d+)\s*-->/);
    if (!idMatch) return null;
    const id = Number(idMatch[1]);
    if (!Number.isSafeInteger(id) || id < 1) return null;
    const urlMatch = body.match(/<!--\s*DAGUANYUAN_URL:(https:\/\/(?:www\.)?cxyonly\.fans\/math\/[^\s<>]+)\s*-->/);
    return { id, url: urlMatch ? urlMatch[1] : "", noteId: noteId(note) };
  }

  function notebookContext(addon, requireDocument) {
    const application = Application.sharedInstance();
    const study = application.studyController(addon && addon.window);
    const notebookController = study && study.notebookController;
    const notebookId = notebookController && value(notebookController, "notebookId");
    const database = Database.sharedInstance();
    const notebook = notebookId && database.getNotebookById(notebookId);
    const topicId = notebook && value(notebook, "topicId");
    const documentController = study && study.readerController && study.readerController.currentDocumentController;
    const document = documentController && documentController.document;
    if (!notebook || !topicId || (requireDocument && !document)) {
      throw new Error("请先打开一个包含当前文档的 MarginNote 笔记本");
    }
    return { application, study, notebookController, database, notebook, document, topicId };
  }

  function indexForContext(context, provider) {
    const byQuestion = {};
    const byNote = {};
    const visited = {};
    function scan(note) {
      const id = noteId(note);
      if (id && visited[id]) return;
      if (id) visited[id] = true;
      const link = linkedQuestion(note);
      if (link && (link.provider || "math") === (provider || "math") && !byQuestion[link.id]) {
        byQuestion[link.id] = note;
        if (id) byNote[id] = link;
      }
      nativeItems(note && note.childNotes).forEach(scan);
    }
    nativeItems(context.notebook.notes || context.notebook.childNotes).forEach(scan);
    return { byQuestion, byNote };
  }

  function importedQuestionIds(addon) {
    return Object.keys(indexForContext(notebookContext(addon, false)).byQuestion).map(Number).sort(function (left, right) {
      return left - right;
    });
  }

  function questionForNote(note) {
    const link = linkedQuestion(note);
    if (!link) return null;
    if (link.provider === "408" || commentBody(note).indexOf(marker("DAGUANYUAN_SINGLE_IMPORT:1")) >= 0) return link;
    const path = [];
    const visited = {};
    let parent = value(note, "parentNote");
    while (parent && path.length < 20) {
      const id = noteId(parent);
      if (id && visited[id]) break;
      if (id) visited[id] = true;
      const title = String(value(parent, "noteTitle") || "").trim();
      if (title === ROOT_TITLE) break;
      if (title) path.unshift(title);
      parent = value(parent, "parentNote");
    }
    if (!path.length) return link;
    try {
      const route = __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.resolve(path);
      if (route.status === "resolved" && route.matchedSegments === path.length) {
        link.url = questionURL(route.categoryId, link.id);
      }
    } catch (error) { console.log(`[Daguanyuan Bridge] 读取卡片当前分类失败：${error && error.message || error}`); }
    return link;
  }

  function focusQuestion(addon, questionId, provider) {
    const id = __DAGUANYUAN_MATH_API_GLOBAL__.positiveInteger(questionId, "题目 ID");
    return __DAGUANYUAN_CARD_LOCATOR_GLOBAL__.locate(addon, id, provider);
  }

  function createNote(title, context) {
    const note = context.document ? Note.createWithTitleNotebookDocument(title, context.notebook, context.document)
      : context.database.createNoteWithTitleTopicid(title, context.topicId);
    if (!note) throw new Error("MarginNote 未能创建脑图卡片");
    return note;
  }

  function findRoot(context) {
    requireImportUtils();
    const roots = nativeItems(context.notebook.notes || context.notebook.childNotes);
    const current = roots.map(liveNote).filter(Boolean);
    const existing = current.find(function (note) { return commentBody(note).indexOf(ROOT_MARKER) >= 0; })
      || current.find(function (note) { return String(value(note, "noteTitle") || "") === ROOT_TITLE; });
    if (existing) return existing;
    const root = createNote(ROOT_TITLE, context);
    root.appendMarkdownComment(marker(ROOT_MARKER));
    return root;
  }

  function findOrCreatePath(root, path, context) {
    let parent = root;
    path.forEach(function (part) {
      const title = String(part || "").trim();
      if (!title) throw new Error("题目分类路径无效");
      const parentId = noteId(parent);
      let child = nativeItems(parent.childNotes).map(liveNote).filter(Boolean).find(function (item) {
        return String(value(item, "noteTitle") || "").trim() === title
          && noteId(value(item, "parentNote")) === parentId;
      });
      if (!child) {
        child = createNote(title, context);
        parent.addChild(child);
      }
      parent = child;
    });
    return parent;
  }

  function requireImportUtils() {
    if (typeof MNUtil === "undefined" || !MNUtil || typeof MNUtil.getNoteById !== "function") {
      throw new Error("分类导入查重需要 MN Utils，请安装并启用 MN Utils");
    }
  }

  function liveNote(note) {
    const id = noteId(note);
    if (!id) return null;
    const current = MNUtil.getNoteById(id);
    return current && noteId(current) === id ? current : null;
  }

  function findQuestionAtPath(context, path, questionId, provider) {
    requireImportUtils();
    // 查重只读取现有目录，不提前创建空分类；每次通过封装查询最新卡片，忽略已删除对象。
    const roots = nativeItems(context.notebook.notes || context.notebook.childNotes).map(liveNote).filter(Boolean);
    let parent = roots.find(function (note) { return commentBody(note).indexOf(ROOT_MARKER) >= 0; })
      || roots.find(function (note) { return String(value(note, "noteTitle") || "") === ROOT_TITLE; });
    for (const part of path) {
      if (!parent) return null;
      const parentId = noteId(parent);
      parent = nativeItems(parent.childNotes).map(liveNote).filter(Boolean).find(function (child) {
        return String(value(child, "noteTitle") || "").trim() === part
          && noteId(value(child, "parentNote")) === parentId;
      });
    }
    if (!parent) return null;
    const parentId = noteId(parent);
    const matches = nativeItems(parent.childNotes).map(liveNote).filter(function (child) {
      if (!child || noteId(value(child, "parentNote")) !== parentId) return false;
      const link = linkedQuestion(child);
      return link && (link.provider || "math") === provider && link.id === Number(questionId);
    });
    if (matches.length > 1) throw new Error("目标分类下有多张相同题卡，请先整理后重试");
    return matches[0] || null;
  }

  function hasQuestionAtPath(context, path, questionId, provider) {
    return Boolean(findQuestionAtPath(context, path, questionId, provider));
  }

  function pathFor408(category) {
    if (!category || !category.title || !/^https:\/\/www\.408os\.cn\/exercise\?/.test(category.url)) throw new Error("408 分类信息无效");
    const path = Array.isArray(category.path) ? category.path : /[?&]knowledgeId=/.test(category.url) ? null : [category.title];
    if (!path || !path.length || path.length > 20 || path.some(function (part) { return typeof part !== "string" || !part.trim(); })
      || path[path.length - 1].trim() !== category.title.trim()) throw new Error("408 分类目录不完整，请刷新后重试");
    return ["408"].concat(path.map(function (part) { return part.trim(); }));
  }

  function questionURL(categoryId, questionId) {
    const route = __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.resultForCategoryId(categoryId);
    const categoryURL = __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.urlFor(route);
    if (!categoryURL) throw new Error("题目分类未收录，请先更新分类数据");
    return `${categoryURL}${categoryURL.indexOf("?") < 0 ? "?" : "&"}questionId=${questionId}`;
  }

  function routeForQuestion(question, selectedCategoryId) {
    const routes = __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__;
    const primary = routes.resultForCategoryId(question.categoryId);
    if (!selectedCategoryId) return primary;
    const selected = routes.resultForCategoryId(selectedCategoryId);
    if (selected.status !== "resolved") throw new Error("所选题目分类不存在，请先更新分类数据");
    const ids = (question.categoryIds || [question.categoryId]).map(Number);
    if (ids.indexOf(selectedCategoryId) >= 0) return selected;
    throw new Error("这道题不直接属于当前分类");
  }

  function normalizeInlineMath(content) {
    return String(content || "").replace(/(^|[^\\$])\$([^\r\n$]+)\$(?!\$)/g, function (match, prefix, expression) {
      const normalized = expression.replace(/^[ \t]+|[ \t]+$/g, "");
      return normalized ? `${prefix}$${normalized}$` : match;
    });
  }

  function normalizeDisplayMath(content) {
    return String(content || "").replace(/[ \t]*\$\$([\s\S]*?)\$\$[ \t]*/g, function (match, expression) {
      const normalized = expression.trim();
      return normalized ? `\n\n$$\n${normalized}\n$$\n\n` : match;
    }).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function normalizeQuestionContent(content) {
    const original = String(content || "");
    const blocks = [];
    let prefix = "\uE000DAGUANYUAN_CODE_";
    while (original.indexOf(prefix) >= 0) prefix += "_";
    // 代码中的空行、行尾空格和美元符号不参与题目公式整理。
    const protectedContent = original.replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[ \t]*(?=\r?$)/gm, function (block) {
      const marker = prefix + blocks.length + "\uE001";
      blocks.push(block);
      return marker;
    });
    let result = normalizeDisplayMath(normalizeInlineMath(protectedContent));
    blocks.forEach(function (block, index) { result = result.split(prefix + index + "\uE001").join(block); });
    return result;
  }

  function questionMarkdown(question, url, provider) {
    const stem = normalizeQuestionContent(question.stem);
    if (!stem) throw new Error("题目缺少题干");
    const options = (question.options || []).map(function (option, index) {
      if (!option) return "";
      const separator = /^ {0,3}(`{3,}|~{3,})[^\n]*\n/.test(option) ? "\n\n" : " ";
      return normalizeQuestionContent(`${"ABCD"[index]}.${separator}${option}`);
    }).filter(Boolean);
    return [stem].concat(options).concat([
        marker(`${provider === "408" ? "DAGUANYUAN_408_QUESTION_ID:" : QUESTION_PREFIX}${question.id}`),
        marker(`${provider === "408" ? "DAGUANYUAN_408_URL:" : URL_PREFIX}${url}`),
    ]).join("\n\n");
  }

  function titleFor(question) {
    const source = String(question.source || "").trim();
    return source ? source.slice(0, 80) : `题目 ${question.id}`;
  }

  function normalizeIds(value) {
    if (!Array.isArray(value) || !value.length || value.length > 500) throw new Error("请选择 1 至 500 道题目");
    const seen = {};
    return value.map(function (item) {
      const id = __DAGUANYUAN_MATH_API_GLOBAL__.positiveInteger(item, "题目 ID");
      if (seen[id]) throw new Error("题目 ID 重复");
      seen[id] = true;
      return id;
    });
  }

  function saveQuestionImages(note, question) {
    if (!question.hasBase64Image) return;
    const before = commentBody(note);
    const diagnostics = {
      imageCount: (before.match(/data:image\/[^\s)]+;base64,/gi) || []).length,
      base64Chars: (before.match(/data:image\/[^\s)]+/gi) || []).reduce(function (size, item) { return size + item.length; }, 0),
      processorAvailable: typeof note.processMarkdownBase64Images === "function",
    };
    const mediaBefore = String(value(note, "mediaList") || "");
    try {
      if (!diagnostics.processorAvailable) throw new Error("当前 MarginNote 未提供题目图片保存接口");
      const processed = note.processMarkdownBase64Images();
      diagnostics.processorResult = `${String(processed)}（${typeof processed}）`;
      diagnostics.remainingImages = (commentBody(note).match(/data:image\/[^\s)]+;base64,/gi) || []).length;
      diagnostics.mediaChanged = String(value(note, "mediaList") || "") !== mediaBefore;
      if (processed !== true || diagnostics.remainingImages) throw new Error("MarginNote 未能完整保存题目图片");
    } catch (failure) {
      const error = new Error(String(failure && failure.message || failure));
      error.stage = "MarginNote 保存图片";
      error.diagnostics = diagnostics;
      throw error;
    }
  }

  // 两路校验值用于识别导入内容是否变化，原文和保存图片后的内容分别记录。
  function contentStamp(text) {
    let first = 2166136261;
    let second = 5381;
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      first = Math.imul(first ^ code, 16777619);
      second = Math.imul(second, 33) ^ code;
    }
    return text.length + ":" + (first >>> 0).toString(16) + ":" + (second >>> 0).toString(16);
  }

  function stampedContent(raw, rendered, suffix) {
    return rendered + "\n\n" + marker("DAGUANYUAN_SOURCE_STAMP:" + contentStamp(raw))
      + "\n\n" + marker("DAGUANYUAN_RENDERED_STAMP:" + contentStamp(rendered)) + suffix;
  }

  function commentEditor(note) {
    const editor = typeof MNNote !== "undefined" && MNNote && typeof MNNote.new === "function" && MNNote.new(noteId(note));
    if (!editor || ["appendMarkdownComment", "removeCommentByIndex", "sortCommentsByNewIndices"].some(function (key) {
      return typeof editor[key] !== "function";
    })) throw new Error("更新题卡需要 MN Utils 的评论接口，请安装并启用最新版 MN Utils");
    return editor;
  }

  function importedComment(note, id, provider) {
    const prefix = provider === "408" ? "DAGUANYUAN_408_" : "DAGUANYUAN_";
    const comments = nativeItems(note.comments);
    const matches = comments.map(function (comment, index) { return { text: commentText(comment), index: index }; })
      .filter(function (item) { return item.text.indexOf(marker(prefix + "QUESTION_ID:" + id)) >= 0; });
    if (matches.length !== 1) throw new Error("题卡的导入内容标记缺失或重复，原内容已保留");
    const item = matches[0];
    const end = new RegExp("<!--\\s*" + prefix + "URL:[^<>]+\\s*-->").exec(item.text);
    if (!end) throw new Error("题卡的来源标记缺失，原内容已保留");
    const offset = end.index + end[0].length;
    const tail = item.text.slice(offset);
    const stamps = /^\n\n<!-- DAGUANYUAN_SOURCE_STAMP:([\da-f:]+) -->\n\n<!-- DAGUANYUAN_RENDERED_STAMP:([\da-f:]+) -->/.exec(tail);
    return { index: item.index, prefix: item.text.slice(0, offset), suffix: stamps ? tail.slice(stamps[0].length) : tail,
      sourceStamp: stamps && stamps[1], renderedStamp: stamps && stamps[2] };
  }

  function initializeQuestion(note, question, markdown, suffix) {
    if (!question.hasBase64Image) { note.appendMarkdownComment(stampedContent(markdown, markdown, suffix)); return; }
    const editor = commentEditor(note);
    editor.appendMarkdownComment(markdown);
    saveQuestionImages(note, question);
    const rendered = commentText(nativeItems(note.comments)[0]);
    const finalText = stampedContent(markdown, rendered, suffix);
    editor.appendMarkdownComment(finalText);
    editor.removeCommentByIndex(0);
    if (nativeItems(note.comments).length !== 1 || commentText(nativeItems(note.comments)[0]) !== finalText) {
      throw new Error("题卡图片内容保存失败");
    }
  }

  function updateQuestion(note, question, markdown, provider) {
    const original = importedComment(note, question.id, provider);
    if (original.prefix === markdown || original.sourceStamp === contentStamp(markdown)
      && original.renderedStamp === contentStamp(original.prefix)) return false;
    const editor = commentEditor(note);
    const before = nativeItems(note.comments);
    if (/data:image\/[^\s)]+;base64,/i.test(commentBody(note))) {
      throw new Error("原卡片含未保存的图片数据，请先保存后重试；原内容已保留");
    }
    let finalText = "";
    try {
      // 图片先保存到原卡片的临时评论中；旧题干与独立笔记一直保留到全部步骤成功。
      editor.appendMarkdownComment(markdown);
      if (nativeItems(note.comments).length !== before.length + 1) throw new Error("题卡评论追加失败，原内容已保留");
      saveQuestionImages(note, question);
      const rendered = commentText(nativeItems(note.comments)[before.length]);
      finalText = stampedContent(markdown, rendered, original.suffix);
      editor.appendMarkdownComment(finalText);
      if (nativeItems(note.comments).length !== before.length + 2) throw new Error("题卡评论追加失败，原内容已保留");
      editor.removeCommentByIndex(before.length);
      const order = before.map(function (_, index) { return index; });
      order.splice(original.index, 0, before.length);
      editor.sortCommentsByNewIndices(order);
      const sorted = nativeItems(note.comments);
      if (commentText(sorted[original.index]) !== finalText || sorted.length !== before.length + 1
        || commentText(sorted[original.index + 1]) !== commentText(before[original.index])) {
        throw new Error("题卡评论排序失败，原内容已保留");
      }
      editor.removeCommentByIndex(original.index + 1);
      if (nativeItems(note.comments).length !== before.length) throw new Error("旧题目评论移除失败，原内容已保留");
      return "updated";
    } catch (error) {
      // 只移除本次追加的评论，不重建旧评论，保持原笔记与手写对象。
      const current = nativeItems(note.comments);
      const oldTexts = before.map(commentText);
      const questionMarker = marker((provider === "408" ? "DAGUANYUAN_408_" : "DAGUANYUAN_") + "QUESTION_ID:" + question.id);
      for (let index = current.length - 1; index >= 0; index -= 1) {
        const text = commentText(current[index]);
        if (text.indexOf(questionMarker) >= 0 && oldTexts.indexOf(text) < 0) editor.removeCommentByIndex(index);
      }
      const restored = nativeItems(note.comments);
      const oldText = oldTexts[original.index];
      if (!restored.some(function (item) { return commentText(item) === oldText; })) {
        editor.appendMarkdownComment(oldText);
        const order = restored.map(function (_, index) { return index; });
        order.splice(original.index, 0, restored.length);
        editor.sortCommentsByNewIndices(order);
      }
      error.stage = error.stage || "MarginNote 更新题卡";
      throw error;
    }
  }

  function preparedSingleSession(addon, provider) {
    if (provider !== "math" && provider !== "408") throw new Error("题目来源无效");
    const context = notebookContext(addon, false);
    const parent = value(context.notebookController, "focusNote");
    const parentId = noteId(parent);
    const notebookId = String(value(context.notebookController, "notebookId"));
    if (!parentId) throw new Error("请先在 MarginNote 中选中一张父卡片");
    if (String(value(parent, "notebookId") || "") !== notebookId) {
      throw new Error("所选卡片不属于当前笔记本");
    }
    const parentDocument = value(parent, "docMd5");
    context.document = parentDocument && context.database.getDocumentById(parentDocument) || context.document;
    function currentParent() {
      const current = context.database.getNoteById(parentId);
      const study = context.application.studyController(addon && addon.window);
      const activeNotebookId = study && value(study.notebookController, "notebookId");
      if (!current || String(value(current, "notebookId")) !== notebookId || String(activeNotebookId) !== notebookId) {
        throw new Error("原父卡片已删除或笔记本已切换，请重新选择后导入");
      }
      return current;
    }
    function findQuestion(id) {
      const selectedParent = currentParent();
      const matches = nativeItems(selectedParent.childNotes).map(function (child) {
        return context.database.getNoteById(noteId(child));
      }).filter(function (child) {
        if (!child || noteId(value(child, "parentNote")) !== parentId) return false;
        const link = linkedQuestion(child);
        return link && (link.provider || "math") === provider && link.id === Number(id);
      });
      if (matches.length > 1) throw new Error("所选父卡片下有多张相同题卡，请先整理后重试");
      return matches[0] || null;
    }
    return {
      hasQuestion: function (id) { return Boolean(findQuestion(id)); },
      write: function (question, category) {
        const id = __DAGUANYUAN_MATH_API_GLOBAL__.positiveInteger(question && question.id, "题目 ID");
        const existing = findQuestion(id);
        if (provider === "408" && (!category || !/^https:\/\/www\.408os\.cn\/exercise\?/.test(category.url))) throw new Error("408 题目页面信息无效");
        const url = provider === "408" ? `${category.url}&questionId=${id}`
          : category && /^https:\/\/(?:www\.)?cxyonly\.fans\/math\/practice\/\d+\/?$/.test(category.url)
            ? `${category.url}?questionId=${id}` : questionURL(question.categoryId, id);
        const markdown = questionMarkdown(question, url, provider);
        let note;
        let outcome = true;
        UndoManager.sharedInstance().undoGrouping("导入单题", context.topicId, function () {
          if (existing) { outcome = updateQuestion(existing, question, markdown, provider); return; }
          try {
            const selectedParent = currentParent();
            note = createNote(titleFor(question), context);
            initializeQuestion(note, question, markdown, "\n\n" + marker("DAGUANYUAN_SINGLE_IMPORT:1"));
            selectedParent.addChild(note);
          } catch (error) {
            if (note && noteId(note)) context.database.deleteBookNoteTree(noteId(note));
            throw error;
          }
        });
        context.application.refreshAfterDBChanged(context.topicId);
        return outcome;
      },
    };
  }

  function prepared408Session(addon) {
    const context = notebookContext(addon, true);
    return {
      hasQuestion: function (id, category) { return hasQuestionAtPath(context, pathFor408(category), id, "408"); },
      write: function (question, category) {
        const id = __DAGUANYUAN_MATH_API_GLOBAL__.positiveInteger(question && question.id, "题目 ID");
        const categoryPath = pathFor408(category);
        const existing = findQuestionAtPath(context, categoryPath, id, "408");
        const url = `${category.url}&questionId=${id}`;
        let note;
        let outcome = true;
        UndoManager.sharedInstance().undoGrouping("导入 408 题目", context.topicId, function () {
          if (existing) { outcome = updateQuestion(existing, question, questionMarkdown(question, url, "408"), "408"); return; }
          try {
            const markdown = questionMarkdown(question, url, "408");
            const parent = findOrCreatePath(findRoot(context), categoryPath, context);
            note = createNote(titleFor(question), context);
            initializeQuestion(note, question, markdown, "");
            parent.addChild(note);
          } catch (error) {
            if (note && noteId(note)) context.database.deleteBookNoteTree(noteId(note));
            throw error;
          }
        });
        context.application.refreshAfterDBChanged(context.topicId);
        return outcome;
      },
    };
  }

  function importQuestions(addon, rawIds, onProgress, categoryIdsByQuestion, existingContext) {
    const ids = normalizeIds(rawIds);
    const context = existingContext || notebookContext(addon, true);
    const result = { createdCount: 0, updatedCount: 0, skippedCount: 0, failed: [] };
    const pending = ids;
    const report = typeof onProgress === "function" ? onProgress : function () {};
    const readyById = {};
    let fetched = 0;
    function fetchWave(offset) {
      if (offset >= pending.length) return Promise.resolve();
      return Promise.all(pending.slice(offset, offset + 3).map(function (id) {
        return __DAGUANYUAN_MATH_API_GLOBAL__.questionDetail(id).then(function (question) {
          readyById[id] = question;
        }).catch(function (error) {
          result.failed.push({ questionId: id, reason: String(error && error.message || error) });
        }).then(function () {
          fetched += 1;
          report({ phase: "fetching", processed: fetched, total: pending.length, created: 0, skipped: result.skippedCount, failed: result.failed.length });
        });
      })).then(function () { return fetchWave(offset + 3); });
    }
    report({ phase: "fetching", processed: 0, total: pending.length, created: 0, skipped: result.skippedCount, failed: 0 });
    return fetchWave(0).then(function () {
      const ready = pending.map(function (id) { return readyById[id]; }).filter(Boolean);
      let written = 0;
      let root;
      for (let offset = 0; offset < ready.length; offset += 10) {
        const batch = ready.slice(offset, offset + 10);
        UndoManager.sharedInstance().undoGrouping("导入大观园数学题目", context.topicId, function () {
          batch.forEach(function (question) {
            let note;
            try {
              const selectedCategoryId = categoryIdsByQuestion && Object.prototype.hasOwnProperty.call(categoryIdsByQuestion, question.id)
                ? __DAGUANYUAN_MATH_API_GLOBAL__.positiveInteger(categoryIdsByQuestion[question.id], "所选分类 ID") : 0;
              const route = routeForQuestion(question, selectedCategoryId);
              if (route.status !== "resolved") throw new Error("题目分类未收录，请先更新分类数据");
              const url = questionURL(route.categoryId, question.id);
              const markdown = questionMarkdown(question, url);
              const existing = findQuestionAtPath(context, route.path, question.id, "math");
              if (existing) {
                if (updateQuestion(existing, question, markdown, "math") === "updated") result.updatedCount += 1;
                else result.skippedCount += 1;
                return;
              }
              if (!root) root = findRoot(context);
              const parent = findOrCreatePath(root, route.path, context);
              note = createNote(titleFor(question), context);
              initializeQuestion(note, question, markdown, "");
              parent.addChild(note);
              result.createdCount += 1;
            } catch (error) {
              if (note && noteId(note)) context.database.deleteBookNoteTree(noteId(note));
              result.failed.push({ questionId: question.id, source: titleFor(question), stage: error.stage || "MarginNote 建卡",
                diagnostics: error.diagnostics, reason: String(error && error.message || error) });
            }
            written += 1;
            report({ phase: "writing", processed: written, total: ready.length, created: result.createdCount,
              updated: result.updatedCount, skipped: result.skippedCount, failed: result.failed.length });
          });
        });
        context.application.refreshAfterDBChanged(context.topicId);
      }
      return result;
    });
  }

  function importCategory(addon, rawCategoryId, rawScope, onProgress) {
    const categoryId = __DAGUANYUAN_MATH_API_GLOBAL__.positiveInteger(rawCategoryId, "分类 ID");
    const scope = __DAGUANYUAN_MATH_API_GLOBAL__.questionScope(rawScope);
    const route = __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.resultForCategoryId(categoryId);
    if (route.status !== "resolved") throw new Error("当前分类不在本地分类数据中，请先更新分类数据");
    const context = notebookContext(addon, true);
    const report = typeof onProgress === "function" ? onProgress : function () {};
    const result = { categoryId, categoryPath: route.path, scope, total: 0, createdCount: 0, updatedCount: 0, skippedCount: 0, failed: [] };
    const seen = {};
    let page = 1;
    let pageCount = 0;
    function nextPage() {
      if (pageCount && page > pageCount) return Promise.resolve(result);
      return __DAGUANYUAN_MATH_API_GLOBAL__.questionPage(categoryId, page, scope).then(function (listing) {
        if (page === 1) {
          result.total = listing.total;
          pageCount = Math.ceil(listing.total / listing.pageSize);
          if (pageCount > 1000) throw new Error("当前分类题目超过接口可读取范围");
          report({ phase: "listing", processed: 0, total: result.total, created: 0, skipped: 0, failed: 0 });
        }
        if (!pageCount) return result;
        if (!listing.questions.length) throw new Error(`第 ${page} 页未返回题目，已停止导入`);
        const ids = [];
        const categories = {};
        listing.questions.forEach(function (question) {
          if (seen[question.id]) return;
          seen[question.id] = true;
          ids.push(question.id);
          categories[question.id] = categoryId;
        });
        if (!ids.length) throw new Error(`第 ${page} 页题目与之前页面重复，已停止导入`);
        return importQuestions(addon, ids, null, categories, context).then(function (batch) {
          result.createdCount += batch.createdCount;
          result.updatedCount += batch.updatedCount;
          result.skippedCount += batch.skippedCount;
          Array.prototype.push.apply(result.failed, batch.failed);
          report({ phase: "importing", processed: Math.min(page * listing.pageSize, result.total), total: result.total,
            created: result.createdCount, updated: result.updatedCount, skipped: result.skippedCount, failed: result.failed.length });
          page += 1;
          return nextPage();
        });
      });
    }
    return nextPage().catch(function (error) {
      throw new Error(`导入中断：已新建 ${result.createdCount} 道、更新 ${result.updatedCount} 道、跳过 ${result.skippedCount} 道、失败 ${result.failed.length} 道。${error && error.message || error}`);
    });
  }

  return { importedQuestionIds, questionForNote, focusQuestion, importCategory, linkedQuestion, questionMarkdown, prepared408Session, preparedSingleSession };
})();
