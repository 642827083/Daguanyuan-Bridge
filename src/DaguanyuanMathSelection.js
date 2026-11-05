var __DAGUANYUAN_MATH_SELECTION_GLOBAL__ = (function () {
  function importQuestions(addon, page, progress, confirmation, categoryOnly) {
    if (!page || page.provider !== 'math' || !/^https:\/\/(?:www\.)?cxyonly\.fans\//.test(page.url || '')
      || !Array.isArray(page.questions) || (!categoryOnly && !page.questions.length) || page.questions.length > 10000) throw new Error('当前页面题目列表无效，请重新打开选题导入');
    const seen = new Set();
    let questions = page.questions.map(function (question) {
      if (!question || !Number.isSafeInteger(question.id) || question.id < 1 || seen.has(question.id)) throw new Error('当前页面题目编号无效');
      seen.add(question.id);
      return { id: question.id, title: String(question.title || '题目 ' + question.id).slice(0, 200), summary: String(question.summary || '').slice(0, 180) };
    });
    const session = __DAGUANYUAN_MATH_IMPORT_GLOBAL__.preparedMathSession(addon);
    const context = page.importContext;
    const fullCategory = Boolean(context && (context.categoryId || context.conceptId));
    const result = { total: questions.length, createdCount: 0, answerAddedCount: 0, skippedCount: 0, failed: [] };
    function check() { if (confirmation.check) confirmation.check(); session.check(); }
    function readCategory() {
      const loaded = [], seenIds = new Set(); let total = -1;
      function next(pageNumber) {
        check();
        return __DAGUANYUAN_MATH_API_GLOBAL__.practiceQuestionPage(context, pageNumber, addon.panelController, check).then(function (listing) {
          check();
          if (total < 0) total = listing.total;
          if (total !== listing.total || Math.ceil(total / listing.pageSize) > 1000) throw new Error('题目数量已变化或超出可读取范围，请刷新');
          listing.questions.forEach(function (q) {
            if (!Number.isSafeInteger(q.id) || q.id < 1 || seenIds.has(q.id)) throw new Error('题目分页重复或编号无效，请刷新');
            seenIds.add(q.id); loaded.push({ id: q.id, title: q.source || '题目 ' + q.id, summary: q.stem || '' });
          });
          if (loaded.length > total || loaded.length < total && !listing.questions.length) throw new Error('题目分页提前结束，请刷新后重试');
          if (progress) progress({ phase: 'listing', processed: loaded.length, total: total });
          return loaded.length < total ? next(pageNumber + 1) : loaded;
        });
      }
      return next(1);
    }
    return Promise.resolve().then(function () {
      check(); return fullCategory ? readCategory() : questions;
    }).then(function (loaded) {
      questions = loaded; result.total = questions.length;
      if (!questions.length) return false;
      check(); return confirmation({ source: fullCategory ? '大观园数学 / 当前分类' : '大观园数学 / 当前页面', target: session.targetTitle, questions: questions });
    }).then(function (accepted) {
      if (accepted === false) { result.cancelled = true; return result; }
      check();
      const selected = __DAGUANYUAN_MATH_IMPORT_GLOBAL__.selectQuestions(questions, accepted);
      result.total = selected.length;
      // 页面只提供当前题目编号；分类和正文在确认后按各题真实详情读取。
      return __DAGUANYUAN_MATH_API_GLOBAL__.categoryRecords('complete', 'all', addon.panelController, check).then(function (records) {
        check(); __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.replaceCatalog({ records: records, updatedAt: new Date().toISOString().slice(0, 10) });
        function write(offset) {
          check(); if (offset >= selected.length) return result;
          const batch = selected.slice(offset, offset + 20);
          return Promise.resolve().then(function () {
            return confirmation.verify ? confirmation.verify() : null;
          }).then(function () {
            check();
            return session.importQuestions(batch.map(function (question) { return question.id; }), {}, confirmation.content, function (value) {
              if (progress) progress(Object.assign({}, value, { processed: offset + value.processed, total: result.total,
                created: result.createdCount + (value.created || 0), answerAdded: result.answerAddedCount + (value.answerAdded || 0),
                skipped: result.skippedCount + (value.skipped || 0), failed: result.failed.length + (value.failed || 0) }));
            }, check);
          }).then(function (value) {
            result.createdCount += value.createdCount || 0; result.answerAddedCount += value.answerAddedCount || 0;
            result.skippedCount += value.skippedCount || 0; result.failed.push.apply(result.failed, value.failed || []);
            if (value.commentFoldWarnings) result.commentFoldWarnings = (result.commentFoldWarnings || []).concat(value.commentFoldWarnings);
            return write(offset + batch.length);
          }, function (error) {
            const value = error.importResult;
            if (value) {
              result.createdCount += value.createdCount || 0; result.answerAddedCount += value.answerAddedCount || 0;
              result.skippedCount += value.skippedCount || 0; result.failed.push.apply(result.failed, value.failed || []);
              if (value.commentFoldWarnings) result.commentFoldWarnings = (result.commentFoldWarnings || []).concat(value.commentFoldWarnings);
            }
            throw error;
          });
        }
        return write(0);
      });
    }).catch(function (error) { error.importResult = result; throw error; });
  }
  function importPage(addon, page, progress, confirmation) {
    return importQuestions(addon, page, progress, confirmation, false);
  }
  function importCategory(addon, context, url, progress, verify, check) {
    if (!context || !context.categoryId) throw new Error('请先进入具体的数学题型分类');
    // 直接整类导入复用完整分页和建卡流程，仅省去勾选确认界面。
    const confirmation = function () { return Promise.resolve().then(verify).then(function () { return true; }); };
    confirmation.check = check;
    confirmation.verify = verify;
    return importQuestions(addon, { provider: 'math', url: url, questions: [], importContext: context }, progress, confirmation, true);
  }
  return { importPage: importPage, importCategory: importCategory };
})();
