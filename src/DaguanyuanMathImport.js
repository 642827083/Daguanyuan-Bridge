var __DAGUANYUAN_MATH_IMPORT_GLOBAL__ = (function () {
  const ROOT_TITLE = "Daguanyuan Bridge";
  const ROOT_MARKER = "DAGUANYUAN_ROOT:1";

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
    let route = typeof __DAGUANYUAN_SOURCE_LINK_GLOBAL__ !== 'undefined' ? __DAGUANYUAN_SOURCE_LINK_GLOBAL__.fromComment(body) : null;
    const os408 = body.match(/<!--\s*DAGUANYUAN_408_QUESTION_ID:(\d+)\s*-->/);
    if (os408) {
      const id = Number(os408[1]);
      if (route && (route.provider !== '408' || route.questionId !== id)) route = null;
      const sourceYear = String(value(note, "noteTitle") || "").match(/^\s*(\d{4})年\s+第\d+题/);
      return Number.isSafeInteger(id) && id > 0
        ? { id, provider: "408", url: route ? route.url : "", noteId: noteId(note), year: route && route.year || (sourceYear ? Number(sourceYear[1]) : undefined) } : null;
    }
    const idMatch = body.match(/<!--\s*DAGUANYUAN_QUESTION_ID:(\d+)\s*-->/);
    if (!idMatch) return null;
    const id = Number(idMatch[1]);
    if (!Number.isSafeInteger(id) || id < 1) return null;
    if (route && (route.provider !== 'math' || route.questionId !== id)) route = null;
    return { id, url: route ? route.url : "", noteId: noteId(note) };
  }

  function notebookContext(addon) {
    const application = Application.sharedInstance();
    const study = application.studyController(addon && addon.window);
    const notebookController = study && study.notebookController;
    const notebookId = notebookController && value(notebookController, "notebookId");
    const database = Database.sharedInstance();
    const notebook = notebookId && database.getNotebookById(notebookId);
    const topicId = notebook && (value(notebook, "topicId") || value(notebook, "notebookId")) || notebookId;
    if (!notebook || !topicId) {
      throw new Error("请先打开要导入题目的 MarginNote 学习集");
    }
    return { application, study, notebookController, database, notebook, topicId, notebookId: String(notebookId) };
  }

  function targetTitle(context) {
    return String(value(context.notebook, "title") || "").trim()
      || String(value(context.notebook, "name") || "").trim() || "当前学习集";
  }

  function assertCurrentContext(addon, context) {
    const study = context.application.studyController(addon && addon.window);
    if (String(study && value(study.notebookController, "notebookId")) !== context.notebookId) {
      const error = new Error("目标学习集已切换，请重新确认后导入");
      error.stopImport = true;
      throw error;
    }
  }

  function selectQuestions(questions, selection) {
    if (selection === true) return questions.slice();
    if (selection === false) return [];
    if (!Array.isArray(selection) || !selection.length) throw new Error('请至少选择一道题目');
    const allowed = new Set(questions.map(function (q) { return q.id; }));
    const selected = new Set();
    selection.forEach(function (id) {
      if (!Number.isSafeInteger(id) || !allowed.has(id) || selected.has(id)) throw new Error('所选题目不属于本次列表或重复，请重新选择');
      selected.add(id);
    });
    return questions.filter(function (q) { return selected.has(q.id); });
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

  function importedQuestionIds(addon, provider) {
    return Object.keys(indexForContext(notebookContext(addon), provider).byQuestion).map(Number).sort(function (left, right) {
      return left - right;
    });
  }

  function focusQuestion(addon, questionId, provider) {
    const id = __DAGUANYUAN_MATH_API_GLOBAL__.positiveInteger(questionId, "题目 ID");
    return __DAGUANYUAN_CARD_LOCATOR_GLOBAL__.locate(addon, id, provider);
  }

  function createNote(title, context) {
    let note;
    // 题卡属于学习集，不依赖阅读器，也不关联当前打开的文档。
    if (context.database && typeof context.database.createNoteWithTitleTopicid === "function") {
      note = context.database.createNoteWithTitleTopicid(title, context.topicId);
    } else if (typeof Database.createNoteWithTitleTopicid === "function") {
      note = Database.createNoteWithTitleTopicid(title, context.topicId);
    } else {
      throw new Error("当前 MarginNote 版本无法在学习集中创建卡片");
    }
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

  function legacy408Question(context, path, id, ancestors) {
    const candidates = [], seen = new Set();
    (ancestors || []).forEach(function (ancestor) {
      if (!ancestor || !Number.isSafeInteger(ancestor.id) || ancestor.id < 1 || !Array.isArray(ancestor.path)) return;
      const oldPath = ['408'].concat(ancestor.path);
      if (oldPath.length >= path.length || !oldPath.every(function (part, index) { return part === path[index]; })) return;
      const note = findQuestionAtPath(context, oldPath, id, '408');
      if (!note || commentBody(note).indexOf(marker('DAGUANYUAN_SINGLE_IMPORT:1')) >= 0) return;
      const link = linkedQuestion(note), source = link && link.url.match(/[?&]knowledgeId=(\d+)(?:&|$)/);
      // 只复用由对应父分类导入的旧卡，不整理年份卷、单题或其他目录里的同号卡片。
      if (!source || Number(source[1]) !== ancestor.id || seen.has(noteId(note))) return;
      seen.add(noteId(note)); candidates.push(note);
    });
    if (candidates.length > 1) throw new Error('旧父分类下有多张相同题卡，请先整理后重试');
    return candidates[0] || null;
  }

  function moveImportedQuestion(parent, note) {
    const editor = typeof MNNote !== 'undefined' && typeof MNNote.new === 'function' ? MNNote.new(noteId(parent)) : null;
    if (editor && typeof editor.addChild === 'function') editor.addChild(note);
    else if (typeof parent.addChild === 'function') parent.addChild(note);
    else throw new Error('当前 MarginNote 无法调整题卡分类');
    const current = liveNote(note);
    if (!current || noteId(value(current, 'parentNote')) !== noteId(parent)) throw new Error('题卡分类调整未完成');
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

  function questionMarkdown(question) {
    const stem = normalizeQuestionContent(question.stem);
    if (!stem) throw new Error("题目缺少题干");
    const options = (question.options || []).map(function (option, index) {
      if (!option) return "";
      const separator = /^ {0,3}(`{3,}|~{3,})[^\n]*\n/.test(option) ? "\n\n" : " ";
      return normalizeQuestionContent(`${"ABCD"[index]}.${separator}${option}`);
    }).filter(Boolean);
    return [stem].concat(options).join("\n\n");
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
      if (typeof __DAGUANYUAN_DIAGNOSTICS_GLOBAL__ !== 'undefined') __DAGUANYUAN_DIAGNOSTICS_GLOBAL__.error('image.save', error, { questionId: question.id, stage: error.stage });
      throw error;
    }
  }

  function importedComment(note, id, provider, role) { return __DAGUANYUAN_CARD_COMMENTS_GLOBAL__.read(note, id, provider, role); }

  function initializeQuestion(note, question, markdown, suffix, url, provider, role, context) {
    note.appendMarkdownComment(markdown);
    saveQuestionImages(note, question);
    note.appendMarkdownComment(__DAGUANYUAN_CARD_COMMENTS_GLOBAL__.metadata(question, url, provider, role) + suffix);
    if (nativeItems(note.comments).length !== 2) throw new Error('题卡评论保存失败');
    if (context && typeof __DAGUANYUAN_COMMENT_FOLD_GLOBAL__ !== 'undefined') __DAGUANYUAN_COMMENT_FOLD_GLOBAL__.enqueue(context, note);
  }

  function flushCommentFold(context, result) {
    if (typeof __DAGUANYUAN_COMMENT_FOLD_GLOBAL__ !== 'undefined') {
      __DAGUANYUAN_COMMENT_FOLD_GLOBAL__.addWarnings(result, __DAGUANYUAN_COMMENT_FOLD_GLOBAL__.flush(context));
    }
  }

  function answerChild(note, id, provider) {
    const identity = marker((provider === '408' ? 'DAGUANYUAN_408_' : 'DAGUANYUAN_') + 'ANSWER_ID:' + id);
    const matches = nativeItems(note.childNotes).map(liveNote).filter(function (child) {
      return child && noteId(value(child, 'parentNote')) === noteId(note) && commentBody(child).indexOf(identity) >= 0;
    });
    if (matches.length > 1) throw new Error('题目下有多张相同的答案子卡，请先整理后重试');
    return matches[0] || null;
  }

  function answerComments(question) {
    const parts = [];
    [{ key: 'answer', title: '答案' }, { key: 'explanation', title: '解析' }].forEach(function (part) {
      const header = '### ' + part.title + '\n\n';
      const text = normalizeQuestionContent(question[part.key] || '').trim();
      if (text) parts.push(header + text);
    });
    if (!parts.length) throw new Error('网站暂无可读取的答案或解析，请选择仅导入题目');
    return parts;
  }

  function initializeAnswer(note, question, parts, provider) {
    const comments = parts.slice();
    const prefix = provider === '408' ? 'DAGUANYUAN_408_' : 'DAGUANYUAN_';
    // 身份标记随第一条正文保存，不额外生成链接或空白评论。
    comments[0] += '\n\n' + marker(prefix + 'ANSWER_ID:' + question.id);
    comments.forEach(function (body) { note.appendMarkdownComment(body); });
    saveQuestionImages(note, imagePart(question, comments.join('\n\n')));
    if (nativeItems(note.comments).length !== comments.length) throw new Error('答案评论保存失败');
  }

  function imagePart(question, markdown) {
    return Object.assign({}, question, { hasBase64Image: /data:image\/[^\s)]+;base64,/i.test(markdown) });
  }

  function writeQuestionParts(context, note, question, url, provider, content, isNew, suffix) {
    // 已有题目和答案不覆盖；只为缺少答案子卡的题目补建答案。
    const answer = content === 'questionAnswer' ? answerChild(note, question.id, provider) : null;
    if (!isNew && (content !== 'questionAnswer' || answer)) return false;
    if (!isNew) importedComment(note, question.id, provider);
    const answerParts = content === 'questionAnswer' ? answerComments(question) : [];
    if (isNew) {
      const markdown = questionMarkdown(question);
      initializeQuestion(note, imagePart(question, markdown), markdown, suffix || '', url, provider, undefined, context);
    }
    if (answerParts.length) {
      const created = createNote('答案与解析', context);
      try {
        initializeAnswer(created, question, answerParts, provider);
        moveImportedQuestion(note, created);
        // 与疾风劲草一致，新建答案子卡时默认折叠题目分支。
        note.mindmapBranchClose = 1;
      } catch (error) {
        context.database.deleteBookNoteTree(noteId(created));
        throw error;
      }
    }
    return isNew ? true : 'answerAdded';
  }

  function preparedSingleSession(addon, provider, position) {
    if (provider !== "math" && provider !== "408") throw new Error("题目来源无效");
    position = position || "child";
    if (position !== "child" && position !== "sibling") throw new Error("导入本题位置无效");
    const context = notebookContext(addon);
    const selected = value(context.notebookController, "focusNote");
    const selectedId = noteId(selected);
    const notebookId = String(value(context.notebookController, "notebookId"));
    if (!selectedId) throw new Error(position === "child" ? "请先在 MarginNote 中选中一张父卡片" : "请先在 MarginNote 中选中一张卡片");
    if (String(value(selected, "notebookId") || "") !== notebookId) {
      throw new Error("所选卡片不属于当前笔记本");
    }
    const parent = position === "child" ? selected : value(selected, "parentNote");
    const parentId = noteId(parent);
    if (!parentId) throw new Error("所选卡片没有父节点，无法导入为同级节点，请改用子节点");
    function currentParent() {
      const current = context.database.getNoteById(parentId);
      const study = context.application.studyController(addon && addon.window);
      const activeNotebookId = study && value(study.notebookController, "notebookId");
      if (!current || String(value(current, "notebookId")) !== notebookId || String(activeNotebookId) !== notebookId) {
        throw new Error("原父卡片已删除或笔记本已切换，请重新选择后导入");
      }
      if (position === "sibling") {
        const anchor = context.database.getNoteById(selectedId);
        if (!anchor || String(value(anchor, "notebookId")) !== notebookId) throw new Error("原所选卡片已删除或移出笔记本，请重新选择后导入");
        if (noteId(value(anchor, "parentNote")) !== parentId) throw new Error("原所选卡片的父节点已变化，请重新选择后导入");
        const siblings = nativeItems(value(current, "childNotes"));
        const index = siblings.findIndex(function (child) { return noteId(child) === selectedId; });
        if (index < 0) throw new Error("原所选卡片不在同级列表中，请重新选择后导入");
        if (typeof current.addChild !== "function" || (index + 1 < siblings.length && typeof current.insertChildBefore !== "function")) {
          throw new Error("当前 MarginNote 版本不支持在所选卡片之后插入题卡");
        }
      }
      return current;
    }
    currentParent();
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
      targetTitle: targetTitle(context),
      takeCommentFoldWarnings: function () { const warnings = context.commentFoldWarnings || []; context.commentFoldWarnings = []; return warnings; },
      hasQuestion: function (id) { return Boolean(findQuestion(id)); },
      shouldSkip: function (id) { return Boolean(findQuestion(id)); },
      write: function (question, category) {
        const id = __DAGUANYUAN_MATH_API_GLOBAL__.positiveInteger(question && question.id, "题目 ID");
        const existing = findQuestion(id);
        if (existing) return false;
        if (provider === "408" && (!category || !/^https:\/\/www\.408os\.cn\/exercise\?/.test(category.url))) throw new Error("408 题目页面信息无效");
        const url = provider === "408" ? `${category.url}&questionId=${id}`
          : category && /^https:\/\/(?:www\.)?cxyonly\.fans\/math\/practice\/(?:categories\/)?\d+\/?$/.test(category.url)
            ? `${category.url}?questionId=${id}` : questionURL(question.categoryId, id);
        const markdown = questionMarkdown(question);
        let note;
        UndoManager.sharedInstance().undoGrouping("导入本题", context.topicId, function () {
          try {
            const selectedParent = currentParent();
            note = createNote(titleFor(question), context);
            initializeQuestion(note, question, markdown, "\n\n" + marker("DAGUANYUAN_SINGLE_IMPORT:1"), url, provider, undefined, context);
            if (position === "sibling") {
              const siblings = nativeItems(value(selectedParent, "childNotes"));
              const index = siblings.findIndex(function (child) { return noteId(child) === selectedId; });
              const next = siblings[index + 1];
              if (next) selectedParent.insertChildBefore(note, next);
              else selectedParent.addChild(note);
              const updated = nativeItems(value(selectedParent, "childNotes"));
              if (noteId(value(note, "parentNote")) !== parentId || noteId(updated[index + 1]) !== noteId(note)) {
                throw new Error("题卡未能插入所选卡片之后，请重试");
              }
            } else selectedParent.addChild(note);
          } catch (error) {
            if (note && noteId(note)) context.database.deleteBookNoteTree(noteId(note));
            throw error;
          }
        });
        context.application.refreshAfterDBChanged(context.topicId);
        flushCommentFold(context, context);
        return true;
      },
    };
  }

  function prepared408Session(addon) {
    const context = notebookContext(addon);
    return {
      targetTitle: targetTitle(context),
      takeCommentFoldWarnings: function () { const warnings = context.commentFoldWarnings || []; context.commentFoldWarnings = []; return warnings; },
      check: function () { assertCurrentContext(addon, context); },
      hasQuestion: function (id, category) { return hasQuestionAtPath(context, pathFor408(category), id, "408"); },
      shouldSkip: function (id, category, content) {
        assertCurrentContext(addon, context);
        const path = pathFor408(category), existing = findQuestionAtPath(context, path, id, '408');
        if (!existing) return false;
        return content !== 'questionAnswer' || Boolean(answerChild(existing, id, '408'));
      },
      write: function (question, category, content, legacyCategories) {
        assertCurrentContext(addon, context);
        const id = __DAGUANYUAN_MATH_API_GLOBAL__.positiveInteger(question && question.id, "题目 ID");
        const categoryPath = pathFor408(category);
        const existing = findQuestionAtPath(context, categoryPath, id, "408");
        const legacy = existing ? null : legacy408Question(context, categoryPath, id, legacyCategories);
        const url = `${category.url}&questionId=${id}`;
        if (existing && (content !== 'questionAnswer' || answerChild(existing, id, '408'))) return false;
        if (!existing && !legacy) questionMarkdown(question);
        if (!existing && !legacy && content === 'questionAnswer') answerComments(question);
        let note;
        let outcome = true;
        UndoManager.sharedInstance().undoGrouping("导入 408 题目", context.topicId, function () {
          if (existing) { outcome = writeQuestionParts(context, existing, question, url, '408', content, false); return; }
          if (legacy) {
            const originalParent = value(legacy, 'parentNote');
            const parent = findOrCreatePath(findRoot(context), categoryPath, context);
            try {
              moveImportedQuestion(parent, legacy);
              outcome = writeQuestionParts(context, legacy, question, url, '408', content, false);
            } catch (error) {
              try { moveImportedQuestion(originalParent, legacy); }
              catch (restoreError) { error.message += '；恢复原分类失败，请撤销本次操作：' + String(restoreError.message || restoreError); error.stopImport = true; }
              throw error;
            }
            return;
          }
          try {
            const parent = findOrCreatePath(findRoot(context), categoryPath, context);
            note = createNote(titleFor(question), context);
            writeQuestionParts(context, note, question, url, '408', content, true);
            parent.addChild(note);
          } catch (error) {
            if (note && noteId(note)) context.database.deleteBookNoteTree(noteId(note));
            throw error;
          }
        });
        context.application.refreshAfterDBChanged(context.topicId);
        flushCommentFold(context, context);
        return outcome;
      },
    };
  }

  function importQuestions(addon, rawIds, onProgress, categoryIdsByQuestion, existingContext, check, content) {
    const ids = normalizeIds(rawIds);
    const context = existingContext || notebookContext(addon);
    const readImage = typeof __DAGUANYUAN_MATH_IMAGES_GLOBAL__ !== 'undefined' ? __DAGUANYUAN_MATH_IMAGES_GLOBAL__.reader(addon.panelController, check) : undefined;
    const result = { createdCount: 0, answerAddedCount: 0, skippedCount: 0, failed: [] };
    // 列表已给出分类时先查重，已有题卡无需再次请求题干、答案或图片。
    const pending = ids.filter(function (id) {
      try {
        assertCurrentContext(addon, context);
        const categoryId = categoryIdsByQuestion && categoryIdsByQuestion[id];
        if (!categoryId) return true;
        const route = __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.resultForCategoryId(categoryId);
        if (route.status !== 'resolved') return true;
        const existing = findQuestionAtPath(context, route.path, id, 'math');
        if (existing && (content !== 'questionAnswer' || answerChild(existing, id, 'math'))) {
          result.skippedCount += 1; return false;
        }
        return true;
      } catch (error) {
        if (error.stopImport) throw error;
        result.failed.push({ questionId: id, reason: String(error.message || error) }); return false;
      }
    });
    const report = typeof onProgress === "function" ? onProgress : function () {};
    const readyById = {};
    const checkedCount = ids.length - pending.length;
    let fetched = 0;
    let stoppedError;
    function checkRequest() {
      if (stoppedError) throw stoppedError;
      if (check) check();
    }
    function fetchWave(offset) {
      if (check) check();
      if (offset >= pending.length) return Promise.resolve();
      return Promise.all(pending.slice(offset, offset + 3).map(function (id) {
        return __DAGUANYUAN_MATH_API_GLOBAL__.questionDetail(id, content, readImage, checkRequest).then(function (question) {
          readyById[id] = question;
        }).catch(function (error) {
          if (error.stopImport) { stoppedError = error; throw error; }
          result.failed.push({ questionId: id, reason: String(error && error.message || error) });
        }).then(function () {
          fetched += 1;
          report({ phase: "fetching", processed: checkedCount + fetched, total: ids.length, created: 0, skipped: result.skippedCount, failed: result.failed.length });
        });
      })).then(function () { return fetchWave(offset + 3); });
    }
    report({ phase: "fetching", processed: checkedCount, total: ids.length, created: 0, skipped: result.skippedCount, failed: result.failed.length });
    return fetchWave(0).then(function () {
      if (check) check();
      const ready = pending.map(function (id) { return readyById[id]; }).filter(Boolean);
      let written = 0;
      let root;
      for (let offset = 0; offset < ready.length; offset += 10) {
        if (check) check();
        assertCurrentContext(addon, context);
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
              const existing = findQuestionAtPath(context, route.path, question.id, "math");
              if (!existing) questionMarkdown(question);
              if (!existing && content === 'questionAnswer') answerComments(question);
              if (existing) {
                if (writeQuestionParts(context, existing, question, url, 'math', content, false) === 'answerAdded') result.answerAddedCount += 1;
                else result.skippedCount += 1;
                return;
              }
              if (!root) root = findRoot(context);
              const parent = findOrCreatePath(root, route.path, context);
              note = createNote(titleFor(question), context);
              writeQuestionParts(context, note, question, url, 'math', content, true);
              parent.addChild(note);
              result.createdCount += 1;
            } catch (error) {
              if (note && noteId(note)) context.database.deleteBookNoteTree(noteId(note));
              result.failed.push({ questionId: question.id, source: titleFor(question), stage: error.stage || "MarginNote 建卡",
                diagnostics: error.diagnostics, reason: String(error && error.message || error) });
            }
            written += 1;
            report({ phase: "writing", processed: written, total: ready.length, created: result.createdCount,
              answerAdded: result.answerAddedCount, skipped: result.skippedCount, failed: result.failed.length });
          });
        });
        context.application.refreshAfterDBChanged(context.topicId);
        flushCommentFold(context, result);
      }
      return result;
    }).catch(function (error) {
      error.importResult = result;
      throw error;
    });
  }

  function importCategory(addon, rawCategoryId, rawScope, onProgress, beforeImport) {
    const categoryId = __DAGUANYUAN_MATH_API_GLOBAL__.positiveInteger(rawCategoryId, "分类 ID");
    const scope = __DAGUANYUAN_MATH_API_GLOBAL__.questionScope(rawScope);
    const route = __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.resultForCategoryId(categoryId);
    if (route.status !== "resolved") throw new Error("当前分类不在本地分类数据中，请先更新分类数据");
    const context = notebookContext(addon);
    const report = typeof onProgress === "function" ? onProgress : function () {};
    const result = { categoryId, categoryPath: route.path, scope, total: 0, createdCount: 0, answerAddedCount: 0, skippedCount: 0, failed: [] };
    const seen = {};
    let questions = [];
    let page = 1;
    let pageCount = 0;
    function nextPage() {
      if (beforeImport && beforeImport.check) beforeImport.check();
      if (pageCount && page > pageCount) return Promise.resolve();
      return __DAGUANYUAN_MATH_API_GLOBAL__.questionPage(categoryId, page, scope).then(function (listing) {
        if (page === 1) {
          result.total = listing.total;
          pageCount = Math.ceil(listing.total / listing.pageSize);
          if (pageCount > 1000) throw new Error("当前分类题目超过接口可读取范围");
          report({ phase: "listing", processed: 0, total: result.total, created: 0, skipped: 0, failed: 0 });
        }
        if (!pageCount) return result;
        if (!listing.questions.length) throw new Error(`第 ${page} 页未返回题目，已停止导入`);
        const countBefore = questions.length;
        listing.questions.forEach(function (question) {
          if (seen[question.id]) return;
          seen[question.id] = true;
          questions.push(question);
        });
        if (questions.length === countBefore) throw new Error(`第 ${page} 页题目与之前页面重复，已停止导入`);
        page += 1;
        return nextPage();
      });
    }
    return nextPage().then(function () {
      if (questions.length !== result.total) throw new Error("分类题目数量已变化，请刷新后重新导入");
      if (!result.total) return false;
      assertCurrentContext(addon, context);
      return typeof beforeImport === "function" ? beforeImport({
        source: "大观园数学 / " + route.path.join(" / ") + " / " + { complete: "完整", core: "严选", exam: "真题" }[scope],
        target: targetTitle(context),
        questions: questions.map(function (question) { return { id: question.id, title: question.source || "题目 " + question.id, summary: question.stem || "" }; }),
      }) : true;
    }).then(function (accepted) {
      if (accepted === false) { result.cancelled = result.total > 0; return result; }
      questions = selectQuestions(questions, accepted);
      result.total = questions.length;
      if (beforeImport && beforeImport.check) beforeImport.check();
      assertCurrentContext(addon, context);
      function writePage(offset) {
        if (offset >= questions.length) return Promise.resolve(result);
        const ids = questions.slice(offset, offset + 20).map(function (question) { return question.id; });
        const categories = {};
        ids.forEach(function (id) { categories[id] = categoryId; });
        return importQuestions(addon, ids, function (progress) {
          if (progress.phase !== "fetching") return;
          report({ phase: "fetching", processed: offset + progress.processed, total: result.total,
            created: result.createdCount, answerAdded: result.answerAddedCount, skipped: result.skippedCount, failed: result.failed.length + progress.failed });
        }, categories, context, beforeImport && beforeImport.check, beforeImport && beforeImport.content).then(function (batch) {
          result.createdCount += batch.createdCount;
          result.answerAddedCount += batch.answerAddedCount;
          result.skippedCount += batch.skippedCount;
          Array.prototype.push.apply(result.failed, batch.failed);
          if (batch.commentFoldWarnings) result.commentFoldWarnings = (result.commentFoldWarnings || []).concat(batch.commentFoldWarnings);
          report({ phase: "importing", processed: Math.min(offset + ids.length, result.total), total: result.total,
            created: result.createdCount, answerAdded: result.answerAddedCount, skipped: result.skippedCount, failed: result.failed.length });
          return writePage(offset + ids.length);
        });
      }
      return writePage(0);
    }).catch(function (error) {
      const failure = new Error(`导入中断：已新建 ${result.createdCount} 道、补答案 ${result.answerAddedCount} 道、跳过 ${result.skippedCount} 道、失败 ${result.failed.length} 道。${error && error.message || error}`);
      failure.importResult = result;
      throw failure;
    });
  }

  function preparedMathSession(addon) {
    const context = notebookContext(addon);
    requireImportUtils();
    return {
      targetTitle: targetTitle(context),
      check: function () { assertCurrentContext(addon, context); },
      importQuestions: function (ids, categories, content, onProgress, check) {
        return importQuestions(addon, ids, onProgress, categories, context, check, content);
      },
    };
  }

  return { importedQuestionIds, focusQuestion, importCategory, linkedQuestion, questionMarkdown, prepared408Session, preparedSingleSession, preparedMathSession, selectQuestions };
})();
