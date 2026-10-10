var __DAGUANYUAN_MATH_SELECTION_GLOBAL__ = (function () {
  function pageReader(controller) {
    return function (url, check) {
      const token = controller.importTask && controller.importTask.token;
      const prefix = 'window.__DAGUANYUAN_IMPORT_UI__';
      function evaluate(script) { if (check) check(); return __DAGUANYUAN_IMPORT_SELECTION_GLOBAL__.evaluate(controller, script); }
      const deadline = Date.now() + 30000;
      function read() {
        if (Date.now() > deadline) throw new Error('练题列表读取超时，请重试');
        return evaluate(prefix + '.sourceRead(' + JSON.stringify(token) + ')').then(function (raw) {
          const value = JSON.parse(String(raw));
          if (value.status === 'error') throw new Error(value.error);
          if (value.status === 'ready') return value.payload;
          return new Promise(function (resolve) { NSTimer.scheduledTimerWithTimeInterval(0.15, false, resolve); }).then(read);
        });
      }
      function release() { return __DAGUANYUAN_IMPORT_SELECTION_GLOBAL__.evaluate(controller, prefix + '.sourceRelease(' + JSON.stringify(token) + ')').catch(function () {}); }
      return evaluate(prefix + '.sourceBegin(' + JSON.stringify(token) + ',' + JSON.stringify(url) + ')').then(read).then(function (payload) {
        release(); return payload;
      }, function (error) { release(); throw error; });
    };
  }
  function importSource(addon, selection, progress, confirmation, request) {
    const api = __DAGUANYUAN_MATH_API_GLOBAL__;
    const session = __DAGUANYUAN_MATH_IMPORT_GLOBAL__.preparedMathSession(addon);
    const result = { total: 0, createdCount: 0, answerAddedCount: 0, skippedCount: 0, failed: [] };
    const questions = [], seen = new Set();
    function check() { if (confirmation && confirmation.check) confirmation.check(); session.check(); }
    function list(page) {
      check();
      return api.selectedQuestionPage(selection, page, check, request).then(function (value) {
        check();
        if (page === 1) result.total = value.total;
        if (result.total !== value.total) throw new Error('练题列表已变化，请重新打开选题导入');
        if (result.total > value.pageSize * 1000) throw new Error('题目数量超过接口可读取范围');
        value.questions.forEach(function (question) {
          if (seen.has(question.id)) throw new Error('分页题目重复，请刷新后重试');
          seen.add(question.id); questions.push(question);
        });
        if (questions.length > result.total) throw new Error('练题列表数量无效');
        if (progress) progress({ phase: 'listing', processed: questions.length, total: result.total });
        if (questions.length === result.total) return;
        if (!value.questions.length) throw new Error('题目列表读取不完整，请重试');
        return list(page + 1);
      });
    }
    // 网站分类会调整；先更新内存目录，建卡仍由原生层按完整分类路径处理。
    return api.categoryRecords('complete', 'all').then(function (records) {
      check();
      __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.replaceCatalog({ records: records, updatedAt: new Date().toISOString().slice(0, 10) });
      return list(1);
    }).then(function () {
      check();
      if (!questions.length) return false;
      const category = selection.categoryId && __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.resultForCategoryId(selection.categoryId);
      return confirmation({ source: '大观园数学 / ' + (category && category.status === 'resolved' ? category.path.join(' / ') : selection.listId || '当前练题范围'),
        target: session.targetTitle, questions: questions.map(function (question) {
          return { id: question.id, title: question.source || '题目 ' + question.id, summary: question.stem };
        }) });
    }).then(function (accepted) {
      if (accepted === false) { result.cancelled = questions.length > 0; return result; }
      check();
      const selected = __DAGUANYUAN_MATH_IMPORT_GLOBAL__.selectQuestions(questions, accepted);
      result.total = selected.length;
      const branches = [selection.categoryId].concat(String(selection.categoryIds || '').split(',')).map(Number).filter(Boolean)
        .map(function (id) { return __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.resultForCategoryId(id); }).filter(function (route) { return route.status === 'resolved'; });
      function write(offset) {
        check();
        if (offset >= selected.length) return result;
        const batch = selected.slice(offset, offset + 20), categories = {};
        batch.forEach(function (question) {
          const routes = question.categoryIds.map(function (id) { return __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.resultForCategoryId(id); })
            .filter(function (route) { return route.status === 'resolved'; });
          const category = routes.find(function (route) {
            return branches.some(function (branch) {
              return branch.path.length <= route.path.length && branch.path.every(function (name, index) { return route.path[index] === name; });
            });
          }) || routes[0];
          if (category) categories[question.id] = category.categoryId;
        });
        return session.importQuestions(batch.map(function (question) { return question.id; }), categories, confirmation.content, function (value) {
          if (progress) progress(Object.assign({}, value, { processed: offset + value.processed, total: result.total }));
        }, check).then(function (value) {
          result.createdCount += value.createdCount; result.answerAddedCount += value.answerAddedCount;
          result.skippedCount += value.skippedCount; result.failed.push.apply(result.failed, value.failed);
          if (progress) progress({ phase: 'importing', processed: Math.min(offset + batch.length, result.total), total: result.total });
          return write(offset + batch.length);
        }, function (error) {
          if (error.importResult) {
            result.createdCount += error.importResult.createdCount || 0; result.answerAddedCount += error.importResult.answerAddedCount || 0;
            result.skippedCount += error.importResult.skippedCount || 0; result.failed.push.apply(result.failed, error.importResult.failed || []);
          }
          throw error;
        });
      }
      return write(0);
    }).catch(function (error) { error.importResult = result; throw error; });
  }
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
      return __DAGUANYUAN_MATH_API_GLOBAL__.categoryRecords('complete', 'all').then(function (records) {
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
  return { importSource: importSource, pageReader: pageReader, importPage: importPage };
})();
