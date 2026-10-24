var __DAGUANYUAN_MATH_SELECTION_GLOBAL__ = (function () {
  function importPage(addon, page, progress, confirmation) {
    if (!page || page.provider !== 'math' || !/^https:\/\/(?:www\.)?cxyonly\.fans\//.test(page.url || '')
      || !Array.isArray(page.questions) || !page.questions.length || page.questions.length > 10000) throw new Error('当前页面题目列表无效，请重新打开选题导入');
    const seen = new Set();
    const questions = page.questions.map(function (question) {
      if (!question || !Number.isSafeInteger(question.id) || question.id < 1 || seen.has(question.id)) throw new Error('当前页面题目编号无效');
      seen.add(question.id);
      return { id: question.id, title: String(question.title || '题目 ' + question.id).slice(0, 200), summary: String(question.summary || '').slice(0, 180) };
    });
    const session = __DAGUANYUAN_MATH_IMPORT_GLOBAL__.preparedMathSession(addon);
    const result = { total: questions.length, createdCount: 0, answerAddedCount: 0, skippedCount: 0, failed: [] };
    function check() { if (confirmation.check) confirmation.check(); session.check(); }
    return Promise.resolve().then(function () {
      check(); return confirmation({ source: '大观园数学 / 当前页面', target: session.targetTitle, questions: questions });
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
          return session.importQuestions(batch.map(function (question) { return question.id; }), {}, confirmation.content, function (value) {
            if (progress) progress(Object.assign({}, value, { processed: offset + value.processed, total: result.total }));
          }, check).then(function (value) {
            result.createdCount += value.createdCount || 0; result.answerAddedCount += value.answerAddedCount || 0;
            result.skippedCount += value.skippedCount || 0; result.failed.push.apply(result.failed, value.failed || []);
            return write(offset + batch.length);
          }, function (error) {
            const value = error.importResult;
            if (value) {
              result.createdCount += value.createdCount || 0; result.answerAddedCount += value.answerAddedCount || 0;
              result.skippedCount += value.skippedCount || 0; result.failed.push.apply(result.failed, value.failed || []);
            }
            throw error;
          });
        }
        return write(0);
      });
    }).catch(function (error) { error.importResult = result; throw error; });
  }
  return { importPage: importPage };
})();
