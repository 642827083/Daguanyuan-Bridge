var __DAGUANYUAN_PLUGIN_INTEGRATION_SETTINGS_GLOBAL__ = (function () {
  function label(text, size, bold) {
    const view = new UILabel({ x: 0, y: 0, width: 100, height: 24 });
    view.text = text;
    view.font = bold ? UIFont.boldSystemFontOfSize(size) : UIFont.systemFontOfSize(size);
    view.textColor = bold ? UIColor.colorWithRedGreenBlueAlpha(37 / 255, 40 / 255, 48 / 255, 1) : UIColor.colorWithRedGreenBlueAlpha(122 / 255, 129 / 255, 139 / 255, 1);
    return view;
  }

  function refresh(controller) {
    if (controller && controller.mnBrowserSwitch) controller.mnBrowserSwitch.on = __DAGUANYUAN_VIDEO_BROWSER_GLOBAL__.enabled();
  }

  function setup(controller) {
    const section = controller.questionToolsSettingsSection;
    controller.pluginIntegrationDivider = new UIView({ x: 20, y: 546, width: 100, height: 1 });
    controller.pluginIntegrationDivider.backgroundColor = UIColor.colorWithRedGreenBlueAlpha(227 / 255, 231 / 255, 237 / 255, 1);
    controller.mnBrowserTitle = label("MN Browser", 16, true);
    controller.mnBrowserDescription = label("开启使用 MN Browser 播放视频，关闭跳转哔哩哔哩 App", 12, false);
    controller.mnBrowserDescription.numberOfLines = 2;
    controller.mnBrowserSwitch = new UISwitch({ x: 0, y: 69, width: 51, height: 31 });
    controller.mnBrowserSwitch.addTargetActionForControlEvents(controller, "toggleMNBrowserIntegration:", 1 << 12);
    [controller.pluginIntegrationDivider, controller.mnBrowserTitle,
      controller.mnBrowserDescription, controller.mnBrowserSwitch].forEach(function (view) { section.addSubview(view); });
    refresh(controller);
  }

  function layout(controller, width) {
    const section = controller.questionToolsSettingsSection;
    if (!section) return;
    controller.pluginIntegrationDivider.frame = { x: 20, y: 546, width: Math.max(0, width - 40), height: 1 };
    controller.mnBrowserTitle.frame = { x: 20, y: 559, width: Math.max(0, width - 110), height: 24 };
    controller.mnBrowserDescription.frame = { x: 20, y: 585, width: Math.max(0, width - 110), height: 30 };
    controller.mnBrowserSwitch.frame = { x: Math.max(20, width - 68), y: 567, width: 51, height: 31 };
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
