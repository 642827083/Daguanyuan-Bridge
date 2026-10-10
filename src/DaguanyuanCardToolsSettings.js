var __DAGUANYUAN_CARD_TOOLS_SETTINGS_GLOBAL__ = (function () {
  function label(text, size, bold) {
    const view = new UILabel({ x: 0, y: 0, width: 100, height: 24 });
    view.text = text; view.font = bold ? UIFont.boldSystemFontOfSize(size) : UIFont.systemFontOfSize(size);
    view.textColor = bold ? UIColor.darkGrayColor() : UIColor.grayColor(); return view;
  }
  function setup(controller) {
    const section = new UIView({ x: 20, y: 1338, width: 100, height: 194 });
    section.backgroundColor = UIColor.whiteColor(); section.layer.cornerRadius = 10;
    section.layer.borderWidth = 0.5; section.layer.borderColor = UIColor.lightGrayColor().colorWithAlphaComponent(0.45);
    controller.cardToolsSettingsSection = section; controller.settingsPage.addSubview(section);
    controller.cardToolsTitle = label('题卡工具', 17, true);
    controller.cardToolsDivider = new UIView({ x: 20, y: 48, width: 100, height: 1 });
    controller.cardToolsDivider.backgroundColor = UIColor.lightGrayColor().colorWithAlphaComponent(0.4);
    controller.masteryTitle = label('掌握标记', 16, true);
    controller.masteryDescription = label('点击数学题卡，在卡片下方标记并同步到网站', 12, false);
    controller.masterySwitch = new UISwitch({ x: 0, y: 69, width: 51, height: 31 });
    controller.masterySwitch.addTargetActionForControlEvents(controller, 'toggleMasteryMarking:', 1 << 12);
    [controller.cardToolsTitle, controller.cardToolsDivider, controller.masteryTitle, controller.masteryDescription, controller.masterySwitch]
      .forEach(function (view) { section.addSubview(view); });
    refresh(controller);
  }
  function refresh(controller) { if (controller.masterySwitch) controller.masterySwitch.on = __DAGUANYUAN_MASTERY_UI_GLOBAL__.enabled(); }
  function layout(controller, width) {
    if (!controller.cardToolsSettingsSection) return;
    controller.cardToolsSettingsSection.frame = { x: 20, y: 1338, width, height: 194 };
    controller.cardToolsTitle.frame = { x: 20, y: 12, width: Math.max(0, width - 40), height: 28 };
    controller.cardToolsDivider.frame = { x: 20, y: 48, width: Math.max(0, width - 40), height: 1 };
    controller.masteryTitle.frame = { x: 20, y: 61, width: Math.max(0, width - 110), height: 24 };
    controller.masteryDescription.numberOfLines = 2;
    controller.masteryDescription.frame = { x: 20, y: 86, width: Math.max(0, width - 110), height: 30 };
    controller.masterySwitch.frame = { x: Math.max(20, width - 68), y: 69, width: 51, height: 31 };
  }
  function toggle(controller) {
    try { __DAGUANYUAN_MASTERY_UI_GLOBAL__.setEnabled(controller.addon, Boolean(controller.masterySwitch.on)); }
    catch (error) { __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.showMessage(controller.addon, String(error.message || error)); }
    refresh(controller);
  }
  return { setup, layout, refresh, toggle };
})();
