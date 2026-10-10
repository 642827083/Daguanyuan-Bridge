var __DAGUANYUAN_MASTERY_SYNC_GLOBAL__ = (function () {
  const PAGE = 'window.__DAGUANYUAN_MASTERY_PAGE__';
  function cancel(addon) {
    const task = addon.__daguanyuanMasteryTask;
    if (!task) return;
    task.cancelled = true;
    __DAGUANYUAN_IMPORT_SELECTION_GLOBAL__.evaluate(task.controller, PAGE + '&&' + PAGE + '.release(' + JSON.stringify(task.token) + ')').catch(function () {});
  }
  function save(addon, target, mastery) {
    if (addon.__daguanyuanMasteryTask) return Promise.reject(new Error('正在同步掌握状态，请稍后再试'));
    const controller = addon.panelController;
    if (!controller || !controller.webView) return Promise.reject(new Error('请先打开插件数学面板并登录大观园'));
    if (!target || !Number.isSafeInteger(target.questionId) || target.questionId < 1 || ['needs_practice', 'not_known', 'mastered'].indexOf(mastery) < 0) {
      return Promise.reject(new Error('掌握标记参数无效'));
    }
    const task = { token: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2), controller, cancelled: false };
    addon.__daguanyuanMasteryTask = task;
    const deadline = Date.now() + 30000;
    function evaluate(script) {
      if (task.cancelled || addon.panelController !== controller) throw new Error('掌握标记已停止');
      return __DAGUANYUAN_IMPORT_SELECTION_GLOBAL__.evaluate(controller, script);
    }
    function read() {
      if (Date.now() > deadline) throw new Error('同步超时，网站可能已保存，请查看原题确认');
      return evaluate(PAGE + '.read(' + JSON.stringify(task.token) + ')').then(function (raw) {
        if (task.cancelled || addon.panelController !== controller) throw new Error('掌握标记已停止');
        const result = JSON.parse(String(raw));
        if (result.status === 'error') throw new Error(result.error);
        if (result.status === 'ready') {
          if (result.id !== target.questionId || result.mastery !== mastery) throw new Error('掌握标记回执不一致');
          return result;
        }
        if (result.status !== 'loading') throw new Error('掌握标记回执无效');
        return new Promise(function (resolve) { NSTimer.scheduledTimerWithTimeInterval(0.15, false, resolve); }).then(read);
      });
    }
    function release() {
      return __DAGUANYUAN_IMPORT_SELECTION_GLOBAL__.evaluate(controller, PAGE + '&&' + PAGE + '.release(' + JSON.stringify(task.token) + ')')
        .catch(function () {}).then(function () { if (addon.__daguanyuanMasteryTask === task) addon.__daguanyuanMasteryTask = null; });
    }
    return Promise.resolve().then(function () {
      return evaluate(__DAGUANYUAN_MASTERY_PAGE_SCRIPT__ + ';' + PAGE + '.begin(' + JSON.stringify(task.token) + ',' + target.questionId + ',' + JSON.stringify(mastery) + ')');
    }).then(function (result) {
      if (String(result) !== 'ok') throw new Error('请先打开插件数学面板并登录大观园');
      return read();
    }).then(function (result) { return release().then(function () { return result; }); }, function (error) {
      return release().then(function () { throw error; });
    });
  }
  return { save, cancel };
})();
