var __DAGUANYUAN_IMPORT_SELECTION_GLOBAL__ = (function () {
  const PAGE = 'window.__DAGUANYUAN_IMPORT_UI__';
  function evaluate(controller, script) {
    return new Promise(function (resolve, reject) {
      let settled = false;
      const timer = NSTimer.scheduledTimerWithTimeInterval(15, false, function () { finish(null, new Error('导入页面响应超时，请重新打开')); });
      function finish(value, error) {
        if (settled) return;
        settled = true; timer.invalidate();
        if (error && !(typeof NSNull !== 'undefined' && error instanceof NSNull)) {
          if (typeof __DAGUANYUAN_DIAGNOSTICS_GLOBAL__ !== 'undefined') __DAGUANYUAN_DIAGNOSTICS_GLOBAL__.error('web.evaluate', error);
          reject(new Error(String(error.message || error.localizedDescription || error)));
        }
        else resolve(value);
      }
      try { controller.webView.evaluateJavaScript(script, finish); } catch (error) { finish(null, error); }
    });
  }
  function inject(controller) {
    const navigation = __DAGUANYUAN_WEB_BRIDGE_COMMANDS_GLOBAL__.navigationState(controller);
    return evaluate(controller, 'window.__DAGUANYUAN_WEBSITE_NAVIGATION__=' + JSON.stringify(navigation) + ';' + __DAGUANYUAN_IMPORT_PAGE_SCRIPT__ + ';"ok"');
  }
  function call(controller, method, args) {
    return evaluate(controller, PAGE + '&&' + PAGE + '.' + method + '(' + args.map(function (value) { return JSON.stringify(value); }).join(',') + ')').then(function (value) {
      if (String(value) !== 'ok') throw new Error('导入页面已关闭或切换，请重新打开');
    });
  }
  function check(controller, task) {
    if (!task || task !== controller.importTask || task.cancelled) {
      const error = new Error('已停止导入，已完成的题卡保留'); error.stopImport = true; throw error;
    }
  }
  function begin(controller, scope) {
    if (controller.importTask && ['loading', 'confirm', 'running'].indexOf(controller.importTask.status) >= 0 && !controller.importTask.cancelled) throw new Error('请先完成当前导入');
    const task = { token: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2), scope: scope || 'all', status: 'loading', cancelled: false, dismissed: false };
    controller.importTask = task;
    if (controller.importReportView) controller.importReportView.hidden = true;
    task.ready = inject(controller).then(function () { check(controller, task); return call(controller, 'loading', [task.token, task.scope]); });
    task.ready.catch(function () {});
    return task;
  }
  function summary(value) {
    return String(value || '').replace(/data:image\/[^\s)]+/g, '[图片]').replace(/!\[[^\]]*\]\([^)]*\)/g, '[图片]')
      .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
  }
  function confirmation(controller) {
    const task = controller.importTask;
    function confirm(plan) {
      if (task.cancelled) return Promise.resolve(false);
      task.plan = plan;
      return task.ready.then(function () {
        check(controller, task);
        return call(controller, 'startPlan', [{ token: task.token, source: plan.source, target: plan.target }]);
      }).then(function () {
        function append(offset) {
          check(controller, task);
          if (offset >= plan.questions.length) return call(controller, 'render', [task.token]);
          const items = plan.questions.slice(offset, offset + 100).map(function (q) { return { id: q.id, title: summary(q.title), summary: summary(q.summary) }; });
          return call(controller, 'appendQuestions', [task.token, items]).then(function () { return append(offset + items.length); });
        }
        return append(0);
      }).then(function () {
        check(controller, task); task.status = 'confirm';
        return new Promise(function (resolve) { task.resolve = resolve; });
      });
    }
    confirm.content = 'question';
    task.confirmation = confirm;
    confirm.check = function () { check(controller, task); };
    return confirm;
  }
  function taskFor(controller, payload) {
    const task = controller.importTask;
    if (!task || !payload || payload.token !== task.token) throw new Error('导入任务已失效，请重新打开');
    return task;
  }
  function commit(controller, payload) {
    const task = taskFor(controller, payload); check(controller, task);
    if (task.status !== 'confirm' || !task.resolve || task.committing) throw new Error('当前任务不能重复导入');
    const count = Number(payload.count);
    if (!Number.isSafeInteger(count) || count < 1 || count > task.plan.questions.length) throw new Error('请至少选择一道有效题目');
    const content = payload.content || 'question';
    if (content !== 'question' && content !== 'questionAnswer') throw new Error('导入内容选项无效');
    task.committing = true;
    const ids = [];
    function next() {
      check(controller, task);
      if (ids.length >= count) {
        const selected = __DAGUANYUAN_MATH_IMPORT_GLOBAL__.selectQuestions(task.plan.questions, ids).map(function (q) { return q.id; });
        task.confirmation.content = content;
        task.status = 'running'; const resolve = task.resolve; task.resolve = null; resolve(selected);
        return { accepted: true };
      }
      return evaluate(controller, PAGE + '.selectionChunk(' + JSON.stringify(task.token) + ',' + ids.length + ')').then(function (raw) {
        const chunk = JSON.parse(String(raw));
        if (!Array.isArray(chunk) || chunk.length !== Math.min(250, count - ids.length)) throw new Error('选题列表传输不完整，请重试');
        ids.push.apply(ids, chunk); return next();
      });
    }
    return Promise.resolve().then(next).then(function (value) { task.committing = false; return value; }, function (error) { task.committing = false; throw error; });
  }
  function cancel(controller, payload) {
    const task = taskFor(controller, payload);
    task.cancelled = true; task.dismissed = Boolean(payload.dismiss);
    if (task.resolve) { const resolve = task.resolve; task.resolve = null; resolve(false); }
    return { cancelled: true };
  }
  function close(controller) {
    const task = controller && controller.importTask; if (!task) return;
    cancel(controller, { token: task.token, dismiss: true });
    call(controller, 'hide', [task.token]).catch(function () {});
  }
  function progress(controller, value) {
    const task = controller.importTask;
    if (!task || task.dismissed || task.status !== 'running') return;
    call(controller, 'progress', [task.token, value]).catch(function () { task.cancelled = true; });
  }
  function show(controller, result) {
    const task = controller.importTask;
    if (!task || task.dismissed || result.cancelled) return Promise.resolve();
    task.status = 'result';
    controller.lastCategoryImportReportText = (task.plan ? '来源：' + task.plan.source + '\n目标：' + task.plan.target + '\n\n' : '') + __DAGUANYUAN_IMPORT_REPORT_GLOBAL__.textFor(result);
    return task.ready.catch(function () {}).then(function () { return call(controller, 'result', [task.token, { text: controller.lastCategoryImportReportText, interrupted: result.interrupted || '' }]); });
  }
  function copy(controller, payload) { taskFor(controller, payload); return __DAGUANYUAN_IMPORT_REPORT_GLOBAL__.copy(controller); }
  return { inject, begin, confirmation, commit, cancel, close, progress, show, copy, evaluate };
})();
