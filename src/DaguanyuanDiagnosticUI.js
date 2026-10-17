var __DAGUANYUAN_DIAGNOSTIC_UI_GLOBAL__ = (function () {
  function open(controller) {
    if (controller.activePage !== 'settings' || controller.settingsSection !== 'about') return;
    __DAGUANYUAN_SUPPORT_UI_GLOBAL__.close(controller);
    const menu = __DAGUANYUAN_CARD_LOCATOR_UI_GLOBAL__;
    const logs = __DAGUANYUAN_DIAGNOSTICS_GLOBAL__;
    function hud(message) { Application.sharedInstance().showHUD(message, controller.addon.window, 3); }
    menu.chooseOption(controller, '诊断日志（仅保存在本机）', ['export', 'copy', 'clear'], ['导出日志', '复制日志', '清空日志'], null, 'selectDiagnosticLogAction:', function (action) {
      try {
        if (action === 'export') logs.exportFile();
        else if (action === 'copy') { logs.copy(); hud('诊断日志已复制'); }
        else if (action === 'clear') menu.chooseOption(controller, '确定清空全部诊断日志？', ['confirm'], ['清空日志'], null, 'selectDiagnosticLogAction:', function () {
          hud(logs.clear() ? '诊断日志已清空' : '内存日志已清空，本机文件清空失败，请重试');
        });
      } catch (error) { hud(String(error.message || '日志操作失败，请重试')); }
    });
  }
  return { open };
})();
