var __DAGUANYUAN_WEB_BRIDGE_COMMANDS_GLOBAL__ = (function () {
  const UI = __DAGUANYUAN_IMPORT_SELECTION_GLOBAL__;
  function workspace(context) {
    if (!context.isImportWorkspace || context.controller.activePage !== 'import') throw new Error('请在导入页执行此操作');
    return __DAGUANYUAN_IMPORT_WORKSPACE_GLOBAL__;
  }
  const commands = {
    importCurrentQuestions: function (context) {
      if (context.isImportWorkspace || typeof context.openCategory !== 'function') throw new Error('请从题库网页导入题目');
      if (context.controller.categoryImportBusy || context.controller.singleImportBusy || context.controller.questionToolBusy) throw new Error('当前任务尚未结束，请稍后导入');
      context.openCategory('all'); return { accepted: true };
    },
    bindCurrentCategory: function (context) {
      if (context.isImportWorkspace || typeof context.bindCategory !== 'function') throw new Error('请从题库网页绑定分类');
      if (context.controller.categoryImportBusy || context.controller.singleImportBusy || context.controller.questionToolBusy) throw new Error('当前任务尚未结束，请稍后绑定分类');
      context.bindCategory(); return { accepted: true };
    },
    getImportWorkspace: function (context) { return workspace(context).initialize(context.controller); },
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
    function reply(payload, error) {
      if (!message || typeof message.requestId !== 'string') return;
      const response = { requestId: message.requestId, payload: payload == null ? null : payload, error: error ? String(error.message || error) : '' };
      UI.evaluate({ webView: context.webView || context.controller.webView }, 'window.__DAGUANYUAN_MN_BRIDGE_RECEIVE__&&window.__DAGUANYUAN_MN_BRIDGE_RECEIVE__(' + JSON.stringify(response) + ')').catch(function () {});
    }
    try {
      message = JSON.parse(decodeURIComponent(match[1]));
      if (!message || typeof message.requestId !== 'string' || message.requestId.length > 100 || !Object.prototype.hasOwnProperty.call(commands, message.command)) throw new Error('导入命令无效');
      Promise.resolve(commands[message.command](context, message.payload)).then(function (result) { reply(result); }, function (error) { reply(null, error); });
    } catch (error) { reply(null, error); }
    return true;
  }
  return { handle, commands };
})();
