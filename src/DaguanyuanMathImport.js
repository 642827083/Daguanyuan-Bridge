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
      return Number.isSafeInteger(id) && id > 0
        ? { id, provider: "408", url: address ? address[1] : "", noteId: noteId(note) } : null;
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
    if (link.provider === "408") return link;
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

  function focusQuestion(addon, questionId) {
    const id = __DAGUANYUAN_MATH_API_GLOBAL__.positiveInteger(questionId, "题目 ID");
    const context = notebookContext(addon, false);
    const note = indexForContext(context).byQuestion[id];
    if (!note) throw new Error("当前笔记本中没有这道题的脑图卡片");
    context.notebookController.changeFocusToNote(note);
    return { questionId: id, noteId: noteId(note) };
  }

  function createNote(title, context) {
    const note = Note.createWithTitleNotebookDocument(title, context.notebook, context.document);
    if (!note) throw new Error("MarginNote 未能创建脑图卡片");
    return note;
  }

  function findRoot(context) {
    const roots = nativeItems(context.notebook.notes || context.notebook.childNotes);
    const existing = roots.find(function (note) { return commentBody(note).indexOf(ROOT_MARKER) >= 0; })
      || roots.find(function (note) { return String(value(note, "noteTitle") || "") === ROOT_TITLE; });
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
      let child = nativeItems(parent.childNotes).find(function (item) {
        return String(value(item, "noteTitle") || "") === title;
      });
      if (!child) {
        child = createNote(title, context);
        parent.addChild(child);
      }
      parent = child;
    });
    return parent;
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

  function questionMarkdown(question, url, provider) {
    const stem = normalizeDisplayMath(normalizeInlineMath(question.stem));
    if (!stem) throw new Error("题目缺少题干");
    const options = (question.options || []).map(function (option, index) {
      return option ? normalizeDisplayMath(`${"ABCD"[index]}. ${normalizeInlineMath(option)}`) : "";
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

  function prepared408Session(addon) {
    const context = notebookContext(addon, true);
    const index = indexForContext(context, "408");
    return {
      hasQuestion: function (id) { return Boolean(index.byQuestion[id]); },
      write: function (question, category) {
        const id = __DAGUANYUAN_MATH_API_GLOBAL__.positiveInteger(question && question.id, "题目 ID");
        if (index.byQuestion[id]) return false;
        if (!category || !category.title || !/^https:\/\/www\.408os\.cn\/exercise\?/.test(category.url)) {
          throw new Error("408 分类信息无效");
        }
        const url = `${category.url}&questionId=${id}`;
        let note;
        UndoManager.sharedInstance().undoGrouping("导入 408 题目", context.topicId, function () {
          try {
            const markdown = questionMarkdown(question, url, "408");
            const parent = findOrCreatePath(findRoot(context), ["408", category.title], context);
            note = createNote(titleFor(question), context);
            note.appendMarkdownComment(markdown);
            parent.addChild(note);
            saveQuestionImages(note, question);
            index.byQuestion[id] = note;
          } catch (error) {
            if (note && noteId(note)) context.database.deleteBookNoteTree(noteId(note));
            throw error;
          }
        });
        context.application.refreshAfterDBChanged(context.topicId);
        return true;
      },
    };
  }

  function importQuestions(addon, rawIds, onProgress, categoryIdsByQuestion, existingContext, existingIndex) {
    const ids = normalizeIds(rawIds);
    const context = existingContext || notebookContext(addon, true);
    const index = existingIndex || indexForContext(context);
    const result = { createdCount: 0, skippedCount: 0, failed: [] };
    const pending = ids.filter(function (id) {
      if (!index.byQuestion[id]) return true;
      result.skippedCount += 1;
      return false;
    });
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
              if (!root) root = findRoot(context);
              const parent = findOrCreatePath(root, route.path, context);
              note = createNote(titleFor(question), context);
              note.appendMarkdownComment(questionMarkdown(question, url));
              parent.addChild(note);
              saveQuestionImages(note, question);
              index.byQuestion[question.id] = note;
              result.createdCount += 1;
            } catch (error) {
              if (note && noteId(note)) context.database.deleteBookNoteTree(noteId(note));
              result.failed.push({ questionId: question.id, source: titleFor(question), stage: error.stage || "MarginNote 建卡",
                diagnostics: error.diagnostics, reason: String(error && error.message || error) });
            }
            written += 1;
            report({ phase: "writing", processed: written, total: ready.length, created: result.createdCount,
              skipped: result.skippedCount, failed: result.failed.length });
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
    const index = indexForContext(context);
    const report = typeof onProgress === "function" ? onProgress : function () {};
    const result = { categoryId, categoryPath: route.path, scope, total: 0, createdCount: 0, skippedCount: 0, failed: [] };
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
        return importQuestions(addon, ids, null, categories, context, index).then(function (batch) {
          result.createdCount += batch.createdCount;
          result.skippedCount += batch.skippedCount;
          Array.prototype.push.apply(result.failed, batch.failed);
          report({ phase: "importing", processed: Math.min(page * listing.pageSize, result.total), total: result.total,
            created: result.createdCount, skipped: result.skippedCount, failed: result.failed.length });
          page += 1;
          return nextPage();
        });
      });
    }
    return nextPage().catch(function (error) {
      throw new Error(`导入中断：已新建 ${result.createdCount} 道、跳过 ${result.skippedCount} 道、失败 ${result.failed.length} 道。${error && error.message || error}`);
    });
  }

  return { importedQuestionIds, questionForNote, focusQuestion, importCategory, linkedQuestion, questionMarkdown, prepared408Session };
})();
