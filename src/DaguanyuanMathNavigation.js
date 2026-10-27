var __DAGUANYUAN_MATH_NAVIGATION_GLOBAL__ = (function () {
  function selection(current) {
    const input = current.selection || {};
    const listId = String(input.listId || '');
    if (!listId) {
      const error = new Error('请先选择题单并进入练习，再点击“定位题目”');
      error.chooseList = true;
      throw error;
    }
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(listId)) throw new Error('题单标识无效，请重新选择题单');
    const scope = String(current.scope || 'complete'), examSubject = String(current.examSubject || 'all');
    if (['complete', 'core', 'exam'].indexOf(scope) < 0 || ['all', 'math_1', 'math_2', 'math_3'].indexOf(examSubject) < 0) {
      throw new Error('题单范围无效，请重新选择题单和备考科目');
    }
    const listRevision = Number(input.listRevision || 0);
    if (!Number.isSafeInteger(listRevision) || listRevision < 0) throw new Error('题单版本无效，请重新选择题单');
    return { listId, listRevision, scope, examSubject };
  }

  function contextKey(current) {
    return JSON.stringify([current.url, current.ownerKey || '', current.selection || {}, current.scope, current.examSubject]);
  }

  function catalogFromDirectory(directory) {
    if (!directory || !Array.isArray(directory.roots)) throw new Error('题单目录格式无效，请刷新数学页面后重试');
    const records = [], counts = {}, seen = new Set();
    function visit(nodes, parent, depth) {
      if (!Array.isArray(nodes) || depth > 30) throw new Error('题单目录格式无效');
      nodes.forEach(function (node) {
        const id = Number(node && node.category_id), name = String(node && node.label || '').trim();
        if (!Number.isSafeInteger(id) || id <= 0 || !name || seen.has(id) || records.length >= 20000) throw new Error('题单分类数据无效');
        seen.add(id); records.push([id, parent, name]);
        if (typeof node.question_count !== 'undefined') {
          const count = Number(node.question_count);
          if (!Number.isSafeInteger(count) || count < 0) throw new Error('题单题目数量无效');
          counts[id] = count;
        }
        visit(node.children || [], id, depth + 1);
      });
    }
    visit(directory.roots, 0, 0);
    if (!records.length) throw new Error('当前题单没有可定位的分类，请选择其他题单');
    return { records, counts };
  }

  function targetCategory(route, catalog) {
    const routes = __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__;
    const categoryId = Number(route.categoryId || routes.importContextFromURL(route.url).categoryId);
    if (!Number.isSafeInteger(categoryId) || categoryId <= 0) throw new Error('目标分类无效，请重新绑定分类');
    const source = routes.resultForCategoryId(categoryId), directory = routes.forCatalog(catalog);
    const direct = directory.resultForCategoryId(categoryId);
    if (direct.status === 'resolved' && (source.status !== 'resolved' || direct.name === source.name)) return direct;
    const path = route.categoryPath || source.path || [];
    const match = directory.resolve(path);
    // ID 改变时至少核对父分类，避免仅凭同名叶子节点跳到另一章节。
    if (match.status !== 'resolved' || match.matchedSegments < Math.min(2, path.length)) {
      throw new Error('当前题单无法唯一对应目标分类，请在此题单中重新绑定分类');
    }
    return match;
  }

  function prepare(controller, route, current, check) {
    if (route.imported) return prepareSource(controller, route, check);
    return Promise.resolve().then(function () {
      if (check) check();
      const selected = selection(current);
      return __DAGUANYUAN_MATH_API_GLOBAL__.questionListDirectory(selected, controller, check).then(function (directory) {
        if (check) check();
        const revision = Number(directory.definition_revision);
        if (!Number.isSafeInteger(revision) || revision <= 0 || selected.listRevision && selected.listRevision !== revision) {
          throw new Error('题单版本已变化，请刷新数学页面后重新定位');
        }
        const catalog = catalogFromDirectory(directory), target = targetCategory(route, catalog);
        const questionNumber = route.categoryOnly ? 1 : Number(route.questionNumber);
        if (!Number.isSafeInteger(questionNumber) || questionNumber <= 0) throw new Error('题目序号无效');
        if (!route.categoryOnly && typeof catalog.counts[target.categoryId] !== 'undefined' && questionNumber > catalog.counts[target.categoryId]) {
          throw new Error('当前题单分类只有 ' + catalog.counts[target.categoryId] + ' 题，无法定位第 ' + questionNumber + ' 题，请核对题单和题卡顺序');
        }
        const range = Object.assign({}, selected, { listRevision: revision, categoryId: target.categoryId });
        // 序号仍来自脑图；先取得该序号的真实 ID，兼容网页一次只渲染一道题的模式。
        const reading = route.categoryOnly ? Promise.resolve(null)
          : __DAGUANYUAN_MATH_API_GLOBAL__.practiceQuestionPage(range, Math.ceil(questionNumber / 20), controller, check);
        return reading.then(function (listing) {
          if (check) check();
          const question = listing && listing.questions[(questionNumber - 1) % 20];
          if (!route.categoryOnly && (!listing || questionNumber > listing.total || !question || !Number.isSafeInteger(question.id) || question.id <= 0)) {
            throw new Error('当前题单分类无法定位第 ' + questionNumber + ' 题，请核对题单和题卡顺序');
          }
          const page = Math.ceil(questionNumber / 30);
          const parameters = [['listId', selected.listId], ['listRevision', revision], ['rootCategoryId', 'all'],
            ['categoryId', target.categoryId], ['scope', selected.scope], ['examSubject', selected.examSubject],
            ['practiceOrigin', 'list'], ['page', page]];
          if (question) parameters.push(['questionId', question.id]);
          const query = parameters.map(function (pair) { return pair[0] + '=' + encodeURIComponent(String(pair[1])); }).join('&');
          return Object.assign({}, route, selected, { url: 'https://cxyonly.fans/math/practice?' + query,
            questionId: question ? question.id : 0, listRevision: revision, categoryId: target.categoryId, modern: true, page, pageSize: 30 });
        });
      });
    });
  }

  function prepareSource(controller, route, check) {
    return Promise.resolve().then(function () {
      if (check) check();
      const api = __DAGUANYUAN_MATH_API_GLOBAL__, routes = __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__;
      const questionId = Number(route.questionId);
      if (!Number.isSafeInteger(questionId) || questionId <= 0) throw new Error('原题 ID 无效');
      const source = routes.importContextFromURL(route.url);
      // 旧卡原题一贯在完整分类中打开，不继承当前严选、真题或个人筛选。
      const selected = selection({ scope: source.listId ? source.scope || 'complete' : 'complete',
        examSubject: source.listId ? source.examSubject : 'all',
        selection: { listId: source.listId || 'complete', listRevision: source.listRevision || 0 } });
      return api.questionListDirectory(selected, controller, check).then(function (directory) {
        if (check) check();
        const revision = Number(directory.definition_revision);
        if (!Number.isSafeInteger(revision) || revision <= 0 || selected.listRevision && selected.listRevision !== revision) {
          throw new Error('原题题单版本已变化，请刷新数学页面后重试');
        }
        const catalog = catalogFromDirectory(directory), sourceCategory = Number(route.categoryId || source.categoryId);
        const reading = sourceCategory > 0 ? Promise.resolve(targetCategory(Object.assign({}, route, { categoryId: sourceCategory }), catalog))
          : api.questionNavigationInfo(questionId, controller, check).then(function (info) {
            if (check) check();
            const local = routes.forCatalog(catalog), primary = local.resultForCategoryId(info.categoryId);
            if (primary.status === 'resolved') return primary;
            const candidates = (info.categoryIds || []).map(function (id) { return local.resultForCategoryId(id); })
              .filter(function (item) { return item.status === 'resolved'; });
            if (candidates.length !== 1) throw new Error('无法唯一确定原题分类，请从带分类的原题链接打开');
            return candidates[0];
          });
        return reading.then(function (target) {
          const range = Object.assign({}, selected, { listRevision: revision, categoryId: target.categoryId });
          return api.questionListPosition(range, questionId, controller, check).then(function (position) {
            if (check) check();
            const query = [['listId', selected.listId], ['listRevision', revision], ['rootCategoryId', 'all'],
              ['categoryId', target.categoryId], ['scope', selected.scope], ['examSubject', selected.examSubject],
              ['practiceOrigin', 'list'], ['page', position.page], ['questionId', questionId]]
              .map(function (pair) { return pair[0] + '=' + encodeURIComponent(String(pair[1])); }).join('&');
            return Object.assign({}, route, range, { url: 'https://cxyonly.fans/math/practice?' + query,
              questionId, questionNumber: 0, imported: true, modern: true, page: position.page, pageSize: 30 });
          });
        });
      });
    });
  }

  return { selection, contextKey, prepare };
})();
