var __DAGUANYUAN_WEB_PANEL_GLOBAL__ = (function () {
  const DAGUANYUAN_HOME_URL = "https://cxyonly.fans/math";
  const OS408_HOME_URL = "https://www.408os.cn/overview";
  const FRAME_KEY = "cn.marginnote.daguanyuan-bridge.panel-frame";
  const PANEL_KEY = "cn.marginnote.daguanyuan-bridge.panel-visible";
  const TITLE_HEIGHT = 38;
  const DEFAULT_WIDTH = 960;
  const DEFAULT_HEIGHT = 680;
  const MIN_WIDTH = 560;
  const MIN_HEIGHT = 420;
  const MARGIN = 12;

  function targetStudyController(controller) {
    const window = controller.addon ? controller.addon.window : controller.addonWindow;
    return Application.sharedInstance().studyController(window);
  }

  function showMessage(controller, message) {
    Application.sharedInstance().showHUD(String(message), controller.addon.window, 2);
  }

  function safeFrame(frame, bounds) {
    const width = Math.min(Math.max(MIN_WIDTH, Number(frame && frame.width) || DEFAULT_WIDTH), bounds.width - MARGIN * 2);
    const height = Math.min(Math.max(MIN_HEIGHT, Number(frame && frame.height) || DEFAULT_HEIGHT), bounds.height - MARGIN * 2);
    const x = Math.max(bounds.x + MARGIN, Math.min(Number(frame && frame.x) || bounds.x + (bounds.width - width) / 2, bounds.x + bounds.width - width - MARGIN));
    const y = Math.max(bounds.y + MARGIN, Math.min(Number(frame && frame.y) || bounds.y + (bounds.height - height) / 2, bounds.y + bounds.height - height - MARGIN));
    return { x, y, width, height };
  }

  function savedFrame(controller) {
    const studyController = targetStudyController(controller);
    const bounds = studyController.view.bounds;
    const stored = NSUserDefaults.standardUserDefaults().objectForKey(FRAME_KEY);
    return safeFrame(stored, bounds);
  }

  function persistFrame(controller) {
    NSUserDefaults.standardUserDefaults().setObjectForKey(controller.view.frame, FRAME_KEY);
  }

  function performClosePanel(controller) {
    if (!controller || !controller.view) return;
    controller.panelVisible = false;
    controller.view.hidden = true;
    controller.view.removeFromSuperview();
    NSUserDefaults.standardUserDefaults().setObjectForKey(false, PANEL_KEY);

    NSTimer.scheduledTimerWithTimeInterval(0, false, function () {
      const studyController = targetStudyController(controller);
      if (studyController) studyController.refreshAddonCommands();
    });
  }

  function layout(controller) {
    const bounds = controller.view.bounds;
    const contentFrame = { x: 0, y: TITLE_HEIGHT, width: bounds.width, height: Math.max(0, bounds.height - TITLE_HEIGHT) };
    const tabsWidth = 232;
    const tabsX = Math.max(44, (bounds.width - tabsWidth) / 2);
    const sectionWidth = Math.max(0, bounds.width - 40);
    controller.containerView.frame = bounds;
    controller.titleBar.frame = { x: 0, y: 0, width: bounds.width, height: TITLE_HEIGHT };
    controller.closeButton.frame = { x: Math.max(0, bounds.width - 40), y: 2, width: 34, height: 34 };
    controller.homeButton.frame = { x: tabsX, y: 4, width: 68, height: 30 };
    controller.os408Button.frame = { x: tabsX + 80, y: 4, width: 68, height: 30 };
    controller.settingsButton.frame = { x: tabsX + 160, y: 4, width: 72, height: 30 };
    controller.webView.frame = contentFrame;
    controller.settingsPage.frame = contentFrame;
    controller.focusSettingsSection.frame = { x: 20, y: 18, width: sectionWidth, height: 406 };
    controller.focusSectionTitle.frame = { x: 20, y: 12, width: Math.max(0, sectionWidth - 40), height: 28 };
    controller.focusDivider.frame = { x: 20, y: 48, width: Math.max(0, sectionWidth - 40), height: 1 };
    controller.focusEnabledTitle.frame = { x: 20, y: 61, width: Math.max(0, sectionWidth - 110), height: 24 };
    controller.focusEnabledDescription.frame = { x: 20, y: 87, width: Math.max(0, sectionWidth - 110), height: 18 };
    controller.focusEnabledSwitch.frame = { x: Math.max(20, sectionWidth - 68), y: 69, width: 51, height: 31 };
    controller.focusOptionDivider.frame = { x: 20, y: 118, width: Math.max(0, sectionWidth - 40), height: 1 };
    controller.crossLevelTitle.frame = { x: 20, y: 131, width: Math.max(0, sectionWidth - 110), height: 24 };
    controller.crossLevelDescription.frame = { x: 20, y: 157, width: Math.max(0, sectionWidth - 110), height: 18 };
    controller.crossLevelSwitch.frame = { x: Math.max(20, sectionWidth - 68), y: 139, width: 51, height: 31 };
    controller.crossLevelDivider.frame = { x: 20, y: 188, width: Math.max(0, sectionWidth - 40), height: 1 };
    controller.progressTitle.frame = { x: 20, y: 201, width: Math.max(0, sectionWidth - 110), height: 24 };
    controller.progressDescription.frame = { x: 20, y: 227, width: Math.max(0, sectionWidth - 110), height: 18 };
    controller.progressSwitch.frame = { x: Math.max(20, sectionWidth - 68), y: 209, width: 51, height: 31 };
    controller.progressDivider.frame = { x: 20, y: 258, width: Math.max(0, sectionWidth - 40), height: 1 };
    controller.categoryTitle.frame = { x: 20, y: 271, width: Math.max(0, sectionWidth - 110), height: 24 };
    controller.categoryDescription.frame = { x: 20, y: 297, width: Math.max(0, sectionWidth - 110), height: 18 };
    controller.categorySwitch.frame = { x: Math.max(20, sectionWidth - 68), y: 279, width: 51, height: 31 };
    controller.categoryDivider.frame = { x: 20, y: 328, width: Math.max(0, sectionWidth - 40), height: 1 };
    controller.previousTitle.frame = { x: 20, y: 341, width: Math.max(0, sectionWidth - 110), height: 24 };
    controller.previousDescription.frame = { x: 20, y: 367, width: Math.max(0, sectionWidth - 110), height: 18 };
    controller.previousSwitch.frame = { x: Math.max(20, sectionWidth - 68), y: 349, width: 51, height: 31 };
    controller.resizeHandle.frame = { x: Math.max(0, bounds.width - 30), y: Math.max(0, bounds.height - 30), width: 30, height: 30 };
    controller.resizeGlyph.frame = { x: 0, y: 0, width: 30, height: 30 };
  }

  function button(title, controller, selector) {
    const result = new UIButton({ x: 0, y: 0, width: 80, height: 30 });
    result.setTitleForState(title, 0);
    result.setTitleColorForState(UIColor.colorWithRedGreenBlueAlpha(0.1, 0.36, 0.72, 1), 0);
    result.titleLabel.font = UIFont.boldSystemFontOfSize(14);
    result.addTargetActionForControlEvents(controller, selector, 1 << 0);
    return result;
  }

  function label(text, font, color) {
    const result = new UILabel({ x: 0, y: 0, width: 100, height: 24 });
    result.text = text;
    result.font = font;
    result.textColor = color;
    return result;
  }

  function refreshTabStyle(controller) {
    if (!controller || !controller.homeButton) return;
    const activeColor = UIColor.colorWithWhiteAlpha(0.9, 1);
    const inactiveColor = UIColor.colorWithWhiteAlpha(1, 0);
    const accentColor = UIColor.colorWithRedGreenBlueAlpha(0.1, 0.36, 0.72, 1);
    const normalColor = UIColor.darkGrayColor();
    const tabs = [
      { name: "math", button: controller.homeButton },
      { name: "408", button: controller.os408Button },
      { name: "settings", button: controller.settingsButton },
    ];
    tabs.forEach(function (tab) {
      const active = controller.activePage === tab.name;
      tab.button.backgroundColor = active ? activeColor : inactiveColor;
      tab.button.setTitleColorForState(active ? accentColor : normalColor, 0);
      tab.button.layer.cornerRadius = 15;
    });
  }

  function setActivePage(controller, page) {
    if (!controller || !controller.webView || !controller.settingsPage) return;
    controller.activePage = page;
    controller.webView.hidden = page === "settings";
    controller.settingsPage.hidden = page !== "settings";
    if (page === "settings") {
      refreshFocusSetting(controller);
      refreshCrossLevelSetting(controller);
      refreshProgressSetting(controller);
      refreshCategorySetting(controller);
      refreshPreviousSetting(controller);
    }
    refreshTabStyle(controller);
  }

  function refreshFocusSetting(controller) {
    if (!controller || !controller.focusEnabledSwitch) return;
    const enabled = !controller.addon || controller.addon.focusNavigationEnabled !== false;
    controller.focusEnabledSwitch.on = enabled;
  }

  function refreshPreviousSetting(controller) {
    if (!controller || !controller.previousSwitch) return;
    controller.previousSwitch.on = __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.previousEnabled();
  }

  function refreshProgressSetting(controller) {
    if (!controller || !controller.progressSwitch) return;
    controller.progressSwitch.on = __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.progressEnabled();
  }

  function refreshCategorySetting(controller) {
    if (!controller || !controller.categorySwitch) return;
    controller.categorySwitch.on = __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.categoryEnabled();
  }

  function refreshCrossLevelSetting(controller) {
    if (!controller || !controller.crossLevelSwitch) return;
    controller.crossLevelSwitch.on = __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.crossLevelEnabled();
  }

  function setup(controller) {
    controller.view = new UIView({ x: 0, y: 0, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
    controller.view.backgroundColor = UIColor.whiteColor();
    controller.view.layer.cornerRadius = 8;
    controller.view.layer.borderWidth = 0.5;
    controller.view.layer.borderColor = UIColor.lightGrayColor().colorWithAlphaComponent(0.5);
    controller.view.layer.masksToBounds = true;

    controller.containerView = new UIView({ x: 0, y: 0, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
    controller.view.addSubview(controller.containerView);

    controller.titleBar = new UIView({ x: 0, y: 0, width: DEFAULT_WIDTH, height: TITLE_HEIGHT });
    controller.titleBar.backgroundColor = UIColor.colorWithWhiteAlpha(0.96, 1);
    controller.containerView.addSubview(controller.titleBar);

    controller.closeButton = button("×", controller, "closePanel:");
    controller.closeButton.titleLabel.font = UIFont.systemFontOfSize(24);
    controller.closeButton.setTitleColorForState(UIColor.darkGrayColor(), 0);
    controller.titleBar.addSubview(controller.closeButton);

    controller.homeButton = button("数学", controller, "openDaguanyuan:");
    controller.titleBar.addSubview(controller.homeButton);

    controller.os408Button = button("408", controller, "open408:");
    controller.titleBar.addSubview(controller.os408Button);

    controller.settingsButton = button("设置", controller, "openSettings:");
    controller.titleBar.addSubview(controller.settingsButton);

    const pan = new UIPanGestureRecognizer(controller, "movePanel:");
    controller.titleBar.addGestureRecognizer(pan);

    controller.webView = new UIWebView({ x: 0, y: TITLE_HEIGHT, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT - TITLE_HEIGHT });
    controller.webView.backgroundColor = UIColor.whiteColor();
    controller.webView.scalesPageToFit = true;
    controller.webView.delegate = controller;
    controller.containerView.addSubview(controller.webView);

    controller.settingsPage = new UIView({ x: 0, y: TITLE_HEIGHT, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT - TITLE_HEIGHT });
    controller.settingsPage.backgroundColor = UIColor.colorWithWhiteAlpha(0.96, 1);
    controller.settingsPage.hidden = true;
    controller.containerView.addSubview(controller.settingsPage);

    controller.focusSettingsSection = new UIView({ x: 20, y: 18, width: DEFAULT_WIDTH - 40, height: 406 });
    controller.focusSettingsSection.backgroundColor = UIColor.whiteColor();
    controller.focusSettingsSection.layer.cornerRadius = 10;
    controller.focusSettingsSection.layer.borderWidth = 0.5;
    controller.focusSettingsSection.layer.borderColor = UIColor.lightGrayColor().colorWithAlphaComponent(0.45);
    controller.settingsPage.addSubview(controller.focusSettingsSection);

    controller.focusSectionTitle = label("焦点切换", UIFont.boldSystemFontOfSize(17), UIColor.darkGrayColor());
    controller.focusSettingsSection.addSubview(controller.focusSectionTitle);

    controller.focusDivider = new UIView({ x: 20, y: 48, width: DEFAULT_WIDTH - 80, height: 1 });
    controller.focusDivider.backgroundColor = UIColor.lightGrayColor().colorWithAlphaComponent(0.4);
    controller.focusSettingsSection.addSubview(controller.focusDivider);

    controller.focusEnabledTitle = label("启用焦点切换", UIFont.boldSystemFontOfSize(16), UIColor.darkGrayColor());
    controller.focusSettingsSection.addSubview(controller.focusEnabledTitle);

    controller.focusEnabledDescription = label("在同级卡片之间显示浮动导航按钮", UIFont.systemFontOfSize(12), UIColor.grayColor());
    controller.focusSettingsSection.addSubview(controller.focusEnabledDescription);

    controller.focusEnabledSwitch = new UISwitch({ x: DEFAULT_WIDTH - 108, y: 69, width: 51, height: 31 });
    controller.focusEnabledSwitch.addTargetActionForControlEvents(controller, "toggleFocusNavigation:", 1 << 12);
    controller.focusSettingsSection.addSubview(controller.focusEnabledSwitch);

    controller.focusOptionDivider = new UIView({ x: 20, y: 118, width: DEFAULT_WIDTH - 80, height: 1 });
    controller.focusOptionDivider.backgroundColor = UIColor.lightGrayColor().colorWithAlphaComponent(0.4);
    controller.focusSettingsSection.addSubview(controller.focusOptionDivider);

    controller.crossLevelTitle = label("跨层级切换", UIFont.boldSystemFontOfSize(16), UIColor.darkGrayColor());
    controller.focusSettingsSection.addSubview(controller.crossLevelTitle);

    controller.crossLevelDescription = label("按脑图层级连续切换全部卡片", UIFont.systemFontOfSize(12), UIColor.grayColor());
    controller.focusSettingsSection.addSubview(controller.crossLevelDescription);

    controller.crossLevelSwitch = new UISwitch({ x: DEFAULT_WIDTH - 108, y: 139, width: 51, height: 31 });
    controller.crossLevelSwitch.addTargetActionForControlEvents(controller, "toggleCrossLevelNavigation:", 1 << 12);
    controller.focusSettingsSection.addSubview(controller.crossLevelSwitch);

    controller.crossLevelDivider = new UIView({ x: 20, y: 188, width: DEFAULT_WIDTH - 80, height: 1 });
    controller.crossLevelDivider.backgroundColor = UIColor.lightGrayColor().colorWithAlphaComponent(0.4);
    controller.focusSettingsSection.addSubview(controller.crossLevelDivider);

    controller.progressTitle = label("显示做题进度", UIFont.boldSystemFontOfSize(16), UIColor.darkGrayColor());
    controller.focusSettingsSection.addSubview(controller.progressTitle);

    controller.progressDescription = label("在上一张和下一张按钮中显示当前同级位置", UIFont.systemFontOfSize(12), UIColor.grayColor());
    controller.focusSettingsSection.addSubview(controller.progressDescription);

    controller.progressSwitch = new UISwitch({ x: DEFAULT_WIDTH - 108, y: 209, width: 51, height: 31 });
    controller.progressSwitch.addTargetActionForControlEvents(controller, "toggleProgressDisplay:", 1 << 12);
    controller.focusSettingsSection.addSubview(controller.progressSwitch);

    controller.progressDivider = new UIView({ x: 20, y: 258, width: DEFAULT_WIDTH - 80, height: 1 });
    controller.progressDivider.backgroundColor = UIColor.lightGrayColor().colorWithAlphaComponent(0.4);
    controller.focusSettingsSection.addSubview(controller.progressDivider);

    controller.categoryTitle = label("显示题型分类", UIFont.boldSystemFontOfSize(16), UIColor.darkGrayColor());
    controller.focusSettingsSection.addSubview(controller.categoryTitle);

    controller.categoryDescription = label("显示当前焦点卡片的直属父节点标题", UIFont.systemFontOfSize(12), UIColor.grayColor());
    controller.focusSettingsSection.addSubview(controller.categoryDescription);

    controller.categorySwitch = new UISwitch({ x: DEFAULT_WIDTH - 108, y: 279, width: 51, height: 31 });
    controller.categorySwitch.addTargetActionForControlEvents(controller, "toggleCategoryDisplay:", 1 << 12);
    controller.focusSettingsSection.addSubview(controller.categorySwitch);

    controller.categoryDivider = new UIView({ x: 20, y: 328, width: DEFAULT_WIDTH - 80, height: 1 });
    controller.categoryDivider.backgroundColor = UIColor.lightGrayColor().colorWithAlphaComponent(0.4);
    controller.focusSettingsSection.addSubview(controller.categoryDivider);

    controller.previousTitle = label("显示上一张", UIFont.boldSystemFontOfSize(16), UIColor.darkGrayColor());
    controller.focusSettingsSection.addSubview(controller.previousTitle);

    controller.previousDescription = label("关闭后只显示下一张浮动按钮", UIFont.systemFontOfSize(12), UIColor.grayColor());
    controller.focusSettingsSection.addSubview(controller.previousDescription);

    controller.previousSwitch = new UISwitch({ x: DEFAULT_WIDTH - 108, y: 349, width: 51, height: 31 });
    controller.previousSwitch.addTargetActionForControlEvents(controller, "togglePreviousButton:", 1 << 12);
    controller.focusSettingsSection.addSubview(controller.previousSwitch);

    controller.resizeHandle = new UIView({ x: DEFAULT_WIDTH - 30, y: DEFAULT_HEIGHT - 30, width: 30, height: 30 });
    controller.resizeHandle.backgroundColor = UIColor.colorWithWhiteAlpha(0.96, 0.94);
    controller.resizeHandle.layer.cornerRadius = 6;
    controller.containerView.addSubview(controller.resizeHandle);

    controller.resizeGlyph = new UILabel({ x: 0, y: 0, width: 30, height: 30 });
    controller.resizeGlyph.text = "↘";
    controller.resizeGlyph.textAlignment = 1;
    controller.resizeGlyph.font = UIFont.boldSystemFontOfSize(16);
    controller.resizeGlyph.textColor = UIColor.darkGrayColor().colorWithAlphaComponent(0.7);
    controller.resizeHandle.addSubview(controller.resizeGlyph);

    const resizePan = new UIPanGestureRecognizer(controller, "resizePanel:");
    controller.resizeHandle.addGestureRecognizer(resizePan);

    controller.activePage = "math";
    controller.currentContentPage = "";
    refreshFocusSetting(controller);
    refreshCrossLevelSetting(controller);
    refreshProgressSetting(controller);
    refreshCategorySetting(controller);
    refreshPreviousSetting(controller);
    refreshTabStyle(controller);
    layout(controller);
  }

  function loadURL(controller, urlString, provider) {
    const url = NSURL.URLWithString(urlString);
    if (!url) throw new Error("题库地址无效");
    const normalizedProvider = String(provider || "daguanyuan");
    controller.currentContentPage = normalizedProvider === "408os" ? "408" : "math";
    setActivePage(controller, controller.currentContentPage);
    controller.webView.loadRequest(NSURLRequest.requestWithURL(url));
  }

  function videoPopupCompatibilityScript() {
    return `(function () {
      if (window.__DAGUANYUAN_VIDEO_POPUP_COMPATIBLE__) return true;
      window.__DAGUANYUAN_VIDEO_POPUP_COMPATIBLE__ = true;
      function openHere(url) {
        var value = String(url || "").trim();
        if (!/^https?:\/\//i.test(value)) return false;
        window.location.href = value;
        return true;
      }
      var originalOpen = window.open;
      window.open = function (url) {
        if (openHere(url)) return window;
        return originalOpen ? originalOpen.apply(window, arguments) : null;
      };
      document.addEventListener("click", function (event) {
        var node = event.target;
        while (node && String(node.tagName || "").toUpperCase() !== "A") node = node.parentNode;
        if (!node || String(node.getAttribute("target") || "").toLowerCase() !== "_blank") return;
        if (!openHere(node.href || node.getAttribute("href"))) return;
        event.preventDefault();
      }, true);
      return true;
    })();`;
  }

  function injectVideoPopupCompatibility(controller) {
    controller.webView.evaluateJavaScript(videoPopupCompatibilityScript(), function (result, error) {
      if (error) console.log(`[Daguanyuan Bridge] 注入视频跳转兼容失败：${error.localizedDescription || error}`);
    });
  }

  const panelClass = JSB.defineClass("DaguanyuanBridgePanelController : UIViewController <UIWebViewDelegate>", {
    viewDidLoad: function () {
      setup(self);
      loadURL(self, DAGUANYUAN_HOME_URL);
    },

    viewDidLayoutSubviews: function () {
      layout(self);
    },

    openDaguanyuan: function () {
      if (self.currentContentPage === "math") setActivePage(self, "math");
      else loadURL(self, DAGUANYUAN_HOME_URL, "daguanyuan");
    },

    open408: function () {
      if (self.currentContentPage === "408") setActivePage(self, "408");
      else loadURL(self, OS408_HOME_URL, "408os");
    },

    openSettings: function (sender) {
      setActivePage(self, "settings");
    },

    toggleFocusNavigation: function (sender) {
      const addon = self.addon;
      if (!addon) {
        showMessage(self, "焦点导航当前不可用");
        return;
      }
      const requested = sender && typeof sender.on !== "undefined"
        ? Boolean(sender.on)
        : !(addon.focusNavigationEnabled !== false);
      addon.focusNavigationEnabled = __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.setEnabled(requested);
      if (addon.focusNavigationEnabled) __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.show(addon);
      else __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.hide(addon);
      refreshFocusSetting(self);
    },

    togglePreviousButton: function (sender) {
      const requested = sender && typeof sender.on !== "undefined"
        ? Boolean(sender.on)
        : !__DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.previousEnabled();
      __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.setPreviousEnabled(requested);
      if (self.addon && self.addon.focusNavigationEnabled !== false) {
        __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.show(self.addon);
      }
      refreshPreviousSetting(self);
    },

    toggleProgressDisplay: function (sender) {
      const requested = sender && typeof sender.on !== "undefined"
        ? Boolean(sender.on)
        : !__DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.progressEnabled();
      __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.setProgressEnabled(requested);
      if (self.addon && self.addon.focusNavigationEnabled !== false) {
        __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.show(self.addon);
      }
      refreshProgressSetting(self);
    },

    toggleCategoryDisplay: function (sender) {
      const requested = sender && typeof sender.on !== "undefined"
        ? Boolean(sender.on)
        : !__DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.categoryEnabled();
      __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.setCategoryEnabled(requested);
      if (self.addon && self.addon.focusNavigationEnabled !== false) {
        __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.show(self.addon);
      }
      refreshCategorySetting(self);
    },

    toggleCrossLevelNavigation: function (sender) {
      const requested = sender && typeof sender.on !== "undefined"
        ? Boolean(sender.on)
        : !__DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.crossLevelEnabled();
      __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.setCrossLevelEnabled(requested);
      refreshCrossLevelSetting(self);
    },

    closePanel: function (sender) {
      performClosePanel(self);
    },

    movePanel: function (recognizer) {
      const superview = self.view.superview;
      if (!superview) return;
      const translation = recognizer.translationInView(superview);
      const center = self.view.center;
      self.view.center = { x: center.x + translation.x, y: center.y + translation.y };
      recognizer.setTranslationInView({ x: 0, y: 0 }, superview);
      if (recognizer.state === 3) persistFrame(self);
    },

    resizePanel: function (recognizer) {
      const superview = self.view.superview;
      if (!superview) return;
      const translation = recognizer.translationInView(superview);
      const frame = self.view.frame;
      const resizedFrame = {
        x: frame.x,
        y: frame.y,
        width: frame.width + translation.x,
        height: frame.height + translation.y,
      };
      self.view.frame = safeFrame(resizedFrame, superview.bounds);
      layout(self);
      recognizer.setTranslationInView({ x: 0, y: 0 }, superview);
      if (recognizer.state === 3) persistFrame(self);
    },

    webViewDidFinishLoad: function () {
      injectVideoPopupCompatibility(self);
    },

    webViewDidFailLoadWithError: function (webView, error) {
      console.log(`[Daguanyuan Bridge] 页面加载失败：${error && error.localizedDescription || error}`);
    },

  });

  function createController(addon) {
    const controller = panelClass.new();
    controller.addon = addon;
    controller.addonWindow = addon.window;
    controller.panelVisible = false;
    return controller;
  }

  function isPanelVisible(controller) {
    return !!(controller && controller.panelVisible === true);
  }

  function showPanel(controller) {
    const studyController = targetStudyController(controller);
    if (!studyController || !studyController.view) throw new Error("当前学习窗口不可用");
    if (!controller.view.superview) studyController.view.addSubview(controller.view);
    controller.view.frame = savedFrame(controller);
    controller.view.hidden = false;
    controller.panelVisible = true;
    NSUserDefaults.standardUserDefaults().setObjectForKey(true, PANEL_KEY);
    setActivePage(controller, controller.activePage || controller.currentContentPage || "math");
    refreshFocusSetting(controller);
    refreshCrossLevelSetting(controller);
    refreshProgressSetting(controller);
    refreshCategorySetting(controller);
    refreshPreviousSetting(controller);
  }

  function hidePanel(controller) {
    performClosePanel(controller);
  }

  function shouldRestorePanel() {
    return NSUserDefaults.standardUserDefaults().objectForKey(PANEL_KEY) === true;
  }

  return {
    createController,
    isPanelVisible,
    showPanel,
    hidePanel,
    shouldRestorePanel,
    refreshFocusSetting,
    refreshCrossLevelSetting,
    refreshProgressSetting,
    refreshCategorySetting,
    refreshPreviousSetting,
  };
})();
