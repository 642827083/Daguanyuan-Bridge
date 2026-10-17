var __DAGUANYUAN_ABOUT_SETTINGS_GLOBAL__ = (function () {
  const GUIDE_URL = 'https://bbs.marginnote.com.cn/t/topic/68358';
  function label(text, size, bold) {
    const view = new UILabel({ x: 0, y: 0, width: 100, height: 24 });
    view.text = text; view.font = bold ? UIFont.boldSystemFontOfSize(size) : UIFont.systemFontOfSize(size);
    view.textColor = bold ? UIColor.colorWithRedGreenBlueAlpha(37 / 255, 40 / 255, 48 / 255, 1) : UIColor.colorWithRedGreenBlueAlpha(122 / 255, 129 / 255, 139 / 255, 1);
    return view;
  }
  function setup(controller) {
    const section = new UIView({ x: 20, y: 0, width: 100, height: 406 });
    section.backgroundColor = UIColor.whiteColor(); section.layer.cornerRadius = 12;
    section.layer.borderWidth = 1; section.layer.borderColor = UIColor.colorWithRedGreenBlueAlpha(227 / 255, 231 / 255, 237 / 255, 1);
    controller.aboutSettingsSection = section; controller.settingsPage.addSubview(section);
    controller.aboutSettingsTitle = label('关于插件', 17, true); section.addSubview(controller.aboutSettingsTitle);
    const info = typeof __DAGUANYUAN_PLUGIN_INFO__ === 'undefined' ? {} : __DAGUANYUAN_PLUGIN_INFO__;
    controller.aboutSettingsRows = [
      ['Daguanyuan Bridge', (info.version ? 'v' + info.version : '版本读取失败') + (info.author ? ' · ' + info.author : ''), null],
      ['重置窗口位置', '恢复插件窗口的默认位置与大小', 'resetSettingsPanelFrame:'],
      ['插件使用教程', '查看功能说明与使用方法', 'openPluginGuide:'],
      ['诊断日志', '导出、复制或清空日志，帮助排查插件问题', 'openDiagnosticLogs:'],
      ['支持项目', '喜欢此插件？请开发者喝杯咖啡，支持持续更新', 'openSupportProject:'],
    ].map(function (item) {
      const row = { title: label(item[0], 16, true), description: label(item[1], 12, false), divider: new UIView({ x: 20, y: 0, width: 100, height: 1 }) };
      row.divider.backgroundColor = UIColor.colorWithRedGreenBlueAlpha(227 / 255, 231 / 255, 237 / 255, 1);
      [row.divider, row.title, row.description].forEach(view => section.addSubview(view));
      if (item[2]) {
        row.chevron = label('›', 25, false); row.chevron.textAlignment = 1; section.addSubview(row.chevron);
        row.button = new UIButton({ x: 0, y: 0, width: 100, height: 70 });
        row.button.addTargetActionForControlEvents(controller, item[2], 1 << 0);
        section.addSubview(row.button);
      }
      return row;
    });
  }
  function layout(controller, width) {
    if (!controller.aboutSettingsSection) return;
    controller.aboutSettingsSection.frame = { x: 20, y: 0, width, height: 406 };
    controller.aboutSettingsTitle.frame = { x: 20, y: 12, width: Math.max(0, width - 40), height: 28 };
    controller.aboutSettingsRows.forEach(function (row, index) {
      const top = 48 + index * 70;
      row.divider.frame = { x: 20, y: top, width: Math.max(0, width - 40), height: 1 };
      row.title.frame = { x: 20, y: top + 13, width: Math.max(0, width - 80), height: 24 };
      row.description.frame = { x: 20, y: top + 39, width: Math.max(0, width - 80), height: 18 };
      if (row.button) {
        row.chevron.frame = { x: Math.max(20, width - 52), y: top + 17.5, width: 30, height: 36 };
        row.button.frame = { x: 0, y: top + 1, width, height: index === controller.aboutSettingsRows.length - 1 ? 77 : 69 };
      }
    });
  }
  function open(controller) {
    if (controller.activePage !== 'settings' || controller.settingsSection !== 'about') return;
    try {
      const url = NSURL.URLWithString(GUIDE_URL);
      const app = Application.sharedInstance();
      if (!url || !app || typeof app.openURL !== 'function') throw new Error('当前无法打开网页，请稍后重试');
      app.openURL(url);
    } catch (error) { Application.sharedInstance().showHUD(String(error.message || error), controller.addon.window, 3); }
  }
  return { setup, layout, open };
})();
