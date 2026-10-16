var __DAGUANYUAN_IMPORT_WORKSPACE_GLOBAL__ = (function () {
  const PREFIX = 'cn.marginnote.daguanyuan-bridge.import-workspace.';
  const API = __DAGUANYUAN_MATH_API_GLOBAL__;
  const WRITER = __DAGUANYUAN_MATH_IMPORT_GLOBAL__;

  function evaluate(controller, script) {
    return __DAGUANYUAN_IMPORT_SELECTION_GLOBAL__.evaluate({ webView: controller.importWebView }, script);
  }
  function publish(controller, task, method, data) {
    return evaluate(controller, '(function(){var ui=window.__DAGUANYUAN_IMPORT_WORKSPACE__;if(!ui)throw new Error("导入页面已关闭，请重新打开");ui.'
      + method + '(' + JSON.stringify(task.token) + ',' + JSON.stringify(data) + ');return "ok";})()');
  }
  function catalog() { return __DAGUANYUAN_CATEGORY_CATALOG_STORE_GLOBAL__.currentCatalog().records; }
  function initialize(controller) {
    const defaults = NSUserDefaults.standardUserDefaults();
    let scope = String(defaults.objectForKey(PREFIX + 'scope') || 'complete');
    let content = String(defaults.objectForKey(PREFIX + 'content') || 'question');
    if (['complete', 'core', 'exam'].indexOf(scope) < 0) scope = 'complete';
    if (['question', 'questionAnswer'].indexOf(content) < 0) content = 'question';
    let examSubject = String(defaults.objectForKey(PREFIX + 'exam-subject') || 'all');
    if (['all', 'math_1', 'math_2', 'math_3'].indexOf(examSubject) < 0) examSubject = 'all';
    const source = String(defaults.objectForKey(PREFIX + 'source') || 'math');
    const data = { records: catalog(), records408: __DAGUANYUAN_408_CATALOG_DATA__.records,
      years408: __DAGUANYUAN_408_CATALOG_DATA__.years, source: source === '408' ? '408' : 'math', scope, content, examSubject };
    // 先提供来源和偏好，数学目录随后单独读取，网络失败不阻止切换 408。
    return data;
  }
  function loadCatalog(controller, payload) {
    if (busy(controller)) throw new Error('正在导入题目，请稍后切换筛选');
    const scope = API.questionScope(payload && payload.scope), examSubject = API.examSubject(payload && payload.examSubject);
    close(controller);
    const revision = Number(controller.importCatalogRevision || 0) + 1;
    controller.importCatalogRevision = revision;
    controller.importMathCatalog = null;
    return API.categoryRecords(scope, examSubject).then(function (records) {
      if (revision !== controller.importCatalogRevision || controller.activePage !== 'import') throw new Error('分类读取已失效，请重新打开导入页');
      controller.importMathCatalog = { records, scope, examSubject };
      const defaults = NSUserDefaults.standardUserDefaults();
      defaults.setObjectForKey(scope, PREFIX + 'scope');
      defaults.setObjectForKey(examSubject, PREFIX + 'exam-subject');
      return { records, scope, examSubject };
    });
  }
  function busy(controller) {
    const task = controller.importWorkspaceTask;
    return Boolean(task && task.status === 'running');
  }
  function check(controller, task) {
    if (controller.importWorkspaceTask !== task || task.cancelled || controller.activePage !== 'import') {
      const error = new Error('已停止导入，已完成的题卡保留'); error.stopImport = true; throw error;
    }
    task.session.check();
  }
  function categoriesFor(records, selected) {
    if (!Array.isArray(selected) || !selected.length || selected.length > records.length) throw new Error('请先选择分类');
    const ids = new Set(records.map(function (r) { return r[0]; }));
    const wanted = new Set();
    selected.forEach(function (id) {
      if (!Number.isSafeInteger(id) || !ids.has(id) || wanted.has(id)) throw new Error('所选分类无效或重复');
      wanted.add(id);
    });
    // 分类树按原始目录顺序展开，包含分支自身的直接归属题目。
    let changed = true;
    while (changed) {
      changed = false;
      records.forEach(function (r) {
        if (wanted.has(r[1]) && !wanted.has(r[0])) { wanted.add(r[0]); changed = true; }
      });
    }
    return records.filter(function (r) { return wanted.has(r[0]); }).map(function (r) { return r[0]; });
  }
  function token(value) {
    if (typeof value !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(value)) throw new Error('导入请求标识无效');
    return value;
  }
  function prepare(controller, payload) {
    if (busy(controller) || controller.categoryImportBusy || controller.singleImportBusy || controller.questionToolBusy) throw new Error('当前任务尚未结束，请稍后重试');
    const source = payload && payload.source || 'math';
    if (source !== 'math' && source !== '408') throw new Error('题库来源无效');
    if (source === '408') return prepare408(controller, payload);
    const scope = API.questionScope(payload && payload.scope);
    const examSubject = API.examSubject(payload && payload.examSubject);
    const filtered = controller.importMathCatalog;
    if (!filtered || filtered.scope !== scope || filtered.examSubject !== examSubject) throw new Error('分类筛选已变化，请重新读取');
    const categories = categoriesFor(filtered.records, payload && payload.categoryIds);
    const session = WRITER.preparedMathSession(controller.addon);
    const task = { token: token(payload.token), source: 'math', scope, examSubject, session, status: 'loading', cancelled: false, questions: [] };
    close(controller);
    controller.importWorkspaceTask = task;
    NSUserDefaults.standardUserDefaults().setObjectForKey(scope, PREFIX + 'scope');
    NSUserDefaults.standardUserDefaults().setObjectForKey('math', PREFIX + 'source');
    const seen = new Set();
    let categoryIndex = 0;
    function nextCategory() {
      check(controller, task);
      if (categoryIndex >= categories.length) return Promise.resolve();
      const categoryId = categories[categoryIndex];
      let page = 1, total = -1, read = 0;
      const categorySeen = new Set();
      function nextPage() {
        check(controller, task);
        return API.questionPage(categoryId, page, scope, examSubject).then(function (listing) {
          check(controller, task);
          if (total < 0) total = listing.total;
          if (total !== listing.total || Math.ceil(total / listing.pageSize) > 1000) throw new Error('题目数量已变化或超出可读取范围，请刷新');
          const fresh = [];
          listing.questions.forEach(function (q) {
            if (categorySeen.has(q.id)) throw new Error('题目分页重复，请刷新后重试');
            categorySeen.add(q.id); read += 1;
            if (!seen.has(q.id)) { seen.add(q.id); task.questions.push(q); fresh.push(q); }
          });
          if (read > total || read < total && !listing.questions.length) throw new Error('题目分页不完整，请刷新后重试');
          return publish(controller, task, 'append', { questions: fresh, categoryIndex: categoryIndex + 1, categoryCount: categories.length }).then(function () {
            if (read < total) { page += 1; return nextPage(); }
          });
        });
      }
      return nextPage().then(function () { categoryIndex += 1; return nextCategory(); });
    }
    task.done = Promise.resolve().then(function () {
      return publish(controller, task, 'start', { target: session.targetTitle });
    }).then(nextCategory).then(function () {
      check(controller, task);
      task.status = 'ready';
      return publish(controller, task, 'ready', { count: task.questions.length, importedIds: WRITER.importedQuestionIds(controller.addon) });
    }).catch(function (error) {
      if (controller.importWorkspaceTask !== task) return;
      task.status = 'error'; task.questions = [];
      return publish(controller, task, 'failure', { error: String(error.message || error) });
    }).catch(function (error) { console.log('[Daguanyuan Bridge] 导入页读取回执失败：' + String(error.message || error)); });
    return { accepted: true };
  }
  function targets408(payload) {
    const data = __DAGUANYUAN_408_CATALOG_DATA__;
    if (payload.organization === 'year') {
      if (!Array.isArray(payload.paperYears) || !payload.paperYears.length) throw new Error('请先选择年份');
      const seen = new Set();
      return payload.paperYears.map(function (year) {
        if (!Number.isSafeInteger(year) || data.years.indexOf(year) < 0 || seen.has(year)) throw new Error('408 年份无效或重复');
        seen.add(year); return 'https://www.408os.cn/exercise?year=' + year;
      });
    }
    if (payload.organization !== 'knowledge') throw new Error('408 导入方式无效');
    const wanted = new Set(categoriesFor(data.records, payload.categoryIds));
    const children = new Map(), ordered = [];
    data.records.forEach(function (r) {
      if (!children.has(r[1])) children.set(r[1], []);
      children.get(r[1]).push(r);
    });
    // 网站父分类返回包含下级的汇总题目；先读下级再读父级，让去重保留具体归属。
    function visit(parent, depth) {
      if (depth > 20) throw new Error('408 分类层级无效');
      (children.get(parent) || []).forEach(function (r) {
        visit(r[0], depth + 1);
        if (wanted.has(r[0])) ordered.push(r);
      });
    }
    visit(0, 0);
    return ordered.map(function (r) { return 'https://www.408os.cn/exercise?knowledgeId=' + r[0] + '&knowledgeName=' + encodeURIComponent(r[2]) + '&sourcePage=overview'; });
  }
  function prepare408(controller, payload) {
    if (typeof MNUtil === 'undefined' || typeof MNUtil.getNoteById !== 'function') throw new Error('408 导入需要 MN Utils，请安装并启用 MN Utils');
    const targets = targets408(payload);
    const session = WRITER.prepared408Session(controller.addon);
    const task = { token: token(payload.token), source: '408', session, status: 'loading', cancelled: false, questions: [] };
    close(controller); controller.importWorkspaceTask = task;
    NSUserDefaults.standardUserDefaults().setObjectForKey('408', PREFIX + 'source');
    const worker = __DAGUANYUAN_408_WORKSPACE_GLOBAL__, seen = new Set();
    function next(index) {
      check(controller, task);
      if (index >= targets.length) return Promise.resolve();
      return worker.load(controller, targets[index]).then(function (adapter) {
        check(controller, task);
        return __DAGUANYUAN_408_IMPORT_GLOBAL__.prepareWorkspace(adapter);
      }).then(function (prepared) {
        check(controller, task);
        const listing = prepared.listing, fresh = [];
        listing.ids.forEach(function (id) {
          if (seen.has(id)) return;
          seen.add(id);
          const preview = listing.previews && listing.previews[id] || {};
          const metadata = listing.metadata && listing.metadata[id] || {};
          const q = { id, source: listing.sources[id] || '题目 ' + id, stem: preview.stem || listing.summaries[id] || '网站图文题目',
            previewImages: preview.images || [], options: [], serialNumber: metadata.number || 0, questionType: metadata.questionType || 'unknown',
            categoryPath: (listing.category.path || [listing.category.title]).join(' / '), url: targets[index], category: listing.category,
            legacyCategories: ancestors408(listing.category) };
          task.questions.push(q); fresh.push(q);
        });
        function append(offset) {
          if (offset >= fresh.length) return prepared.close();
          check(controller, task);
          return publish(controller, task, 'append', { questions: fresh.slice(offset, offset + 20), categoryIndex: index + 1, categoryCount: targets.length })
            .then(function () { return append(offset + 20); });
        }
        return append(0).then(function () { return next(index + 1); });
      });
    }
    task.done = publish(controller, task, 'start', { target: session.targetTitle }).then(function () { return next(0); }).then(function () {
      check(controller, task); task.status = 'ready';
      return publish(controller, task, 'ready', { count: task.questions.length, importedIds: WRITER.importedQuestionIds(controller.addon, '408') });
    }).catch(function (error) {
      if (controller.importWorkspaceTask !== task) return;
      task.status = 'error'; task.questions = [];
      return publish(controller, task, 'failure', { error: String(error.message || error) });
    }).catch(function (error) { console.log('[Daguanyuan Bridge] 408 导入页读取回执失败：' + String(error.message || error)); })
      .then(function () { if (controller.importWorkspaceTask === task) worker.release(controller); });
    return { accepted: true };
  }
  function ancestors408(category) {
    const match = String(category.url || '').match(/[?&]knowledgeId=(\d+)(?:&|$)/);
    if (!match || !Array.isArray(category.path)) return [];
    const records = __DAGUANYUAN_408_CATALOG_DATA__.records;
    const byId = new Map(records.map(function (r) { return [r[0], r]; })), ancestors = [];
    let current = byId.get(Number(match[1]));
    while (current && current[1]) {
      current = byId.get(current[1]);
      if (!current) break;
      const path = [], id = current[0];
      let node = current;
      while (node) { path.unshift(node[2]); node = byId.get(node[1]); }
      if (path.length < category.path.length && path.every(function (part, index) { return part === category.path[index]; })) {
        ancestors.push({ id, path });
      }
    }
    return ancestors;
  }
  function write408(controller, task, questions, content, result) {
    const worker = __DAGUANYUAN_408_WORKSPACE_GLOBAL__;
    const groups = [];
    questions.forEach(function (q) {
      let group = groups.find(function (g) { return g.url === q.url; });
      if (!group) { group = { url: q.url, category: q.category, questions: [] }; groups.push(group); }
      group.questions.push(q);
    });
    let processed = 0;
    function next(groupIndex) {
      check(controller, task);
      if (groupIndex >= groups.length) return Promise.resolve();
      const group = groups[groupIndex];
      return worker.load(controller, group.url).then(function (adapter) {
        check(controller, task); return __DAGUANYUAN_408_IMPORT_GLOBAL__.prepareWorkspace(adapter, false);
      }).then(function (prepared) {
        const category = prepared.listing.category;
        if (JSON.stringify(category.path || [category.title]) !== JSON.stringify(group.category.path || [group.category.title])) throw new Error('408 分类目录已变化，请重新读取');
        if (group.questions.some(function (q) { return prepared.listing.ids.indexOf(q.id) < 0; })) throw new Error('所选 408 题目已不在原分类中，请重新读取');
        function write(index) {
          check(controller, task);
          if (index >= group.questions.length) return prepared.close();
          const q = group.questions[index];
          return Promise.resolve().then(function () {
            if (task.session.shouldSkip && task.session.shouldSkip(q.id, category, content)) {
              result.skippedCount += 1; return;
            }
            return prepared.readQuestion(q.id, content).then(function (question) {
              check(controller, task);
              const outcome = task.session.write(question, category, content, q.legacyCategories);
              if (task.session.takeCommentFoldWarnings) {
                const warnings = task.session.takeCommentFoldWarnings();
                if (warnings.length) result.commentFoldWarnings = (result.commentFoldWarnings || []).concat(warnings);
              }
              if (outcome === 'answerAdded') result.answerAddedCount += 1;
              else if (outcome) result.createdCount += 1;
              else result.skippedCount += 1;
            });
          }).catch(function (error) {
            if (error.stopImport || /连接已|分类已|已停止/.test(String(error.message))) throw error;
            result.failed.push({ questionId: q.id, source: q.source, reason: String(error.message || error) });
          }).then(function () {
            processed += 1;
            return publish(controller, task, 'progress', { phase: 'importing', processed, total: questions.length }).then(function () { return write(index + 1); });
          });
        }
        return write(0).then(function () { return next(groupIndex + 1); });
      });
    }
    return next(0).then(function (value) { worker.release(controller); return value; }, function (error) { worker.release(controller); throw error; });
  }
  function commit(controller, payload) {
    const task = controller.importWorkspaceTask;
    if (!task || task.token !== payload.token || task.status !== 'ready') throw new Error('题目列表已失效，请重新读取');
    check(controller, task);
    const content = payload.content;
    if (['question', 'questionAnswer'].indexOf(content) < 0) throw new Error('导入内容无效');
    const count = Number(payload.count);
    if (!Number.isSafeInteger(count) || count < 1 || count > task.questions.length) throw new Error('请至少选择一道有效题目');
    task.status = 'running';
    NSUserDefaults.standardUserDefaults().setObjectForKey(content, PREFIX + 'content');
    const result = { total: count, createdCount: 0, answerAddedCount: 0, skippedCount: 0, failed: [] };
    const ids = [];
    function selection() {
      check(controller, task);
      if (ids.length === count) return WRITER.selectQuestions(task.questions, ids);
      return evaluate(controller, 'window.__DAGUANYUAN_IMPORT_WORKSPACE__.selectionChunk(' + JSON.stringify(task.token) + ',' + ids.length + ')').then(function (raw) {
        const chunk = JSON.parse(String(raw));
        if (!Array.isArray(chunk) || chunk.length !== Math.min(250, count - ids.length)) throw new Error('选题传输不完整，请重试');
        ids.push.apply(ids, chunk); return selection();
      });
    }
    task.done = Promise.resolve().then(selection).then(function (questions) {
      if (task.source === '408') return write408(controller, task, questions, content, result);
      function write(offset) {
        check(controller, task);
        if (offset >= questions.length) return Promise.resolve();
        const batch = questions.slice(offset, offset + 20), categories = {};
        batch.forEach(function (q) { categories[q.id] = q.importCategoryId; });
        return task.session.importQuestions(batch.map(function (q) { return q.id; }), categories, content, function (progress) {
          if (progress.phase !== 'fetching') return;
          // 写入器的批次结果是计数真源，进度回执失败只停止后续批次。
          publish(controller, task, 'progress', { phase: progress.phase, processed: offset + progress.processed, total: count }).catch(function () { task.cancelled = true; });
        }, function () { check(controller, task); }).then(function (part) {
          result.createdCount += part.createdCount; result.answerAddedCount += part.answerAddedCount;
          result.skippedCount += part.skippedCount; result.failed.push.apply(result.failed, part.failed);
          if (part.commentFoldWarnings) result.commentFoldWarnings = (result.commentFoldWarnings || []).concat(part.commentFoldWarnings);
          return publish(controller, task, 'progress', { phase: 'importing', processed: offset + batch.length, total: count })
            .then(function () { return write(offset + batch.length); });
        });
      }
      return write(0);
    }).catch(function (error) {
      if (error.importResult) {
        result.createdCount += error.importResult.createdCount; result.answerAddedCount += error.importResult.answerAddedCount;
        result.skippedCount += error.importResult.skippedCount; result.failed.push.apply(result.failed, error.importResult.failed);
        if (error.importResult.commentFoldWarnings) result.commentFoldWarnings = (result.commentFoldWarnings || []).concat(error.importResult.commentFoldWarnings);
      }
      result.interrupted = String(error.message || error);
    }).then(function () {
      task.status = 'ready';
      let importedIds = [];
      try { task.session.check(); importedIds = WRITER.importedQuestionIds(controller.addon, task.source); }
      catch (error) { result.interrupted = result.interrupted || String(error.message || error); }
      controller.lastCategoryImportReportText = '来源：' + (task.source === '408' ? '408' : '大观园数学 / ' + { complete: '完整', core: '严选', exam: '真题' }[task.scope])
        + (task.source === 'math' ? ' / ' + { all: '全部科目', math_1: '数一', math_2: '数二', math_3: '数三' }[task.examSubject] : '')
        + '\n目标：' + task.session.targetTitle + '\n\n' + __DAGUANYUAN_IMPORT_REPORT_GLOBAL__.textFor(result);
      return publish(controller, task, 'result', { text: controller.lastCategoryImportReportText, result, importedIds });
    }).catch(function (error) { console.log('[Daguanyuan Bridge] 导入页结果回执失败：' + String(error.message || error)); });
    return { accepted: true };
  }
  function close(controller) {
    if (controller) controller.importCatalogRevision = Number(controller.importCatalogRevision || 0) + 1;
    if (controller && controller.importWorkspaceTask) {
      controller.importWorkspaceTask.cancelled = true;
      if (controller.importWorkspaceTask.source === '408') __DAGUANYUAN_408_WORKSPACE_GLOBAL__.release(controller);
    }
  }
  return { initialize, loadCatalog, prepare, commit, close, busy, categoriesFor };
})();
