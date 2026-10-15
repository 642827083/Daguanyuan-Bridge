var __DAGUANYUAN_PLUGIN_INTEGRATION_SETTINGS_GLOBAL__ = (function () {
  function label(text, size, bold) {
    const view = new UILabel({ x: 0, y: 0, width: 100, height: 24 });
    view.text = text;
    view.font = bold ? UIFont.boldSystemFontOfSize(size) : UIFont.systemFontOfSize(size);
    view.textColor = bold ? UIColor.darkGrayColor() : UIColor.grayColor();
    return view;
  }

  function refresh(controller) {
    if (controller && controller.mnBrowserSwitch) controller.mnBrowserSwitch.on = __DAGUANYUAN_VIDEO_BROWSER_GLOBAL__.enabled();
  }

  function setup(controller) {
    const section = new UIView({ x: 20, y: 1200, width: 100, height: 124 });
    section.backgroundColor = UIColor.whiteColor(); section.layer.cornerRadius = 10;
    section.layer.borderWidth = 0.5; section.layer.borderColor = UIColor.lightGrayColor().colorWithAlphaComponent(0.45);
    controller.pluginIntegrationSettingsSection = section; controller.settingsPage.addSubview(section);
    controller.pluginIntegrationTitle = label("插件联动", 17, true);
    controller.pluginIntegrationDivider = new UIView({ x: 20, y: 48, width: 100, height: 1 });
    controller.pluginIntegrationDivider.backgroundColor = UIColor.lightGrayColor().colorWithAlphaComponent(0.4);
    controller.mnBrowserTitle = label("MN Browser", 16, true);
    controller.mnBrowserDescription = label("开启使用 MN Browser 播放视频，关闭跳转哔哩哔哩 App", 12, false);
    controller.mnBrowserDescription.numberOfLines = 2;
    controller.mnBrowserSwitch = new UISwitch({ x: 0, y: 69, width: 51, height: 31 });
    controller.mnBrowserSwitch.addTargetActionForControlEvents(controller, "toggleMNBrowserIntegration:", 1 << 12);
    [controller.pluginIntegrationTitle, controller.pluginIntegrationDivider, controller.mnBrowserTitle,
      controller.mnBrowserDescription, controller.mnBrowserSwitch].forEach(function (view) { section.addSubview(view); });
    refresh(controller);
  }

  function layout(controller, width) {
    const section = controller.pluginIntegrationSettingsSection;
    if (!section) return;
    const previous = (controller.cardToolsSettingsSection || controller.questionToolsSettingsSection).frame;
    section.frame = { x: 20, y: previous.y + previous.height + 12, width, height: 124 };
    controller.pluginIntegrationTitle.frame = { x: 20, y: 12, width: Math.max(0, width - 40), height: 28 };
    controller.pluginIntegrationDivider.frame = { x: 20, y: 48, width: Math.max(0, width - 40), height: 1 };
    controller.mnBrowserTitle.frame = { x: 20, y: 61, width: Math.max(0, width - 110), height: 24 };
    controller.mnBrowserDescription.frame = { x: 20, y: 86, width: Math.max(0, width - 110), height: 30 };
    controller.mnBrowserSwitch.frame = { x: Math.max(20, width - 68), y: 69, width: 51, height: 31 };
    const content = controller.settingsPage.frame;
    controller.settingsPage.contentSize = { width: content.width, height: Math.max(content.height + 1, section.frame.y + section.frame.height + 12) };
  }

  function toggle(controller, sender) {
    try {
      const requested = sender && typeof sender.on !== "undefined" ? Boolean(sender.on) : !__DAGUANYUAN_VIDEO_BROWSER_GLOBAL__.enabled();
      __DAGUANYUAN_VIDEO_BROWSER_GLOBAL__.setEnabled(requested);
    } catch (error) { __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.showMessage(controller.addon, String(error.message || error)); }
    refresh(controller);
  }

  return { setup, layout, refresh, toggle };
})();
