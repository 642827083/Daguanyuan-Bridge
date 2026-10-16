var __DAGUANYUAN_CARD_REPAIR_UI_GLOBAL__ = (function () {
  const description = '仅当前学习集：修复格式与原题评论显示';
  function hud(controller, message) { Application.sharedInstance().showHUD(message, controller.addonWindow || controller.addon.window, 3); }
  function label(text, size, bold) {
    const view = new UILabel({ x: 0, y: 0, width: 100, height: 24 });
    view.text = text; view.font = bold ? UIFont.boldSystemFontOfSize(size) : UIFont.systemFontOfSize(size);
    view.textColor = UIColor.darkGrayColor(); return view;
  }
  function button(controller, text, selector) {
    const view = new UIButton({ x: 0, y: 0, width: 100, height: 40 });
    view.setTitleForState(text, 0); view.setTitleColorForState(UIColor.colorWithRedGreenBlueAlpha(0.1, 0.36, 0.72, 1), 0);
    view.titleLabel.font = UIFont.systemFontOfSize(14); view.layer.cornerRadius = 8;
    view.addTargetActionForControlEvents(controller, selector, 1 << 0); return view;
  }
  function cancel(controller) {
    const state = controller.cardRepairState; controller.cardRepairState = null;
    if (state && state.overlay) state.overlay.removeFromSuperview();
    if (controller.cardManagementDescription) controller.cardManagementDescription.text = description;
  }
  function layout(controller, width) {
    const state = controller.cardRepairState; if (!state || !state.overlay) return;
    const bounds = controller.containerView.bounds, sheetWidth = Math.min(440, Math.max(0, bounds.width - 24));
    const height = Math.max(0, bounds.height - 38), sheetHeight = Math.min(300, height);
    state.overlay.frame = { x: 0, y: 38, width: bounds.width, height };
    state.sheet.frame = { x: (bounds.width - sheetWidth) / 2, y: (height - sheetHeight) / 2, width: sheetWidth, height: sheetHeight };
    state.title.frame = { x: 16, y: 12, width: Math.max(0, sheetWidth - 32), height: 28 };
    const messageWidth = Math.max(0, sheetWidth - 32), messageHeight = Math.max(0, sheetHeight - 106);
    const chars = Math.max(1, Math.floor(messageWidth / 13));
    const lines = String(state.message.text).split('\n').reduce((count, line) => count + Math.max(1, Math.ceil(line.length / chars)), 0);
    const contentHeight = Math.max(messageHeight, lines * 20);
    state.messageScroll.frame = { x: 16, y: 44, width: messageWidth, height: messageHeight };
    state.message.frame = { x: 0, y: 0, width: messageWidth, height: contentHeight };
    state.messageScroll.contentSize = { width: messageWidth, height: contentHeight };
    state.confirm.frame = { x: 16, y: sheetHeight - 52, width: Math.max(0, (sheetWidth - 44) / 2), height: 40 };
    state.cancel.frame = { x: sheetWidth / 2 + 6, y: sheetHeight - 52, width: Math.max(0, (sheetWidth - 44) / 2), height: 40 };
  }
  function busy(controller) {
    return controller.commentFoldOperation || controller.categoryImportBusy || controller.singleImportBusy || controller.questionToolBusy
      || controller.importWorkspaceTask && controller.importWorkspaceTask.status === 'running'
      || controller.importTask && controller.importTask.status === 'running';
  }
  function repair(controller) {
    if (controller.activePage !== 'settings' || controller.cardRepairState) return;
    if (busy(controller)) { hud(controller, '正在导入或读取题目，请稍后修复'); return; }
    __DAGUANYUAN_CARD_LOCATOR_UI_GLOBAL__.cancelMode(controller);
    const state = {}; controller.cardRepairState = state;
    controller.cardManagementDescription.text = '正在统计当前学习集的题卡…';
    Promise.resolve().then(() => __DAGUANYUAN_CARD_REPAIR_GLOBAL__.preview(controller.addon || { window: controller.addonWindow })).then(function (prepared) {
      if (controller.cardRepairState !== state) return;
      state.prepared = prepared;
      if (!prepared.jobs.length) {
        cancel(controller); hud(controller, prepared.skipped.length ? '没有可修复的题卡，跳过 ' + prepared.skipped.length + ' 张：' + prepared.skipped[0].reason : '当前学习集的已导入题卡无需修复'); return;
      }
      state.overlay = new UIView({ x: 0, y: 0, width: 100, height: 100 });
      state.overlay.backgroundColor = UIColor.colorWithWhiteAlpha(0, 0.2);
      state.sheet = new UIView({ x: 0, y: 0, width: 100, height: 100 });
      state.sheet.backgroundColor = UIColor.whiteColor(); state.sheet.layer.cornerRadius = 12;
      state.title = label('修复题卡格式', 17, true);
      state.message = label('当前学习集需要修复：\n题目卡 ' + prepared.questionCount + ' 张，答案卡 ' + prepared.answerCount + ' 张。\n'
        + (prepared.skipped.length ? '跳过 ' + prepared.skipped.length + ' 张：' + prepared.skipped[0].reason + '\n' : '')
        + '将把注释移到第二条“查看原题”链接后，去除重复的网址、入口标记及两条内容校验注释，缺少链接时自动补齐。保留正文、个人评论、手写和卡片位置，可在 MN 中撤销。', 13, false);
      state.message.numberOfLines = 0;
      state.messageScroll = new UIScrollView({ x: 0, y: 0, width: 100, height: 100 });
      state.messageScroll.showsVerticalScrollIndicator = true; state.messageScroll.addSubview(state.message);
      state.confirm = button(controller, '确认修复', 'confirmCardRepair:'); state.cancel = button(controller, '取消', 'cancelCardRepair:');
      [state.title, state.messageScroll, state.confirm, state.cancel].forEach(view => state.sheet.addSubview(view));
      state.overlay.addSubview(state.sheet); controller.containerView.addSubview(state.overlay);
      controller.cardManagementDescription.text = '等待确认：' + prepared.jobs.length + ' 张卡片';
      layout(controller, (controller.cardToolsSettingsSection || controller.questionToolsSettingsSection).bounds.width);
    }).catch(function (error) {
      if (controller.cardRepairState !== state) return;
      cancel(controller); hud(controller, '无法统计题卡：' + String(error.message || error));
    });
  }
  function confirm(controller, sender) {
    const state = controller.cardRepairState;
    if (!state || !state.prepared || state.confirm !== sender) return;
    if (busy(controller)) { cancel(controller); hud(controller, '正在导入或读取题目，请稍后修复'); return; }
    cancel(controller);
    try {
      const result = __DAGUANYUAN_CARD_REPAIR_GLOBAL__.apply(controller.addon || { window: controller.addonWindow }, state.prepared);
      hud(controller, '已修复 ' + result.repairedCount + ' 张卡片' + (result.skippedCount ? '，跳过 ' + result.skippedCount + ' 张' : '')
        + (result.failed.length ? '，失败 ' + result.failed.length + ' 张：' + result.failed[0].reason : '')
        + (result.commentFoldWarnings && result.commentFoldWarnings.length ? '；原题评论未折叠：' + result.commentFoldWarnings[0].reason : ''));
    } catch (error) { hud(controller, '修复未完成：' + String(error.message || error)); }
  }
  return { layout, repair, confirm, cancel };
})();
