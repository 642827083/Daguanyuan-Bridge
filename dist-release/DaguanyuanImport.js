var __DAGUANYUAN_PRACTICE_IMPORT_GLOBAL__ = (function () {
  const ROOT_TITLE = "Daguanyuan Bridge";
  const ROOT_MARKER = "DAGUANYUAN_ROOT:1";
  const CATEGORY_MARKER_PREFIX = "DAGUANYUAN_CATEGORY_ID:";
  const QUESTION_MARKER_PREFIX = "DAGUANYUAN_QUESTION_ID:";
  const URL_MARKER_PREFIX = "DAGUANYUAN_URL:";
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

  function findChildByMarker(parent, marker) {
    return nativeItems(parent && parent.childNotes).find(function (note) {
      return hasMarker(note, marker);
    });
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

  function findLegacyCategory(root, categoryId) {
    const marker = `${CATEGORY_MARKER_PREFIX}${categoryId}`;
    return nativeItems(root && root.childNotes).find(function (note) {
      return String(note.noteTitle || "") === `分类 ${categoryId}` || hasMarker(note, marker);
    });
  }

  function categoryPath(payload) {
    if (payload.provider === "408os") return payload.categoryPath;
    const rootPath = DAGUANYUAN_PRACTICE_ROOT_PATHS[payload.practiceId];
    return rootPath ? rootPath.concat(payload.categoryPath) : payload.categoryPath;
  }

  function findOrCreateCategoryPath(root, payload, context, result) {
    const labels = categoryPath(payload);
    let parent = root;
    for (let index = 0; index < labels.length; index += 1) {
      const title = labels[index];
      let child = findChildByTitle(parent, title);
      const isLeaf = index === labels.length - 1;
      if (!child && isLeaf) {
        const legacy = findLegacyCategory(root, payload.categoryId);
        if (legacy) {
          removeMarkerComments(legacy, `${CATEGORY_MARKER_PREFIX}${payload.categoryId}`);
          legacy.noteTitle = title;
          if (legacy.parentNote && typeof legacy.removeFromParent === "function") legacy.removeFromParent();
          parent.addChild(legacy);
          result.migratedCategoryCount += 1;
          child = legacy;
        }
      }
      if (!child) {
        child = createNote(title, context);
        parent.addChild(child);
      }
      parent = child;
    }
    return parent;
  }

  function questionTitle(question) {
    const source = question.source ? `｜${question.source}` : "";
    return `题目 ${question.questionId}${source}`;
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
    if (question.url && body.indexOf(question.url) < 0) {
      body = `${body ? `${body}\n\n` : ""}<!-- ${URL_MARKER_PREFIX}${question.url} -->`;
    }
    return body;
  }

  function isLegacyQuestionBody(note) {
    return nativeItems(note && note.comments).some(function (comment) {
      const value = String(comment && comment.text || "");
      return value.indexOf("公式：") >= 0 || value.indexOf("题目：") >= 0 ||
        value.indexOf("原题链接：") >= 0 || value.indexOf("[查看原题](") >= 0 ||
        value.indexOf(QUESTION_MARKER_PREFIX) >= 0 || value.indexOf(URL_MARKER_PREFIX) >= 0;
    });
  }

  function replaceLegacyQuestionBody(note, question) {
    const comments = nativeItems(note && note.comments);
    for (let index = comments.length - 1; index >= 0; index -= 1) {
      const value = String(comments[index] && comments[index].text || "");
      if (value.indexOf("公式：") >= 0 || value.indexOf("题目：") >= 0 ||
        value.indexOf("原题链接：") >= 0 || value.indexOf("[查看原题](") >= 0 ||
        value.indexOf(QUESTION_MARKER_PREFIX) >= 0 || value.indexOf(URL_MARKER_PREFIX) >= 0) {
        note.removeCommentByIndex(index);
      }
    }
    note.noteTitle = questionTitle(question);
    note.appendMarkdownComment(questionBody(question));
  }

  function findQuestionById(category, questionId) {
    const marker = `${QUESTION_MARKER_PREFIX}${questionId}`;
    const title = `题目 ${questionId}`;
    return nativeItems(category && category.childNotes).find(function (note) {
      return hasMarker(note, marker) || String(note.noteTitle || "").indexOf(title) === 0;
    });
  }

  function migrateLegacyQuestion(note, question) {
    replaceLegacyQuestionBody(note, question);
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
        url: rawURL || fallbackURL,
      };
    });
    if (!questions.length) throw new Error("当前页面没有可导入题目");
    const categoryPath = (Array.isArray(input.categoryPath) ? input.categoryPath : []).map(function (item) {
      return String(item || "").trim();
    }).filter(Boolean);
    if (!categoryPath.length) throw new Error("未读取到当前三级分类");
    const unavailableQuestionCount = Math.max(0, Math.floor(Number(input.unavailableQuestionCount) || 0));
    return {
      provider,
      practiceId,
      categoryId,
      categoryPath,
      unavailableQuestionCount,
      questions,
    };
  }

  function importCurrentPractice(addon, payload) {
    const context = currentNotebookContext(addon);
    const result = { createdCount: 0, updatedCount: 0, skippedCount: 0, migratedCategoryCount: 0 };
    UndoManager.sharedInstance().undoGrouping("导入大观园练习题", context.topicId, function () {
      const root = findOrCreateRoot(context);
      const category = findOrCreateCategoryPath(root, payload, context, result);
      payload.questions.forEach(function (question) {
        const existing = findQuestionById(category, question.questionId);
        if (existing && hasMarker(existing, `${QUESTION_MARKER_PREFIX}${question.questionId}`)) {
          migrateLegacyQuestion(existing, question);
          result.updatedCount += 1;
          return;
        }
        if (existing && isLegacyQuestionBody(existing)) {
          replaceLegacyQuestionBody(existing, question);
          result.updatedCount += 1;
          return;
        }
        if (existing) {
          result.skippedCount += 1;
          return;
        }
        const note = createNote(questionTitle(question), context);
        note.appendMarkdownComment(questionBody(question));
        category.addChild(note);
        result.createdCount += 1;
      });
    });
    Application.sharedInstance().refreshAfterDBChanged(context.topicId);
    return result;
  }

  return { validatePayload, importCurrentPractice };
})();
