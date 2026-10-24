var __DAGUANYUAN_WEB_BRIDGE_COMMANDS_GLOBAL__ = (function () {
  const UI = __DAGUANYUAN_IMPORT_SELECTION_GLOBAL__;
  function workspace(context) {
    if (!context.isImportWorkspace || context.controller.activePage !== 'import') throw new Error('请在导入页执行此操作');
    return __DAGUANYUAN_IMPORT_WORKSPACE_GLOBAL__;
  }
  function navigationState(controller) {
    const view = controller.webView;
    const back = view && view.canGoBack;
    return { canGoBack: Boolean(view && typeof view.goBack === 'function' && (typeof back === 'function' ? back.call(view) : back)), canReload: Boolean(view && typeof view.reload === 'function') };
  }
  const commands = {
    getWebsiteNavigation: function (context) {
      if (context.isImportWorkspace) throw new Error('请从题库网页使用导航');
      return navigationState(context.controller);
    },
    navigateWebsite: function (context, payload) {
      if (context.isImportWorkspace) throw new Error('请从题库网页使用导航');
      if (!payload || ['back', 'reload'].indexOf(payload.action) < 0) throw new Error('网页导航操作无效');
      const controller = context.controller, task = controller.importTask, workspaceTask = controller.importWorkspaceTask;
      if (controller.categoryImportBusy || controller.singleImportBusy || controller.questionToolBusy ||
          (task && !task.cancelled && ['loading', 'confirm', 'running'].indexOf(task.status) >= 0) ||
          (workspaceTask && !workspaceTask.cancelled && workspaceTask.status === 'running')) throw new Error('当前任务尚未结束，请稍后使用网页导航');
      const state = navigationState(controller);
      if (payload.action === 'back' ? !state.canGoBack : !state.canReload) return state;
      controller.webView[payload.action === 'back' ? 'goBack' : 'reload']();
      return navigationState(controller);
    },
    importCurrentQuestions: function (context) {
      if (context.isImportWorkspace || typeof context.openCategory !== 'function') throw new Error('请从题库网页导入题目');
      if (context.controller.categoryImportBusy || context.controller.singleImportBusy || context.controller.questionToolBusy) throw new Error('当前任务尚未结束，请稍后导入');
      context.openCategory('selected'); return { accepted: true };
    },
    bindCurrentCategory: function (context) {
      if (context.isImportWorkspace || typeof context.bindCategory !== 'function') throw new Error('请从题库网页绑定分类');
      if (context.controller.categoryImportBusy || context.controller.singleImportBusy || context.controller.questionToolBusy) throw new Error('当前任务尚未结束，请稍后绑定分类');
      context.bindCategory(); return { accepted: true };
    },
    getImportWorkspace: function (context) { return workspace(context).initialize(); },
    getImportWorkspaceCatalog: function (context, payload) { return workspace(context).loadCatalog(context.controller, payload); },
    prepareImportWorkspace: function (context, payload) { return workspace(context).prepare(context.controller, payload); },
    commitImportWorkspace: function (context, payload) { return workspace(context).commit(context.controller, payload); },
    stopImportWorkspace: function (context) { workspace(context).close(context.controller); return { stopped: true }; },
    copyImportWorkspaceResult: function (context) { workspace(context); return __DAGUANYUAN_IMPORT_REPORT_GLOBAL__.copy(context.controller); },
    openQuestionImport: function (context, payload) {
      if (context.isImportWorkspace) throw new Error('请从题库网页打开选题导入');
      if (!payload || payload.scope !== 'selected') throw new Error('导入范围无效');
      if (context.controller.categoryImportBusy || context.controller.singleImportBusy || context.controller.questionToolBusy) throw new Error('当前任务尚未结束，请稍后重试');
      context.openCategory('selected');
      return { opened: true };
    },
    commitQuestionImport: function (context, payload) { return UI.commit(context.controller, payload); },
    cancelQuestionImport: function (context, payload) { return UI.cancel(context.controller, payload); },
    copyImportResult: function (context, payload) { return UI.copy(context.controller, payload); },
  };
  function handle(context, address) {
    const match = /^daguanyuanbridge:\/\/ui\?payload=([^#]+)$/.exec(address);
    if (!match) return false;
    let message;
    let command, taskId;
    function reply(payload, error) {
      if (!message || typeof message.requestId !== 'string') return;
      if (error && typeof __DAGUANYUAN_DIAGNOSTICS_GLOBAL__ !== 'undefined') __DAGUANYUAN_DIAGNOSTICS_GLOBAL__.error('bridge.command', error, { command, taskId });
      const response = { requestId: message.requestId, payload: payload == null ? null : payload, error: error ? String(error.message || error) : '' };
      UI.evaluate({ webView: context.webView || context.controller.webView }, 'window.__DAGUANYUAN_MN_BRIDGE_RECEIVE__&&window.__DAGUANYUAN_MN_BRIDGE_RECEIVE__(' + JSON.stringify(response) + ')').catch(function (failure) {
        if (typeof __DAGUANYUAN_DIAGNOSTICS_GLOBAL__ !== 'undefined') __DAGUANYUAN_DIAGNOSTICS_GLOBAL__.error('bridge.reply', failure, { command, taskId });
      });
    }
    try {
      message = JSON.parse(decodeURIComponent(match[1]));
      if (!message || typeof message.requestId !== 'string' || message.requestId.length > 100 || !Object.prototype.hasOwnProperty.call(commands, message.command)) throw new Error('导入命令无效');
      command = message.command;
      if (typeof __DAGUANYUAN_DIAGNOSTICS_GLOBAL__ !== 'undefined') taskId = __DAGUANYUAN_DIAGNOSTICS_GLOBAL__.begin('bridge.command', { command });
      Promise.resolve(commands[message.command](context, message.payload)).then(function (result) { reply(result); }, function (error) { reply(null, error); });
    } catch (error) { reply(null, error); }
    return true;
  }
  return { handle, commands, navigationState };
})();
