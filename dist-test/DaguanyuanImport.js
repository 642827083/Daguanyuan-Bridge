var __DAGUANYUAN_PRACTICE_IMPORT_GLOBAL__ = (function () {
  const ROOT_TITLE = "Daguanyuan Bridge";
  const ROOT_MARKER = "DAGUANYUAN_ROOT:1";
  const QUESTION_MARKER_PREFIX = "DAGUANYUAN_QUESTION_ID:";
  const URL_MARKER_PREFIX = "DAGUANYUAN_URL:";
  const HTML_COMMENT_TAG_PREFIX = "daguanyuan-question:v1|";
  const DAGUANYUAN_PRACTICE_ROOT_PATHS = {
    "321": ["高等数学", "（一）极限"],
    "329": ["高等数学", "（一）极限"],
    "322": ["高等数学", "（二）一元微分"],
    "224": ["高等数学", "（三）一元积分"],
    "325": ["高等数学", "（四）微分方程"],
    "324": ["高等数学", "（五）多元微分"],
    "326": ["高等数学", "（六）二重积分"],
    "2": ["线性代数", "（一）行列式"],
    "3": ["线性代数", "（二）矩阵"],
    "4": ["线性代数", "（三）向量"],
    "5": ["线性代数", "（四）线性方程组"],
    "6": ["线性代数", "（五）特征值与特征向量"],
    "7": ["线性代数", "（六）二次型"],
    "855": ["历年真题", "（一）数二"],
    "2502": ["模拟哥专区", "（一）数二"],
  };

  function nativeItems(list) {
    if (!list) return [];
    const rawCount = typeof list.count === "function" ? list.count() : list.length;
    const count = Number(rawCount);
    if (!Number.isFinite(count) || count < 1) return [];
    const result = [];
    for (let index = 0; index < count; index += 1) {
      result.push(typeof list.objectAtIndex === "function" ? list.objectAtIndex(index) : list[index]);
    }
    return result;
  }

  function noteText(note) {
    if (!note) return "";
    const title = note.noteTitle || "";
    const text = typeof note.allNoteText === "function" ? note.allNoteText() : note.notesText || "";
    return `${title}\n${text}`;
  }

  function hasMarker(note, marker) {
    return noteText(note).indexOf(marker) >= 0;
  }

  function removeMarkerComments(note, marker) {
    const comments = nativeItems(note && note.comments);
    for (let index = comments.length - 1; index >= 0; index -= 1) {
      const comment = comments[index];
      if (comment && String(comment.text || "").indexOf(marker) >= 0) {
        note.removeCommentByIndex(index);
      }
    }
  }

  function findChildByTitle(parent, title) {
    return nativeItems(parent && parent.childNotes).find(function (note) {
      return String(note.noteTitle || "") === title;
    });
  }

  function currentNotebookContext(addon) {
    const window = addon && addon.window;
    const studyController = Application.sharedInstance().studyController(window);
    const notebookController = studyController && studyController.notebookController;
    const documentController = studyController && studyController.readerController &&
      studyController.readerController.currentDocumentController;
    const notebookId = notebookController && notebookController.notebookId;
    const notebook = notebookId
      ? Database.sharedInstance().getNotebookById(notebookId)
      : undefined;
    const document = documentController && documentController.document;
    const topicId = notebook && notebook.topicId;
    if (!notebook || !document || !topicId) {
      throw new Error("请先打开一个包含当前文档的 MarginNote 笔记本");
    }
    return { notebook, document, topicId };
  }

  function createNote(title, context) {
    const note = Note.createWithTitleNotebookDocument(title, context.notebook, context.document);
    if (!note) throw new Error("MarginNote 未能创建题目卡片");
    return note;
  }

  function findOrCreateRoot(context) {
    const allNotes = nativeItems(context.notebook.notes || context.notebook.childNotes);
    const found = allNotes.find(function (note) {
      return note.noteTitle === ROOT_TITLE || hasMarker(note, ROOT_MARKER);
    });
    if (found) {
      removeMarkerComments(found, ROOT_MARKER);
      return found;
    }
    const root = createNote(ROOT_TITLE, context);
    return root;
  }

  function categoryPath(payload) {
    if (payload.provider === "408os") return payload.categoryPath;
    const rootPath = DAGUANYUAN_PRACTICE_ROOT_PATHS[payload.practiceId] || [];
    if (!rootPath.length) return payload.categoryPath;
    // 网站分类列表从章节下一级开始，分类名“极限”是合法层级，不能按章节别名删除。
    const incomingPath = Array.isArray(payload.categoryPath) ? payload.categoryPath : [];
    const chapterTitle = String(rootPath[rootPath.length - 1] || "");
    const relativePath = incomingPath[0] === chapterTitle ? incomingPath.slice(1) : incomingPath;
    const alreadyComplete = rootPath.every(function (title, index) {
      return relativePath[index] === title;
    });
    return alreadyComplete ? relativePath : rootPath.concat(relativePath);
  }

  function findOrCreateCategoryPath(root, payload, context) {
    const labels = categoryPath(payload);
    let parent = root;
    for (let index = 0; index < labels.length; index += 1) {
      const title = labels[index];
      let child = findChildByTitle(parent, title);
      if (!child) {
        child = createNote(title, context);
        parent.addChild(child);
      }
      parent = child;
    }
    return parent;
  }

  function questionTitle(question) {
    return String(question && question.source || "").trim();
  }

  function practiceQuestionURL(pageURL, questionId) {
    const href = String(pageURL || "");
    if (!href || !questionId) return "";
    const hashIndex = href.indexOf("#");
    const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
    const base = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
    const queryIndex = base.indexOf("?");
    const path = queryIndex >= 0 ? base.slice(0, queryIndex) : base;
    const query = queryIndex >= 0 ? base.slice(queryIndex + 1) : "";
    const parts = query ? query.split("&").filter(function (part) {
      let name = String(part || "").split("=")[0].replace(/\+/g, " ");
      try { name = decodeURIComponent(name); } catch (error) { return name !== "questionId"; }
      return name !== "questionId";
    }) : [];
    parts.push(`questionId=${encodeURIComponent(String(questionId))}`);
    return `${path}?${parts.join("&")}${hash}`;
  }

  function questionBody(question) {
    let body = question.markdown;
    if (!body) {
      const lines = [];
      if (question.stemText) lines.push(question.stemText);
      if (question.tex) lines.push(`$$\n${question.tex}\n$$`);
      body = lines.join("\n\n");
    }
    body = body.replace(/(\$\$[\s\S]*?\$\$)(?!\s*<br>)/g, "$1\n<br>");
    const questionMarker = `<!-- ${QUESTION_MARKER_PREFIX}${question.questionId} -->`;
    if (body.indexOf(questionMarker) < 0) {
      body = `${body ? `${body}\n\n` : ""}${questionMarker}`;
    }
    if (question.url && body.indexOf(question.url) < 0) {
      body = `${body}\n<!-- ${URL_MARKER_PREFIX}${question.url} -->`;
    }
    return body;
  }

  function questionHTMLSize(question) {
    const input = question && question.htmlSize || {};
    const width = Math.floor(Number(input.width) || 0);
    const height = Math.floor(Number(input.height) || 0);
    return {
      width: Math.max(720, Math.min(1200, width || 960)),
      height: Math.max(160, Math.min(3000, height || 320)),
    };
  }

  function isCurrentHTMLQuestionComment(comment) {
    const tag = String(comment && comment.tag || "");
    return tag.indexOf(HTML_COMMENT_TAG_PREFIX) === 0;
  }

  function htmlQuestionId(comment) {
    const tag = String(comment && comment.tag || "");
    const current = tag.match(/^daguanyuan-question:v1\|(?:daguanyuan|408os)\|(\d+)\|/);
    return current ? current[1] : "";
  }

  function htmlQuestionTag(question, payload) {
    const pageURL = String(question && question.url || "").trim();
    const path = categoryPath(payload).join(" > ");
    return `${HTML_COMMENT_TAG_PREFIX}${payload.provider}|${question.questionId}|${encodeURIComponent(pageURL)}|${encodeURIComponent(path)}`;
  }

  function appendQuestionContent(note, question, payload) {
    if (payload.provider === "408os" && question.html && typeof note.appendHtmlComment === "function") {
      note.appendHtmlComment(
        question.html,
        payload.provider === "daguanyuan" ? questionBody(question) : String(question.markdown || question.source || ""),
        questionHTMLSize(question),
        htmlQuestionTag(question, payload),
      );
      return "html";
    }
    note.appendMarkdownComment(questionBody(question));
    return "markdown";
  }

  function recordHTMLTagProbe(result, note, question, payload) {
    if (!question || payload.provider !== "408os" || !question.html) return;
    const tag = htmlQuestionTag(question, payload);
    const readable = nativeItems(note && note.comments).some(function (comment) {
      return String(comment && comment.tag || "") === tag;
    });
    if (readable) {
      result.htmlTagReadableCount += 1;
      result.metadataReadableCount += 1;
    } else {
      result.htmlTagUnreadableCount += 1;
      result.metadataUnreadableCount += 1;
    }
  }

  function replaceQuestionBody(note, question, payload) {
    const comments = nativeItems(note && note.comments);
    for (let index = comments.length - 1; index >= 0; index -= 1) {
      const comment = comments[index];
      const value = String(comment && comment.text || "");
      if (isCurrentHTMLQuestionComment(comment) || value.indexOf(QUESTION_MARKER_PREFIX) >= 0 || value.indexOf(URL_MARKER_PREFIX) >= 0) {
        note.removeCommentByIndex(index);
      }
    }
    note.noteTitle = questionTitle(question);
    appendQuestionContent(note, question, payload);
  }

  function findQuestionById(category, questionId) {
    const marker = `${QUESTION_MARKER_PREFIX}${questionId}`;
    return nativeItems(category && category.childNotes).find(function (note) {
      return hasMarker(note, marker) || nativeItems(note && note.comments).some(function (comment) {
        return htmlQuestionId(comment) === String(questionId);
      });
    });
  }

  function normalizedPath(input) {
    return (Array.isArray(input) ? input : []).map(function (item) {
      return String(item || "").trim();
    }).filter(Boolean);
  }

  function normalizedRenderState(input) {
    const value = input && typeof input === "object" ? input : {};
    return {
      expectedQuestionCount: Math.max(0, Math.floor(Number(value.expectedQuestionCount) || 0)),
      completeQuestionCount: Math.max(0, Math.floor(Number(value.completeQuestionCount) || 0)),
      pendingImageCount: Math.max(0, Math.floor(Number(value.pendingImageCount) || 0)),
      brokenImageCount: Math.max(0, Math.floor(Number(value.brokenImageCount) || 0)),
      pendingFormulaCount: Math.max(0, Math.floor(Number(value.pendingFormulaCount) || 0)),
    };
  }

  function validatePayload(payload) {
    const input = payload && typeof payload === "object" ? payload : {};
    const provider = String(input.provider || "daguanyuan").trim();
    const practiceId = String(input.practiceId || "").trim();
    const categoryId = String(input.categoryId || "").trim();
    if (provider !== "daguanyuan" && provider !== "408os") {
      throw new Error("不支持的题库来源");
    }
    if (!/^\d+$/.test(categoryId) || (provider === "daguanyuan" && !/^\d+$/.test(practiceId))) {
      throw new Error("当前页面不是可导入的练习分类");
    }
    const source = Array.isArray(input.questions) ? input.questions : [];
    const pageURL = String(input.url || "").trim();
    const seen = {};
    const questions = source.map(function (item) {
      const questionId = String(item && item.questionId || "").trim();
      if (!/^\d+$/.test(questionId) || seen[questionId]) {
        throw new Error("题目 ID 无效或重复");
      }
      seen[questionId] = true;
      const rawURL = String(item && item.url || "").trim();
      const fallbackURL = provider === "daguanyuan"
        ? (pageURL ? practiceQuestionURL(pageURL, questionId) : `https://cxyonly.fans/math/questions/${questionId}`)
        : "";
      return {
        questionId,
        source: String(item.source || "").trim(),
        stemText: String(item.stemText || "").trim(),
        tex: String(item.tex || "").trim(),
        markdown: String(item.markdown || "").trim(),
        html: String(item.html || "").trim(),
        htmlSize: item && item.htmlSize && typeof item.htmlSize === "object" ? item.htmlSize : {},
        url: rawURL || fallbackURL,
      };
    });
    if (!questions.length) throw new Error("当前页面没有可导入题目");
    const categoryPath = normalizedPath(input.categoryPath);
    if (!categoryPath.length) throw new Error("未读取到当前三级分类");
    const fullCategoryPath = normalizedPath(input.fullCategoryPath);
    const unavailableQuestionCount = Math.max(0, Math.floor(Number(input.unavailableQuestionCount) || 0));
    return {
      provider,
      practiceId,
      categoryId,
      categoryPath,
      fullCategoryPath,
      unavailableQuestionCount,
      renderState: normalizedRenderState(input.renderState),
      url: pageURL,
      questions,
    };
  }

  function importCurrentPractice(addon, payload) {
    const context = currentNotebookContext(addon);
    const result = {
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      htmlTagReadableCount: 0,
      htmlTagUnreadableCount: 0,
      metadataReadableCount: 0,
      metadataUnreadableCount: 0,
      mappedCount: 0,
      categoryPath: categoryPath(payload),
    };
    const mappingEntries = [];
    UndoManager.sharedInstance().undoGrouping("导入大观园练习题", context.topicId, function () {
      const root = findOrCreateRoot(context);
      const category = findOrCreateCategoryPath(root, payload, context);
      payload.questions.forEach(function (question) {
        const existing = findQuestionById(category, question.questionId);
        if (existing && (hasMarker(existing, `${QUESTION_MARKER_PREFIX}${question.questionId}`) ||
          nativeItems(existing.comments).some(function (comment) { return htmlQuestionId(comment) === question.questionId; }))) {
          replaceQuestionBody(existing, question, payload);
          recordHTMLTagProbe(result, existing, question, payload);
          mappingEntries.push({ note: existing, question });
          result.updatedCount += 1;
          return;
        }
        if (existing) {
          result.skippedCount += 1;
          return;
        }
        const note = createNote(questionTitle(question), context);
        appendQuestionContent(note, question, payload);
        category.addChild(note);
        recordHTMLTagProbe(result, note, question, payload);
        mappingEntries.push({ note, question });
        result.createdCount += 1;
      });
    });
    if (typeof __DAGUANYUAN_STORAGE_GLOBAL__ !== "undefined") {
      result.mappedCount = __DAGUANYUAN_STORAGE_GLOBAL__.saveQuestionMappings(mappingEntries.map(function (entry) {
        const noteId = entry.note && (typeof entry.note.noteId === "function" ? entry.note.noteId() : entry.note.noteId);
        return {
          noteId: String(noteId || ""),
          provider: payload.provider,
          questionId: entry.question.questionId,
          url: entry.question.url,
          categoryPath: categoryPath(payload),
          notebookId: String(context.notebook && (context.notebook.topicId || context.notebook.notebookId) || ""),
          updatedAt: new Date().toISOString(),
        };
      }));
    }
    Application.sharedInstance().refreshAfterDBChanged(context.topicId);
    return result;
  }

  return { validatePayload, importCurrentPractice };
})();
