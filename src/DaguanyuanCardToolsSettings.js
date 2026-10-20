var __DAGUANYUAN_CARD_TOOLS_SETTINGS_GLOBAL__ = (function () {
  const FOLD_DESCRIPTION = '新导入和修复后的题卡自动生效';
  const MANAGEMENT_DESCRIPTION = '仅当前学习集：折叠或展开“查看原题”';
  function label(text, size, bold) {
    const view = new UILabel({ x: 0, y: 0, width: 100, height: 24 });
    view.text = text; view.font = bold ? UIFont.boldSystemFontOfSize(size) : UIFont.systemFontOfSize(size);
    view.textColor = bold ? UIColor.colorWithRedGreenBlueAlpha(37 / 255, 40 / 255, 48 / 255, 1) : UIColor.colorWithRedGreenBlueAlpha(122 / 255, 129 / 255, 139 / 255, 1); return view;
  }
  function button(controller, title, action) {
    const view = new UIButton({ x: 0, y: 0, width: 100, height: 40 });
    view.setTitleForState(title, 0); view.setTitleColorForState(UIColor.colorWithRedGreenBlueAlpha(0.1, 0.36, 0.72, 1), 0);
    view.titleLabel.font = UIFont.systemFontOfSize(14); view.layer.cornerRadius = 8;
    view.addTargetActionForControlEvents(controller, action, 1 << 0); return view;
  }
  function setup(controller) {
    const section = new UIView({ x: 20, y: 0, width: 100, height: 350 });
    section.backgroundColor = UIColor.whiteColor(); section.layer.cornerRadius = 12;
    section.layer.borderWidth = 1; section.layer.borderColor = UIColor.colorWithRedGreenBlueAlpha(227 / 255, 231 / 255, 237 / 255, 1);
    controller.cardToolsSettingsSection = section; controller.settingsPage.addSubview(section);
    controller.cardToolsTitle = label('题卡工具', 17, true);
    controller.cardToolsDivider = new UIView({ x: 20, y: 48, width: 100, height: 1 });
    controller.cardToolsDivider.backgroundColor = UIColor.colorWithRedGreenBlueAlpha(227 / 255, 231 / 255, 237 / 255, 1);
    controller.masteryTitle = label('掌握标记', 16, true);
    controller.masteryDescription = label('点击数学或 408 题卡，在卡片下方标记并同步到对应网站', 12, false);
    controller.masterySwitch = new UISwitch({ x: 0, y: 69, width: 51, height: 31 });
    controller.masterySwitch.addTargetActionForControlEvents(controller, 'toggleMasteryMarking:', 1 << 12);
    [controller.cardToolsTitle, controller.cardToolsDivider, controller.masteryTitle, controller.masteryDescription, controller.masterySwitch]
      .forEach(function (view) { section.addSubview(view); });
    controller.commentFoldDivider = new UIView({ x: 20, y: 118, width: 100, height: 1 });
    controller.commentFoldDivider.backgroundColor = UIColor.colorWithRedGreenBlueAlpha(227 / 255, 231 / 255, 237 / 255, 1);
    controller.commentFoldTitle = label('自动折叠查看原题', 16, true);
    controller.commentFoldDescription = label(FOLD_DESCRIPTION, 12, false);
    controller.commentFoldDescription.numberOfLines = 2;
    controller.commentFoldSwitch = new UISwitch({ x: 0, y: 211, width: 51, height: 31 });
    controller.commentFoldSwitch.addTargetActionForControlEvents(controller, 'toggleSourceCommentFold:', 1 << 12);
    controller.cardManagementDivider = new UIView({ x: 20, y: 194, width: 100, height: 1 });
    controller.cardManagementDivider.backgroundColor = UIColor.colorWithRedGreenBlueAlpha(227 / 255, 231 / 255, 237 / 255, 1);
    controller.cardManagementTitle = label('查看原题显示', 16, true);
    controller.cardManagementDescription = label(MANAGEMENT_DESCRIPTION, 12, false);
    controller.cardManagementChevron = label('›', 25, false); controller.cardManagementChevron.textAlignment = 1;
    controller.cardManagementButton = button(controller, '', 'openImportedCardManagement:');
    [controller.commentFoldDivider, controller.commentFoldTitle, controller.commentFoldDescription, controller.commentFoldSwitch,
      controller.cardManagementDivider, controller.cardManagementTitle, controller.cardManagementDescription,
      controller.cardManagementChevron, controller.cardManagementButton].forEach(view => section.addSubview(view));
    controller.repairCardsDivider = new UIView({ x: 20, y: 272, width: 100, height: 1 });
    controller.repairCardsDivider.backgroundColor = UIColor.colorWithRedGreenBlueAlpha(227 / 255, 231 / 255, 237 / 255, 1);
    controller.repairCardsTitle = label('修复题卡格式', 16, true);
    controller.repairCardsDescription = label('仅当前学习集：整理题卡格式与原题链接', 12, false);
    controller.repairCardsChevron = label('›', 25, false); controller.repairCardsChevron.textAlignment = 1;
    controller.repairCardsButton = button(controller, '', 'repairImportedCards:');
    [controller.repairCardsDivider, controller.repairCardsTitle, controller.repairCardsDescription,
      controller.repairCardsChevron, controller.repairCardsButton].forEach(view => section.addSubview(view));
    refresh(controller);
  }
  function refresh(controller) {
    if (controller.masterySwitch) controller.masterySwitch.on = __DAGUANYUAN_MASTERY_UI_GLOBAL__.enabled();
    if (controller.commentFoldSwitch) controller.commentFoldSwitch.on = typeof __DAGUANYUAN_COMMENT_FOLD_GLOBAL__ !== 'undefined' && __DAGUANYUAN_COMMENT_FOLD_GLOBAL__.enabled();
    [controller.cardManagementButton, controller.repairCardsButton, controller.commentFoldSwitch].forEach(view => { if (view) view.enabled = !controller.commentFoldOperation; });
  }
  function layout(controller, width) {
    if (!controller.cardToolsSettingsSection) return;
    controller.cardToolsSettingsSection.frame = { x: 20, y: 0, width, height: 350 };
    controller.cardToolsTitle.frame = { x: 20, y: 12, width: Math.max(0, width - 40), height: 28 };
    controller.cardToolsDivider.frame = { x: 20, y: 48, width: Math.max(0, width - 40), height: 1 };
    controller.masteryTitle.frame = { x: 20, y: 61, width: Math.max(0, width - 110), height: 24 };
    controller.masteryDescription.numberOfLines = 2;
    controller.masteryDescription.frame = { x: 20, y: 86, width: Math.max(0, width - 110), height: 30 };
    controller.masterySwitch.frame = { x: Math.max(20, width - 68), y: 69, width: 51, height: 31 };
    controller.commentFoldDivider.frame = { x: 20, y: 118, width: Math.max(0, width - 40), height: 1 };
    controller.commentFoldTitle.frame = { x: 20, y: 131, width: Math.max(0, width - 110), height: 24 };
    controller.commentFoldDescription.frame = { x: 20, y: 157, width: Math.max(0, width - 110), height: 30 };
    controller.commentFoldSwitch.frame = { x: Math.max(20, width - 68), y: 139, width: 51, height: 31 };
    controller.cardManagementDivider.frame = { x: 20, y: 194, width: Math.max(0, width - 40), height: 1 };
    controller.cardManagementTitle.frame = { x: 20, y: 207, width: Math.max(0, width - 80), height: 24 };
    controller.cardManagementDescription.frame = { x: 20, y: 233, width: Math.max(0, width - 80), height: 18 };
    controller.cardManagementChevron.frame = { x: Math.max(20, width - 52), y: 211.5, width: 30, height: 36 };
    controller.cardManagementButton.frame = { x: 0, y: 194, width, height: 78 };
    controller.repairCardsDivider.frame = { x: 20, y: 272, width: Math.max(0, width - 40), height: 1 };
    controller.repairCardsTitle.frame = { x: 20, y: 285, width: Math.max(0, width - 80), height: 24 };
    controller.repairCardsDescription.frame = { x: 20, y: 311, width: Math.max(0, width - 80), height: 18 };
    controller.repairCardsChevron.frame = { x: Math.max(20, width - 52), y: 289.5, width: 30, height: 36 };
    controller.repairCardsButton.frame = { x: 0, y: 272, width, height: 78 };
  }
  function toggle(controller) {
    try { __DAGUANYUAN_MASTERY_UI_GLOBAL__.setEnabled(controller.addon, Boolean(controller.masterySwitch.on)); }
    catch (error) { __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.showMessage(controller.addon, String(error.message || error)); }
    refresh(controller);
  }
  function hud(controller, message) { Application.sharedInstance().showHUD(message, controller.addon.window, 4); }
  function toggleFold(controller, sender) {
    if (controller.commentFoldOperation) { refresh(controller); return; }
    try { __DAGUANYUAN_COMMENT_FOLD_GLOBAL__.setEnabled(Boolean((sender || controller.commentFoldSwitch).on)); }
    catch (error) { hud(controller, String(error.message || error)); }
    refresh(controller);
  }
  function cancelFold(controller) {
    controller.commentFoldOperation = null;
    if (controller.commentFoldDescription) controller.commentFoldDescription.text = FOLD_DESCRIPTION;
    if (controller.cardManagementDescription) controller.cardManagementDescription.text = MANAGEMENT_DESCRIPTION;
    refresh(controller);
  }
  function busy(controller) {
    return controller.categoryImportBusy || controller.singleImportBusy || controller.questionToolBusy || controller.cardRepairState
      || controller.importTask && ['loading', 'confirm', 'running'].indexOf(controller.importTask.status) >= 0 && !controller.importTask.cancelled
      || controller.importWorkspaceTask && controller.importWorkspaceTask.status === 'running';
  }
  function foldExisting(controller, collapsed) {
    if (controller.activePage !== 'settings' || controller.commentFoldOperation) return;
    if (busy(controller)) { hud(controller, '请先完成当前导入、修复或题目操作'); return; }
    const operation = {}; controller.commentFoldOperation = operation; refresh(controller);
    const active = () => controller.commentFoldOperation === operation && controller.activePage === 'settings' && !busy(controller);
    function done() {
      cancelFold(controller);
    }
    Promise.resolve().then(function () {
      return __DAGUANYUAN_COMMENT_FOLD_GLOBAL__.batch(controller.addon, collapsed, function (result) {
        if (active()) controller.cardManagementDescription.text = '正在处理 ' + result.processed + ' / ' + result.total + ' 张题卡…';
      }, active);
    }).then(function (result) {
      if (controller.commentFoldOperation !== operation) return;
      done();
      hud(controller, (collapsed ? '已折叠 ' : '已展开 ') + result.changed + ' 张，原状态相同 ' + result.unchanged + ' 张'
        + (result.skipped ? '，跳过 ' + result.skipped + ' 张' : '')
        + (result.failed.length ? '，失败 ' + result.failed.length + ' 张：' + result.failed[0].reason : '')
        + (result.interrupted ? '；' + result.interrupted : ''));
    }).catch(function (error) {
      if (controller.commentFoldOperation !== operation) return;
      done(); hud(controller, '处理未完成：' + String(error.message || error));
    });
  }
  function openManagement(controller) {
    if (controller.activePage !== 'settings' || controller.commentFoldOperation) return;
    if (busy(controller)) { hud(controller, '请先完成当前导入、修复或题目操作'); return; }
    try {
      __DAGUANYUAN_CARD_LOCATOR_UI_GLOBAL__.chooseOption(controller, '查看原题显示',
        ['fold', 'unfold'], ['折叠查看原题', '展开查看原题'], null,
        'selectImportedCardManagement:', function (action) {
          if (controller.activePage !== 'settings') return;
          if (action === 'fold' || action === 'unfold') foldExisting(controller, action === 'fold');
        });
    } catch (error) { hud(controller, String(error.message || error)); }
  }
  function openRepair(controller) {
    if (controller.activePage !== 'settings' || controller.cardRepairState) return;
    if (controller.commentFoldOperation || busy(controller)) { hud(controller, '请先完成当前导入、修复或题目操作'); return; }
    __DAGUANYUAN_CARD_REPAIR_UI_GLOBAL__.repair(controller);
  }
  return { setup, layout, refresh, toggle, toggleFold, foldExisting, cancelFold, openManagement, openRepair };
})();
