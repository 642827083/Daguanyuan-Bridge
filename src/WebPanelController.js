var __DAGUANYUAN_WEB_PANEL_GLOBAL__ = (function () {
  const DAGUANYUAN_HOME_URL = "https://cxyonly.fans/math";
  const OS408_HOME_URL = "https://www.408os.cn/overview";
  const FRAME_KEY = "cn.marginnote.daguanyuan-bridge.panel-frame";
  const PANEL_KEY = "cn.marginnote.daguanyuan-bridge.panel-visible";
  const WEBSITE_LOCATE_KEY = "cn.marginnote.daguanyuan-bridge.question-navigation.website-locate-card-visible";
  const CATEGORY_IMPORT_KEY = "cn.marginnote.daguanyuan-bridge.question-navigation.import-category-visible";
  const SELECTION_IMPORT_KEY = "cn.marginnote.daguanyuan-bridge.question-tools.import-selection-visible";
  const SINGLE_IMPORT_KEY = "cn.marginnote.daguanyuan-bridge.question-tools.import-single-visible";
  const TITLE_HEIGHT = 38;
  const DEFAULT_WIDTH = 960;
  const DEFAULT_HEIGHT = 656;
  const MIN_WIDTH = 560;
  const MIN_HEIGHT = 420;
  const MARGIN = 12;
  const TOP_CLEARANCE = 80;

  function targetStudyController(controller) {
    const window = controller.addon ? controller.addon.window : controller.addonWindow;
    return Application.sharedInstance().studyController(window);
  }

  function showMessage(controller, message) {
    Application.sharedInstance().showHUD(String(message), controller.addon.window, 2);
  }

  function safeFrame(frame, bounds) {
    const topMargin = Math.min(TOP_CLEARANCE, Math.max(MARGIN, bounds.height - MARGIN - 1));
    const availableHeight = Math.max(1, bounds.height - topMargin - MARGIN);
    const width = Math.min(Math.max(MIN_WIDTH, Number(frame && frame.width) || DEFAULT_WIDTH), bounds.width - MARGIN * 2);
    const height = Math.min(Math.max(MIN_HEIGHT, Number(frame && frame.height) || DEFAULT_HEIGHT), availableHeight);
    const x = Math.max(bounds.x + MARGIN, Math.min(Number(frame && frame.x) || bounds.x + (bounds.width - width) / 2, bounds.x + bounds.width - width - MARGIN));
    const y = Math.max(bounds.y + topMargin, Math.min(Number(frame && frame.y) || bounds.y + topMargin, bounds.y + bounds.height - height - MARGIN));
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

  function resetPanelFrame(controller) {
    try {
      const bounds = targetStudyController(controller).view.bounds;
      controller.view.frame = safeFrame(null, bounds);
      layout(controller);
      persistFrame(controller);
      showMessage(controller, '已恢复窗口位置与大小');
    } catch (error) { showMessage(controller, String(error && error.message || error)); }
  }

  function performClosePanel(controller) {
    if (!controller || !controller.view) return;
    if (controller.importWorkspaceTask) __DAGUANYUAN_IMPORT_WORKSPACE_GLOBAL__.close(controller);
    if (controller.importTask) __DAGUANYUAN_IMPORT_SELECTION_GLOBAL__.close(controller);
    __DAGUANYUAN_CARD_LOCATOR_UI_GLOBAL__.cancelMode(controller);
    if (typeof __DAGUANYUAN_CARD_REPAIR_UI_GLOBAL__ !== 'undefined') __DAGUANYUAN_CARD_REPAIR_UI_GLOBAL__.cancel(controller);
    if (typeof __DAGUANYUAN_CARD_TOOLS_SETTINGS_GLOBAL__ !== 'undefined') __DAGUANYUAN_CARD_TOOLS_SETTINGS_GLOBAL__.cancelFold(controller);
    if (typeof __DAGUANYUAN_SETTINGS_NAVIGATION_GLOBAL__ !== 'undefined') __DAGUANYUAN_SETTINGS_NAVIGATION_GLOBAL__.stop(controller);
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
    const tabsWidth = 312;
    const tabsX = Math.max(44, (bounds.width - tabsWidth) / 2);
    const sectionWidth = Math.max(0, bounds.width - 40);
    controller.containerView.frame = bounds;
    controller.titleBar.frame = { x: 0, y: 0, width: bounds.width, height: TITLE_HEIGHT };
    controller.closeButton.frame = { x: Math.max(0, bounds.width - 40), y: 2, width: 34, height: 34 };
    controller.homeButton.frame = { x: tabsX, y: 4, width: 68, height: 30 };
    controller.os408Button.frame = { x: tabsX + 80, y: 4, width: 68, height: 30 };
    controller.importButton.frame = { x: tabsX + 160, y: 4, width: 68, height: 30 };
    controller.settingsButton.frame = { x: tabsX + 240, y: 4, width: 72, height: 30 };
    controller.webView.frame = contentFrame;
    controller.importWebView.frame = contentFrame;
    if (!controller.settingsNavigation) {
      controller.settingsPage.frame = contentFrame;
      controller.settingsPage.contentSize = { width: contentFrame.width, height: Math.max(contentFrame.height + 1, 710) };
    }
    __DAGUANYUAN_CATEGORY_MANAGER_UI_GLOBAL__.layout(controller, contentFrame);
    controller.categorySettingsSection.frame = { x: 20, y: 0, width: sectionWidth, height: 406 };
    controller.questionToolsSettingsSection.frame = { x: 20, y: 0, width: sectionWidth, height: 624 };
    if (typeof __DAGUANYUAN_CARD_TOOLS_SETTINGS_GLOBAL__ !== 'undefined') __DAGUANYUAN_CARD_TOOLS_SETTINGS_GLOBAL__.layout(controller, sectionWidth);
    if (typeof __DAGUANYUAN_PLUGIN_INTEGRATION_SETTINGS_GLOBAL__ !== 'undefined') __DAGUANYUAN_PLUGIN_INTEGRATION_SETTINGS_GLOBAL__.layout(controller, sectionWidth);
    if (typeof __DAGUANYUAN_ABOUT_SETTINGS_GLOBAL__ !== 'undefined') __DAGUANYUAN_ABOUT_SETTINGS_GLOBAL__.layout(controller, sectionWidth);
    controller.categorySectionTitle.frame = { x: 20, y: 12, width: Math.max(0, sectionWidth - 40), height: 28 };
    controller.categorySectionDivider.frame = { x: 20, y: 48, width: Math.max(0, sectionWidth - 40), height: 1 };
    controller.categoryTitle.frame = { x: 20, y: 131, width: Math.max(0, sectionWidth - 110), height: 24 };
    controller.categoryDescription.frame = { x: 20, y: 157, width: Math.max(0, sectionWidth - 110), height: 18 };
    controller.categorySwitch.frame = { x: Math.max(20, sectionWidth - 68), y: 139, width: 51, height: 31 };
    controller.categoryDivider.frame = { x: 20, y: 188, width: Math.max(0, sectionWidth - 40), height: 1 };
    controller.categoryJumpTitle.frame = { x: 20, y: 201, width: Math.max(0, sectionWidth - 110), height: 24 };
    controller.categoryJumpDescription.frame = { x: 20, y: 227, width: Math.max(0, sectionWidth - 110), height: 18 };
    controller.categoryJumpSwitch.frame = { x: Math.max(20, sectionWidth - 68), y: 209, width: 51, height: 31 };
    controller.bindCategoryDivider.frame = { x: 20, y: 258, width: Math.max(0, sectionWidth - 40), height: 1 };
    controller.bindCategoryTitle.frame = { x: 20, y: 271, width: Math.max(0, sectionWidth - 110), height: 24 };
    controller.bindCategoryDescription.frame = { x: 20, y: 297, width: Math.max(0, sectionWidth - 110), height: 18 };
    controller.bindCategorySwitch.frame = { x: Math.max(20, sectionWidth - 68), y: 279, width: 51, height: 31 };
    controller.categoryManageDivider.frame = { x: 20, y: 328, width: Math.max(0, sectionWidth - 40), height: 1 };
    controller.categoryManageTitle.frame = { x: 20, y: 341, width: Math.max(0, sectionWidth - 90), height: 24 };
    controller.categoryManageDescription.frame = { x: 20, y: 367, width: Math.max(0, sectionWidth - 90), height: 18 };
    controller.categoryManageChevron.frame = { x: Math.max(20, sectionWidth - 52), y: 343, width: 30, height: 36 };
    controller.categoryManageButton.frame = { x: 0, y: 329, width: sectionWidth, height: 76 };
    controller.questionLocatorTitle.frame = { x: 20, y: 61, width: Math.max(0, sectionWidth - 110), height: 24 };
    controller.questionLocatorDescription.frame = { x: 20, y: 87, width: Math.max(0, sectionWidth - 110), height: 18 };
    controller.questionLocatorSwitch.frame = { x: Math.max(20, sectionWidth - 68), y: 69, width: 51, height: 31 };
    controller.questionLocatorDivider.frame = { x: 20, y: 118, width: Math.max(0, sectionWidth - 40), height: 1 };
    controller.websiteLocateDivider.frame = { x: 20, y: 118, width: Math.max(0, sectionWidth - 40), height: 1 };
    controller.websiteLocateTitle.frame = { x: 20, y: 61, width: Math.max(0, sectionWidth - 110), height: 24 };
    controller.websiteLocateDescription.frame = { x: 20, y: 87, width: Math.max(0, sectionWidth - 110), height: 18 };
    controller.websiteLocateSwitch.frame = { x: Math.max(20, sectionWidth - 68), y: 69, width: 51, height: 31 };
    controller.categoryImportDivider.frame = { x: 20, y: 258, width: Math.max(0, sectionWidth - 40), height: 1 };
    controller.categoryImportTitle.frame = { x: 20, y: 271, width: Math.max(0, sectionWidth - 110), height: 24 };
    controller.categoryImportDescription.frame = { x: 20, y: 297, width: Math.max(0, sectionWidth - 110), height: 18 };
    controller.categoryImportSwitch.frame = { x: Math.max(20, sectionWidth - 68), y: 279, width: 51, height: 31 };
    controller.questionToolsTitle.frame = { x: 20, y: 12, width: Math.max(0, sectionWidth - 40), height: 28 };
    controller.questionToolsDivider.frame = { x: 20, y: 48, width: Math.max(0, sectionWidth - 40), height: 1 };
    controller.cardLocationModeTitle.frame = { x: 20, y: 131, width: Math.max(0, sectionWidth - 224), height: 24 };
    controller.cardLocationModeDescription.frame = { x: 20, y: 157, width: Math.max(0, sectionWidth - 224), height: 18 };
    controller.cardLocationModeValue.frame = { x: Math.max(20, sectionWidth - 192), y: 141.5, width: 132, height: 24 };
    controller.cardLocationModeChevron.frame = { x: Math.max(20, sectionWidth - 52), y: 135.5, width: 30, height: 36 };
    controller.cardLocationModeButton.frame = { x: 0, y: 119, width: sectionWidth, height: 69 };
    controller.noteAddDivider.frame = { x: 20, y: 188, width: Math.max(0, sectionWidth - 40), height: 1 };
    controller.noteAddTitle.frame = { x: 20, y: 201, width: Math.max(0, sectionWidth - 110), height: 24 };
    controller.noteAddDescription.frame = { x: 20, y: 227, width: Math.max(0, sectionWidth - 110), height: 18 };
    controller.noteAddSwitch.frame = { x: Math.max(20, sectionWidth - 68), y: 209, width: 51, height: 31 };
    controller.selectionImportDivider.frame = { x: 20, y: 328, width: Math.max(0, sectionWidth - 40), height: 1 };
    controller.selectionImportTitle.frame = { x: 20, y: 341, width: Math.max(0, sectionWidth - 110), height: 24 };
    controller.selectionImportDescription.frame = { x: 20, y: 367, width: Math.max(0, sectionWidth - 110), height: 18 };
    controller.selectionImportSwitch.frame = { x: Math.max(20, sectionWidth - 68), y: 349, width: 51, height: 31 };
    controller.singleImportDivider.frame = { x: 20, y: 398, width: Math.max(0, sectionWidth - 40), height: 1 };
    controller.singleImportTitle.frame = { x: 20, y: 411, width: Math.max(0, sectionWidth - 110), height: 24 };
    controller.singleImportDescription.frame = { x: 20, y: 437, width: Math.max(0, sectionWidth - 110), height: 18 };
    controller.singleImportSwitch.frame = { x: Math.max(20, sectionWidth - 68), y: 419, width: 51, height: 31 };
    controller.singleImportPositionDivider.frame = { x: 20, y: 468, width: Math.max(0, sectionWidth - 40), height: 1 };
    controller.singleImportPositionTitle.frame = { x: 20, y: 481, width: Math.max(0, sectionWidth - 252), height: 24 };
    controller.singleImportPositionDescription.frame = { x: 20, y: 507, width: Math.max(0, sectionWidth - 252), height: 18 };
    controller.singleImportPositionValue.frame = { x: Math.max(20, sectionWidth - 224), y: 491.5, width: 164, height: 24 };
    controller.singleImportPositionChevron.frame = { x: Math.max(20, sectionWidth - 52), y: 485.5, width: 30, height: 36 };
    controller.singleImportPositionButton.frame = { x: 0, y: 469, width: sectionWidth, height: 76 };
    if (typeof __DAGUANYUAN_CARD_REPAIR_UI_GLOBAL__ !== 'undefined') __DAGUANYUAN_CARD_REPAIR_UI_GLOBAL__.layout(controller, sectionWidth);
    controller.resizeHandle.frame = { x: Math.max(0, bounds.width - 30), y: Math.max(0, bounds.height - 30), width: 30, height: 30 };
    controller.resizeGlyph.frame = { x: 0, y: 0, width: 30, height: 30 };
    __DAGUANYUAN_IMPORT_REPORT_GLOBAL__.layout(controller);
    if (typeof __DAGUANYUAN_CARD_LOCATOR_UI_GLOBAL__ !== "undefined") __DAGUANYUAN_CARD_LOCATOR_UI_GLOBAL__.layout(controller);
    if (typeof __DAGUANYUAN_SETTINGS_NAVIGATION_GLOBAL__ !== 'undefined') __DAGUANYUAN_SETTINGS_NAVIGATION_GLOBAL__.layout(controller, contentFrame);
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
      { name: "import", button: controller.importButton },
      { name: "settings", button: controller.settingsButton },
    ];
    tabs.filter(function (tab) { return !!tab.button; }).forEach(function (tab) {
      const active = controller.activePage === tab.name
        || (tab.name === "settings" && controller.activePage === "category-manager");
      tab.button.backgroundColor = active ? activeColor : inactiveColor;
      tab.button.setTitleColorForState(active ? accentColor : normalColor, 0);
      tab.button.layer.cornerRadius = 15;
    });
  }

  function setActivePage(controller, page) {
    if (!controller || !controller.webView || !controller.settingsPage || !controller.categoryManagerPage) return;
    if (page !== 'import' && controller.importWorkspaceTask) __DAGUANYUAN_IMPORT_WORKSPACE_GLOBAL__.close(controller);
    if (page !== controller.activePage && controller.importTask) {
      __DAGUANYUAN_IMPORT_SELECTION_GLOBAL__.close(controller);
    }
    if (page !== "settings") __DAGUANYUAN_CARD_LOCATOR_UI_GLOBAL__.cancelMode(controller);
    if (page !== 'settings' && typeof __DAGUANYUAN_CARD_REPAIR_UI_GLOBAL__ !== 'undefined') __DAGUANYUAN_CARD_REPAIR_UI_GLOBAL__.cancel(controller);
    if (page !== 'settings' && typeof __DAGUANYUAN_CARD_TOOLS_SETTINGS_GLOBAL__ !== 'undefined') __DAGUANYUAN_CARD_TOOLS_SETTINGS_GLOBAL__.cancelFold(controller);
    if (page !== 'settings' && typeof __DAGUANYUAN_SETTINGS_NAVIGATION_GLOBAL__ !== 'undefined') __DAGUANYUAN_SETTINGS_NAVIGATION_GLOBAL__.stop(controller);
    controller.activePage = page;
    if (page === 'import' && controller.importReportView) controller.importReportView.hidden = true;
    const nativePage = page === "settings" || page === "category-manager";
    controller.webView.hidden = nativePage || page === 'import';
    if (controller.importWebView) controller.importWebView.hidden = page !== 'import';
    controller.settingsPage.hidden = page !== "settings";
    if (controller.settingsNavigation) controller.settingsNavigation.hidden = page !== 'settings';
    controller.categoryManagerPage.hidden = page !== "category-manager";
    if (page === "settings") {
      refreshCategorySetting(controller);
      refreshCategoryJumpSetting(controller);
      refreshBindCategorySetting(controller);
      refreshQuestionLocatorSetting(controller);
      refreshWebsiteLocateSetting(controller);
      refreshNoteAddSetting(controller);
      refreshSingleImportSetting(controller);
      refreshCategoryImportSetting(controller);
      if (typeof __DAGUANYUAN_CARD_TOOLS_SETTINGS_GLOBAL__ !== 'undefined') __DAGUANYUAN_CARD_TOOLS_SETTINGS_GLOBAL__.refresh(controller);
      if (typeof __DAGUANYUAN_PLUGIN_INTEGRATION_SETTINGS_GLOBAL__ !== 'undefined') __DAGUANYUAN_PLUGIN_INTEGRATION_SETTINGS_GLOBAL__.refresh(controller);
    } else if (page === "category-manager") {
      __DAGUANYUAN_CATEGORY_MANAGER_UI_GLOBAL__.refresh(controller);
    }
    refreshTabStyle(controller);
    if (typeof __DAGUANYUAN_SETTINGS_NAVIGATION_GLOBAL__ !== 'undefined') __DAGUANYUAN_SETTINGS_NAVIGATION_GLOBAL__.layout(controller, controller.webView.frame);
  }

  function refreshCategorySetting(controller) {
    if (!controller || !controller.categorySwitch) return;
    controller.categorySwitch.on = __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.categoryEnabled();
  }

  function refreshCategoryJumpSetting(controller) {
    if (!controller || !controller.categoryJumpSwitch) return;
    controller.categoryJumpSwitch.on = __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.categoryJumpEnabled();
  }

  function bindCategoryVisible() {
    try {
      const value = NSUserDefaults.standardUserDefaults().objectForKey("cn.marginnote.daguanyuan-bridge.category-navigation.bind-button-visible");
      if (value === undefined || value === null) return true;
      if (typeof value.booleanValue === "function") return Boolean(value.booleanValue());
      return !(value === false || value === 0 || String(value).toLowerCase() === "false");
    } catch (ignored) { return true; }
  }

  function refreshBindCategorySetting(controller) {
    if (controller && controller.bindCategorySwitch) controller.bindCategorySwitch.on = bindCategoryVisible();
  }

  function refreshQuestionLocatorSetting(controller) {
    if (!controller || !controller.questionLocatorSwitch) return;
    controller.questionLocatorSwitch.on = __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.questionLocatorEnabled();
  }

  function websiteLocateCardsVisible() {
    try {
      const value = NSUserDefaults.standardUserDefaults().objectForKey(WEBSITE_LOCATE_KEY);
      if (value === undefined || value === null) return true;
      if (typeof value.booleanValue === "function") return Boolean(value.booleanValue());
      return !(value === false || value === 0 || String(value).toLowerCase() === "false");
    } catch (ignored) { return true; }
  }

  function refreshWebsiteLocateSetting(controller) {
    if (controller && controller.websiteLocateSwitch) controller.websiteLocateSwitch.on = websiteLocateCardsVisible();
    if (controller && controller.cardLocationModeValue) {
      controller.cardLocationModeValue.text = __DAGUANYUAN_CARD_LOCATOR_GLOBAL__.mode() === "locate" ? "仅定位" : "定位并聚焦";
    }
  }

  function noteAddVisible() {
    return false;
  }

  function refreshNoteAddSetting(controller) {
    if (!controller || !controller.noteAddSwitch) return;
    controller.noteAddSwitch.on = false;
    controller.noteAddSwitch.enabled = false;
  }

  function categoryImportVisible() {
    try {
      const value = NSUserDefaults.standardUserDefaults().objectForKey(CATEGORY_IMPORT_KEY);
      if (value === undefined || value === null) return false;
      if (typeof value.booleanValue === "function") return Boolean(value.booleanValue());
      return value === true || value === 1 || String(value).toLowerCase() === "true";
    } catch (ignored) { return false; }
  }

  function singleImportVisible() {
    try {
      const value = NSUserDefaults.standardUserDefaults().objectForKey(SINGLE_IMPORT_KEY);
      if (typeof (value && value.booleanValue) === "function") return Boolean(value.booleanValue());
      return value === true || value === 1 || String(value).toLowerCase() === "true";
    } catch (ignored) { return false; }
  }

  function refreshSingleImportSetting(controller) {
    if (controller && controller.singleImportSwitch) controller.singleImportSwitch.on = singleImportVisible();
    if (controller && controller.singleImportPositionValue) {
      controller.singleImportPositionValue.text = __DAGUANYUAN_SINGLE_IMPORT_GLOBAL__.positionTitle(__DAGUANYUAN_SINGLE_IMPORT_GLOBAL__.position());
    }
  }

  function refreshCategoryImportSetting(controller) {
    if (controller && controller.categoryImportSwitch) controller.categoryImportSwitch.on = categoryImportVisible();
    if (controller && controller.selectionImportSwitch) controller.selectionImportSwitch.on = selectionImportVisible();
  }

  function selectionImportVisible() {
    try {
      const value = NSUserDefaults.standardUserDefaults().objectForKey(SELECTION_IMPORT_KEY);
      if (value === undefined || value === null) return true;
      if (typeof value.booleanValue === "function") return Boolean(value.booleanValue());
      return value === true || value === 1 || String(value).toLowerCase() === "true";
    } catch (ignored) { return true; }
  }

  function prepareCategoryBinding(controller, message) {
    if (!controller) throw new Error("大观园面板当前不可用");
    showPanel(controller);
    if (controller.currentContentPage === "math") setActivePage(controller, "math");
    else loadURL(controller, DAGUANYUAN_HOME_URL, "daguanyuan");
    showMessage(controller, String(message || "请进入正确的大观园分类后点击“绑定分类”"));
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
    controller.closeButton.titleLabel.font = UIFont.systemFontOfSize(22);
    controller.closeButton.setTitleColorForState(UIColor.darkGrayColor(), 0);
    controller.titleBar.addSubview(controller.closeButton);

    controller.homeButton = button("数学", controller, "openDaguanyuan:");
    controller.titleBar.addSubview(controller.homeButton);

    controller.os408Button = button("408", controller, "open408:");
    controller.titleBar.addSubview(controller.os408Button);

    controller.importButton = button("导入", controller, "openImport:");
    controller.titleBar.addSubview(controller.importButton);

    controller.settingsButton = button("设置", controller, "openSettings:");
    controller.titleBar.addSubview(controller.settingsButton);

    const pan = new UIPanGestureRecognizer(controller, "movePanel:");
    controller.titleBar.addGestureRecognizer(pan);
    const doubleTap = new UITapGestureRecognizer(controller, "resetPanelOnDoubleTap:");
    doubleTap.numberOfTapsRequired = 2;
    doubleTap.cancelsTouchesInView = false;
    doubleTap.delaysTouchesBegan = false;
    doubleTap.delaysTouchesEnded = false;
    // 拖动优先响应，双击不延迟导航按钮的正常点击。
    doubleTap.requireGestureRecognizerToFail(pan);
    controller.titleBar.addGestureRecognizer(doubleTap);

    controller.webView = new UIWebView({ x: 0, y: TITLE_HEIGHT, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT - TITLE_HEIGHT });
    controller.webView.backgroundColor = UIColor.whiteColor();
    controller.webView.scalesPageToFit = true;
    controller.webView.delegate = controller;
    controller.containerView.addSubview(controller.webView);

    controller.importWebView = new UIWebView({ x: 0, y: TITLE_HEIGHT, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT - TITLE_HEIGHT });
    controller.importWebView.backgroundColor = UIColor.whiteColor();
    controller.importWebView.scalesPageToFit = false;
    controller.importWebView.delegate = controller;
    controller.importWebView.hidden = true;
    controller.containerView.addSubview(controller.importWebView);

    controller.settingsPage = new UIScrollView({ x: 0, y: TITLE_HEIGHT, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT - TITLE_HEIGHT });
    controller.settingsPage.backgroundColor = UIColor.colorWithWhiteAlpha(0.96, 1);
    controller.settingsPage.showsVerticalScrollIndicator = true;
    controller.settingsPage.alwaysBounceVertical = true;
    controller.settingsPage.hidden = true;
    controller.containerView.addSubview(controller.settingsPage);
    __DAGUANYUAN_CATEGORY_MANAGER_UI_GLOBAL__.setup(controller);

    controller.categorySettingsSection = new UIView({ x: 20, y: 0, width: DEFAULT_WIDTH - 40, height: 406 });
    controller.categorySettingsSection.backgroundColor = UIColor.whiteColor();
    controller.categorySettingsSection.layer.cornerRadius = 10;
    controller.categorySettingsSection.layer.borderWidth = 0.5;
    controller.categorySettingsSection.layer.borderColor = UIColor.lightGrayColor().colorWithAlphaComponent(0.45);
    controller.settingsPage.addSubview(controller.categorySettingsSection);

    controller.categorySectionTitle = label("题型工具", UIFont.boldSystemFontOfSize(17), UIColor.darkGrayColor());
    controller.categorySettingsSection.addSubview(controller.categorySectionTitle);

    controller.categorySectionDivider = new UIView({ x: 20, y: 48, width: DEFAULT_WIDTH - 80, height: 1 });
    controller.categorySectionDivider.backgroundColor = UIColor.lightGrayColor().colorWithAlphaComponent(0.4);
    controller.categorySettingsSection.addSubview(controller.categorySectionDivider);

    controller.categoryTitle = label("显示题型分类", UIFont.boldSystemFontOfSize(16), UIColor.darkGrayColor());
    controller.categorySettingsSection.addSubview(controller.categoryTitle);

    controller.categoryDescription = label("显示当前焦点卡片的直属父节点标题", UIFont.systemFontOfSize(12), UIColor.grayColor());
    controller.categorySettingsSection.addSubview(controller.categoryDescription);

    controller.categorySwitch = new UISwitch({ x: DEFAULT_WIDTH - 108, y: 69, width: 51, height: 31 });
    controller.categorySwitch.addTargetActionForControlEvents(controller, "toggleCategoryDisplay:", 1 << 12);
    controller.categorySettingsSection.addSubview(controller.categorySwitch);

    controller.categoryDivider = new UIView({ x: 20, y: 118, width: DEFAULT_WIDTH - 80, height: 1 });
    controller.categoryDivider.backgroundColor = UIColor.lightGrayColor().colorWithAlphaComponent(0.4);
    controller.categorySettingsSection.addSubview(controller.categoryDivider);

    controller.categoryJumpTitle = label("题型分类快捷跳转", UIFont.boldSystemFontOfSize(16), UIColor.darkGrayColor());
    controller.categorySettingsSection.addSubview(controller.categoryJumpTitle);

    controller.categoryJumpDescription = label("点击题型分类时打开大观园对应分类", UIFont.systemFontOfSize(12), UIColor.grayColor());
    controller.categorySettingsSection.addSubview(controller.categoryJumpDescription);

    controller.categoryJumpSwitch = new UISwitch({ x: DEFAULT_WIDTH - 108, y: 139, width: 51, height: 31 });
    controller.categoryJumpSwitch.addTargetActionForControlEvents(controller, "toggleCategoryJump:", 1 << 12);
    controller.categorySettingsSection.addSubview(controller.categoryJumpSwitch);

    controller.bindCategoryDivider = new UIView({ x: 20, y: 188, width: DEFAULT_WIDTH - 80, height: 1 });
    controller.bindCategoryDivider.backgroundColor = UIColor.lightGrayColor().colorWithAlphaComponent(0.4);
    controller.categorySettingsSection.addSubview(controller.bindCategoryDivider);

    controller.bindCategoryTitle = label("显示绑定分类", UIFont.boldSystemFontOfSize(16), UIColor.darkGrayColor());
    controller.categorySettingsSection.addSubview(controller.bindCategoryTitle);

    controller.bindCategoryDescription = label("在数学与 408 页面显示绑定按钮", UIFont.systemFontOfSize(12), UIColor.grayColor());
    controller.categorySettingsSection.addSubview(controller.bindCategoryDescription);

    controller.bindCategorySwitch = new UISwitch({ x: DEFAULT_WIDTH - 108, y: 209, width: 51, height: 31 });
    controller.bindCategorySwitch.addTargetActionForControlEvents(controller, "toggleBindCategoryDisplay:", 1 << 12);
    controller.categorySettingsSection.addSubview(controller.bindCategorySwitch);

    controller.categoryManageDivider = new UIView({ x: 20, y: 258, width: DEFAULT_WIDTH - 80, height: 1 });
    controller.categoryManageDivider.backgroundColor = UIColor.lightGrayColor().colorWithAlphaComponent(0.4);
    controller.categorySettingsSection.addSubview(controller.categoryManageDivider);

    controller.categoryManageTitle = label("题型分类管理", UIFont.boldSystemFontOfSize(16), UIColor.darkGrayColor());
    controller.categorySettingsSection.addSubview(controller.categoryManageTitle);

    controller.categoryManageDescription = label("更新分类数据与管理人工绑定", UIFont.systemFontOfSize(12), UIColor.grayColor());
    controller.categorySettingsSection.addSubview(controller.categoryManageDescription);

    controller.categoryManageChevron = label("›", UIFont.systemFontOfSize(25), UIColor.grayColor());
    controller.categoryManageChevron.textAlignment = 1;
    controller.categorySettingsSection.addSubview(controller.categoryManageChevron);

    controller.categoryManageButton = button("", controller, "openCategoryManager:");
    controller.categoryManageButton.backgroundColor = UIColor.colorWithWhiteAlpha(1, 0);
    controller.categorySettingsSection.addSubview(controller.categoryManageButton);

    controller.questionToolsSettingsSection = new UIView({ x: 20, y: 0, width: DEFAULT_WIDTH - 40, height: 624 });
    controller.questionToolsSettingsSection.backgroundColor = UIColor.whiteColor();
    controller.questionToolsSettingsSection.layer.cornerRadius = 10;
    controller.questionToolsSettingsSection.layer.borderWidth = 0.5;
    controller.questionToolsSettingsSection.layer.borderColor = UIColor.lightGrayColor().colorWithAlphaComponent(0.45);
    controller.settingsPage.addSubview(controller.questionToolsSettingsSection);

    controller.questionToolsTitle = label("题目工具", UIFont.boldSystemFontOfSize(17), UIColor.darkGrayColor());
    controller.questionToolsSettingsSection.addSubview(controller.questionToolsTitle);

    controller.questionToolsDivider = new UIView({ x: 20, y: 48, width: DEFAULT_WIDTH - 80, height: 1 });
    controller.questionToolsDivider.backgroundColor = UIColor.lightGrayColor().colorWithAlphaComponent(0.4);
    controller.questionToolsSettingsSection.addSubview(controller.questionToolsDivider);
    controller.questionLocatorTitle = label("显示定位题目", UIFont.boldSystemFontOfSize(16), UIColor.darkGrayColor());
    controller.categorySettingsSection.addSubview(controller.questionLocatorTitle);

    controller.questionLocatorDescription = label("按当前卡片在所属题型中的序号打开对应题目", UIFont.systemFontOfSize(12), UIColor.grayColor());
    controller.categorySettingsSection.addSubview(controller.questionLocatorDescription);

    controller.questionLocatorSwitch = new UISwitch({ x: DEFAULT_WIDTH - 108, y: 69, width: 51, height: 31 });
    controller.questionLocatorSwitch.addTargetActionForControlEvents(controller, "toggleQuestionLocator:", 1 << 12);
    controller.categorySettingsSection.addSubview(controller.questionLocatorSwitch);

    controller.questionLocatorDivider = new UIView({ x: 20, y: 118, width: DEFAULT_WIDTH - 80, height: 1 });
    controller.questionLocatorDivider.backgroundColor = UIColor.lightGrayColor().colorWithAlphaComponent(0.4);
    controller.categorySettingsSection.addSubview(controller.questionLocatorDivider);

    controller.websiteLocateDivider = new UIView({ x: 20, y: 118, width: DEFAULT_WIDTH - 80, height: 1 });
    controller.websiteLocateDivider.backgroundColor = UIColor.lightGrayColor().colorWithAlphaComponent(0.4);

    controller.websiteLocateTitle = label("显示定位卡片", UIFont.boldSystemFontOfSize(16), UIColor.darkGrayColor());

    controller.websiteLocateDescription = label("在数学、408 题目页及数学错题复测页显示定位卡片", UIFont.systemFontOfSize(12), UIColor.grayColor());

    controller.websiteLocateSwitch = new UISwitch({ x: DEFAULT_WIDTH - 108, y: 139, width: 51, height: 31 });
    controller.websiteLocateSwitch.addTargetActionForControlEvents(controller, "toggleWebsiteLocateCards:", 1 << 12);

    controller.categoryImportDivider = new UIView({ x: 20, y: 188, width: DEFAULT_WIDTH - 80, height: 1 });
    controller.categoryImportDivider.backgroundColor = UIColor.lightGrayColor().colorWithAlphaComponent(0.4);
    controller.questionToolsSettingsSection.addSubview(controller.categoryImportDivider);

    controller.categoryImportTitle = label("显示导入题目", UIFont.boldSystemFontOfSize(16), UIColor.darkGrayColor());
    controller.questionToolsSettingsSection.addSubview(controller.categoryImportTitle);

    controller.categoryImportDescription = label("在数学与 408 页导入当前分类全部题目", UIFont.systemFontOfSize(12), UIColor.grayColor());
    controller.questionToolsSettingsSection.addSubview(controller.categoryImportDescription);

    controller.categoryImportSwitch = new UISwitch({ x: DEFAULT_WIDTH - 108, y: 209, width: 51, height: 31 });
    controller.categoryImportSwitch.addTargetActionForControlEvents(controller, "toggleCategoryImportDisplay:", 1 << 12);
    controller.questionToolsSettingsSection.addSubview(controller.categoryImportSwitch);

    controller.questionToolsSettingsSection.addSubview(controller.websiteLocateTitle);
    controller.questionToolsSettingsSection.addSubview(controller.websiteLocateDescription);
    controller.questionToolsSettingsSection.addSubview(controller.websiteLocateSwitch);
    controller.questionToolsSettingsSection.addSubview(controller.websiteLocateDivider);

    controller.cardLocationModeTitle = label("定位卡片方式", UIFont.boldSystemFontOfSize(16), UIColor.darkGrayColor());
    controller.questionToolsSettingsSection.addSubview(controller.cardLocationModeTitle);
    controller.cardLocationModeDescription = label("选择定位卡片时的操作", UIFont.systemFontOfSize(12), UIColor.grayColor());
    controller.questionToolsSettingsSection.addSubview(controller.cardLocationModeDescription);
    controller.cardLocationModeValue = label("", UIFont.systemFontOfSize(14), UIColor.grayColor());
    controller.cardLocationModeValue.textAlignment = 2;
    controller.questionToolsSettingsSection.addSubview(controller.cardLocationModeValue);
    controller.cardLocationModeChevron = label("›", UIFont.systemFontOfSize(25), UIColor.grayColor());
    controller.cardLocationModeChevron.textAlignment = 1;
    controller.questionToolsSettingsSection.addSubview(controller.cardLocationModeChevron);
    controller.cardLocationModeButton = button("", controller, "chooseCardLocationMode:");
    controller.questionToolsSettingsSection.addSubview(controller.cardLocationModeButton);
    controller.noteAddDivider = new UIView({ x: 20, y: 188, width: DEFAULT_WIDTH - 80, height: 1 });
    controller.noteAddDivider.backgroundColor = UIColor.lightGrayColor().colorWithAlphaComponent(0.4);
    controller.questionToolsSettingsSection.addSubview(controller.noteAddDivider);

    controller.noteAddTitle = label("显示添加笔记", UIFont.boldSystemFontOfSize(16), UIColor.grayColor());
    controller.questionToolsSettingsSection.addSubview(controller.noteAddTitle);

    controller.noteAddDescription = label("暂不可用", UIFont.systemFontOfSize(12), UIColor.grayColor());
    controller.questionToolsSettingsSection.addSubview(controller.noteAddDescription);

    controller.noteAddSwitch = new UISwitch({ x: DEFAULT_WIDTH - 108, y: 69, width: 51, height: 31 });
    controller.noteAddSwitch.on = false;
    controller.noteAddSwitch.enabled = false;
    controller.questionToolsSettingsSection.addSubview(controller.noteAddSwitch);

    controller.selectionImportDivider = new UIView({ x: 20, y: 398, width: DEFAULT_WIDTH - 80, height: 1 });
    controller.selectionImportDivider.backgroundColor = UIColor.lightGrayColor().colorWithAlphaComponent(0.4);
    controller.questionToolsSettingsSection.addSubview(controller.selectionImportDivider);
    controller.selectionImportTitle = label("显示选题导入", UIFont.boldSystemFontOfSize(16), UIColor.darkGrayColor());
    controller.questionToolsSettingsSection.addSubview(controller.selectionImportTitle);
    controller.selectionImportDescription = label("在网页导入工具中显示选题导入", UIFont.systemFontOfSize(12), UIColor.grayColor());
    controller.questionToolsSettingsSection.addSubview(controller.selectionImportDescription);
    controller.selectionImportSwitch = new UISwitch({ x: DEFAULT_WIDTH - 108, y: 419, width: 51, height: 31 });
    controller.selectionImportSwitch.addTargetActionForControlEvents(controller, "toggleSelectionImportDisplay:", 1 << 12);
    controller.questionToolsSettingsSection.addSubview(controller.selectionImportSwitch);

    controller.singleImportDivider = new UIView({ x: 20, y: 188, width: DEFAULT_WIDTH - 80, height: 1 });
    controller.singleImportDivider.backgroundColor = UIColor.lightGrayColor().colorWithAlphaComponent(0.4);
    controller.questionToolsSettingsSection.addSubview(controller.singleImportDivider);
    controller.singleImportTitle = label("显示导入本题", UIFont.boldSystemFontOfSize(16), UIColor.darkGrayColor());
    controller.questionToolsSettingsSection.addSubview(controller.singleImportTitle);
    controller.singleImportDescription = label("按所选位置导入一道数学或 408 题", UIFont.systemFontOfSize(12), UIColor.grayColor());
    controller.questionToolsSettingsSection.addSubview(controller.singleImportDescription);
    controller.singleImportSwitch = new UISwitch({ x: DEFAULT_WIDTH - 108, y: 209, width: 51, height: 31 });
    controller.singleImportSwitch.addTargetActionForControlEvents(controller, "toggleSingleImportDisplay:", 1 << 12);
    controller.questionToolsSettingsSection.addSubview(controller.singleImportSwitch);

    controller.singleImportPositionDivider = new UIView({ x: 20, y: 328, width: DEFAULT_WIDTH - 80, height: 1 });
    controller.singleImportPositionDivider.backgroundColor = UIColor.lightGrayColor().colorWithAlphaComponent(0.4);
    controller.questionToolsSettingsSection.addSubview(controller.singleImportPositionDivider);
    controller.singleImportPositionTitle = label("导入本题位置", UIFont.boldSystemFontOfSize(16), UIColor.darkGrayColor());
    controller.questionToolsSettingsSection.addSubview(controller.singleImportPositionTitle);
    controller.singleImportPositionDescription = label("选择题卡的插入位置", UIFont.systemFontOfSize(12), UIColor.grayColor());
    controller.questionToolsSettingsSection.addSubview(controller.singleImportPositionDescription);
    controller.singleImportPositionValue = label("", UIFont.systemFontOfSize(14), UIColor.grayColor());
    controller.singleImportPositionValue.textAlignment = 2;
    controller.questionToolsSettingsSection.addSubview(controller.singleImportPositionValue);
    controller.singleImportPositionChevron = label("›", UIFont.systemFontOfSize(25), UIColor.grayColor());
    controller.singleImportPositionChevron.textAlignment = 1;
    controller.questionToolsSettingsSection.addSubview(controller.singleImportPositionChevron);
    controller.singleImportPositionButton = button("", controller, "chooseSingleImportPosition:");
    controller.questionToolsSettingsSection.addSubview(controller.singleImportPositionButton);
    if (typeof __DAGUANYUAN_CARD_TOOLS_SETTINGS_GLOBAL__ !== 'undefined') __DAGUANYUAN_CARD_TOOLS_SETTINGS_GLOBAL__.setup(controller);
    if (typeof __DAGUANYUAN_PLUGIN_INTEGRATION_SETTINGS_GLOBAL__ !== 'undefined') __DAGUANYUAN_PLUGIN_INTEGRATION_SETTINGS_GLOBAL__.setup(controller);
    if (typeof __DAGUANYUAN_ABOUT_SETTINGS_GLOBAL__ !== 'undefined') __DAGUANYUAN_ABOUT_SETTINGS_GLOBAL__.setup(controller);
    if (typeof __DAGUANYUAN_SETTINGS_NAVIGATION_GLOBAL__ !== 'undefined') __DAGUANYUAN_SETTINGS_NAVIGATION_GLOBAL__.setup(controller);

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
    refreshCategorySetting(controller);
    refreshCategoryJumpSetting(controller);
    refreshBindCategorySetting(controller);
    refreshCategoryImportSetting(controller);
    refreshQuestionLocatorSetting(controller);
    refreshWebsiteLocateSetting(controller);
    refreshNoteAddSetting(controller);
    refreshSingleImportSetting(controller);
    refreshTabStyle(controller);
    layout(controller);
  }

  function loadURL(controller, urlString, provider) {
    if (controller.importTask) __DAGUANYUAN_IMPORT_SELECTION_GLOBAL__.close(controller);
    const url = NSURL.URLWithString(urlString);
    if (!url) throw new Error("题库地址无效");
    const normalizedProvider = String(provider || "daguanyuan");
    controller.currentContentPage = normalizedProvider === "408os" ? "408" : "math";
    setActivePage(controller, controller.currentContentPage);
    controller.webView.loadRequest(NSURLRequest.requestWithURL(url));
  }

  function openDaguanyuanCategory(controller, urlString) {
    if (!controller) throw new Error("大观园面板当前不可用");
    showPanel(controller);
    loadURL(controller, urlString, "daguanyuan");
  }

  function open408Page(controller, urlString) {
    if (!controller) throw new Error("408 面板当前不可用");
    showPanel(controller);
    loadURL(controller, __DAGUANYUAN_408_ROUTES_GLOBAL__.normalizedURL(urlString), "408os");
  }

  function questionLocatorScript(route) {
    const questionId = Number(route && route.questionId);
    const questionNumber = Number(route && route.questionNumber);
    const imported = Boolean(route && route.imported);
    const offset = route && route.modern && !imported ? (route.page - 1) * route.pageSize : 0;
    const scope = JSON.stringify(String(route && route.scope || ""));
    return `(function () {
      var questionId = ${questionId};
      var questionNumber = ${questionNumber};
      var imported = ${imported};
      var expectedScope = ${scope};
      var marker = "data-daguanyuan-bridge-question-locator";
      var root = document.documentElement;
      var attempts = 0;
      var lastClickedCount = -1;
      var lastScrollCount = -1;
      var lastLoadedCount = -1;
      var stalled = 0;
      var scopeSelected = false;
      var pending = true;
      root.setAttribute(marker, "pending:" + questionNumber);
      function finish(status) {
        if (!pending) return;
        pending = false;
        root.setAttribute(marker, status + ":" + questionNumber);
      }
      root.addEventListener("touchstart", function () { finish("cancelled"); }, true);
      root.addEventListener("wheel", function () { finish("cancelled"); }, true);
      function locate() {
        if (!pending) return;
        attempts += 1;
        if (imported && !scopeSelected) {
          var scopeButtons = document.querySelectorAll('button');
          for (var scopeIndex = 0; scopeIndex < scopeButtons.length; scopeIndex += 1) {
            if (String(scopeButtons[scopeIndex].textContent || '').trim() !== '完整') continue;
            scopeSelected = true;
            if (scopeButtons[scopeIndex].getAttribute('aria-pressed') !== 'true') {
              scopeButtons[scopeIndex].click();
              window.setTimeout(locate, 150);
              return;
            }
            break;
          }
        }
        if (!imported) {
          var scopeControl = document.querySelector('.learning-shell__scope-toggle[data-scope]');
          var activeScope = scopeControl ? String(scopeControl.getAttribute('data-scope') || '') : '';
          if (window.location && window.location.search) activeScope = new URLSearchParams(window.location.search).get('scope') || activeScope;
          if (!activeScope) {
            try { activeScope = String(window.localStorage.getItem('daguan:question-bank-scope') || 'complete'); } catch (ignored) {}
          }
          if (activeScope !== expectedScope) {
            if (attempts >= 60) finish("failed");
            else window.setTimeout(locate, 150);
            return;
          }
        }
        var rows = document.querySelectorAll('[data-learning-question-id]');
        if (!rows.length) rows = document.querySelectorAll('article.question-document[data-question-id]');
        var target = imported
          ? document.querySelector('[data-learning-question-id="' + questionId + '"]')
            || document.querySelector('article.question-document[data-question-id="' + questionId + '"]')
          : rows[questionNumber - ${offset} - 1];
        if (target) {
          finish("success");
          try {
            target.scrollIntoView({ behavior: "auto", block: "start" });
          } catch (ignored) {
            target.scrollIntoView(true);
          }
          return;
        }
        var loadedCount = rows.length;
        var buttons = document.querySelectorAll("button");
        var loadMore;
        for (var index = 0; index < buttons.length; index += 1) {
          if (String(buttons[index].textContent || "").trim() === "加载更多题目") {
            loadMore = buttons[index];
            break;
          }
        }
        if (loadMore && !loadMore.disabled && loadedCount !== lastClickedCount) {
          lastClickedCount = loadedCount;
          loadMore.click();
        } else if (!loadMore && loadedCount > 0 && loadedCount !== lastScrollCount) {
          var scroller = document.querySelector('[data-learning-immersive-scroll-owner="true"]') || document.querySelector('[class*="practiceScroll"]');
          if (scroller && scroller.scrollHeight > scroller.clientHeight) {
            lastScrollCount = loadedCount;
            scroller.scrollTop = scroller.scrollHeight - scroller.clientHeight;
            try { scroller.dispatchEvent(new Event("scroll", { bubbles: true })); } catch (ignored) {}
          }
        }
        stalled = loadedCount === lastLoadedCount ? stalled + 1 : 0;
        lastLoadedCount = loadedCount;
        if (attempts < 80 && (!loadedCount || stalled < 20)) {
          window.setTimeout(locate, 150);
          return;
        }
        finish("failed");
      }
      locate();
      return true;
    })();`;
  }

  function injectQuestionLocator(controller) {
    const route = controller && controller.pendingQuestionLocator;
    if (!route || !controller.webView) return;
    controller.pendingQuestionLocator = undefined;
    controller.webView.evaluateJavaScript(questionLocatorScript(route), function (result, error) {
      if (error) {
        showMessage(controller, "题目页面已打开，但自动定位失败");
        console.log(`[Daguanyuan Bridge] 注入题目定位失败：${error.localizedDescription || error}`);
      }
    });
    if (typeof NSTimer !== "undefined" && NSTimer.scheduledTimerWithTimeInterval) {
      NSTimer.scheduledTimerWithTimeInterval(12.5, false, function () {
        controller.webView.evaluateJavaScript(
          `document.documentElement.getAttribute("data-daguanyuan-bridge-question-locator") || ""`,
          function (status) {
            if (String(status || "") === `failed:${route.questionNumber}`) {
              showMessage(controller, route.imported
                ? `已打开所属分类，但未能定位题目 ${route.questionId}`
                : `已打开所属分类，但未能定位第 ${route.questionNumber} 题`);
            }
          }
        );
      });
    }
  }

  function startDaguanyuanQuestionLocator(controller, route) {
    // 旧题卡继续读取原链接，实际打开时转换成新版分类网址。
    const category = Number(route.categoryId || (String(route.url).match(/[?&]resumeCategoryId=(\d+)/) || [])[1]
      || (String(route.url).match(/\/practice\/(?:categories\/)?(\d+)/) || [])[1]);
    if (category > 0) {
      const page = route.imported ? 1 : Math.ceil(route.questionNumber / 30);
      const query = 'scope=' + encodeURIComponent(route.imported ? 'complete' : route.scope) + '&page=' + page
        + (route.imported ? '&questionId=' + route.questionId : '');
      const url = route.imported ? 'https://www.cxyonly.fans/math/practice?listId=complete&categoryId=' + category + '&' + query
        : 'https://www.cxyonly.fans/math/practice/categories/' + category + '?' + query;
      route = Object.assign({}, route, { url: url,
        modern: true, page: page, pageSize: 30 });
    }
    controller.pendingQuestionLocator = route;
    showPanel(controller);
    loadURL(controller, route.url, "daguanyuan");
    showMessage(controller, route.questionNumber
      ? `正在定位当前题库范围的第 ${route.questionNumber} 题`
      : `正在加载并定位题目 ${route.questionId}`);
  }

  function currentQuestionScope(controller, completion) {
    controller.webView.evaluateJavaScript(__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__.importContextScript(), function (contextJSON, error) {
      try {
        if (error) throw error;
        const current = JSON.parse(String(contextJSON || ""));
        if (controller.currentContentPage !== "math" || !/^https:\/\/(?:www\.)?cxyonly\.fans\//i.test(String(current.url || ""))) {
          throw new Error("请先在数学题库选择完整、严选或真题范围");
        }
        const list = current.selection && current.selection.listId;
        completion(null, __DAGUANYUAN_MATH_API_GLOBAL__.questionScope(list === 'core' || list === 'exam' ? list : current.scope));
      } catch (failure) { completion(failure); }
    });
  }

  function openDaguanyuanQuestion(controller, route) {
    if (!controller) throw new Error("大观园面板当前不可用");
    if (!route || !route.url || (route.imported ? !route.questionId : !route.questionNumber)) {
      throw new Error("题目定位信息无效");
    }
    if (route.provider === "408") {
      if (!/^https:\/\/www\.408os\.cn\/exercise\?/.test(route.url)) throw new Error("408 题目地址无效");
      showPanel(controller);
      loadURL(controller, __DAGUANYUAN_408_ROUTES_GLOBAL__.detailURL(route.url, route.questionId, route.year), "408os");
      showMessage(controller, "正在打开导入的 408 题目");
      return;
    }
    const token = Number(controller.questionLocatorRequestToken || 0) + 1;
    controller.questionLocatorRequestToken = token;
    if (route.imported) {
      startDaguanyuanQuestionLocator(controller, route);
      return;
    }
    currentQuestionScope(controller, function (error, scope) {
      if (token !== controller.questionLocatorRequestToken) return;
      if (error) { showMessage(controller, String(error && error.message || error)); return; }
      startDaguanyuanQuestionLocator(controller, Object.assign({}, route, { scope }));
    });
  }

  function open408Question(controller, boundURL, questionNumber) {
    if (!controller) throw new Error("408 面板当前不可用");
    const url = __DAGUANYUAN_408_ROUTES_GLOBAL__.questionURL(boundURL, questionNumber);
    showPanel(controller);
    loadURL(controller, url, "408os");
    showMessage(controller, `正在打开第 ${questionNumber} 题`);
  }

  function injectVideoPopupCompatibility(controller) {
    controller.webView.evaluateJavaScript(__DAGUANYUAN_VIDEO_BROWSER_GLOBAL__.pageScript(), function (result, error) {
      if (error) console.log(`[Daguanyuan Bridge] 注入视频跳转兼容失败：${error.localizedDescription || error}`);
    });
  }

  function nativeValue(object, key) {
    const value = object && object[key];
    return typeof value === "function" ? value.call(object) : value;
  }

  function requestAddress(request) {
    return String(nativeValue(nativeValue(request, "URL"), "absoluteString") || "");
  }

  function finishCategoryImport(controller) {
    controller.categoryImportBusy = false;
    try {
      controller.webView.evaluateJavaScript("window.__DAGUANYUAN_BIND_CATEGORY_BUTTON__&&window.__DAGUANYUAN_BIND_CATEGORY_BUTTON__.finishImport()", function () {});
    } catch (error) {
      console.log(`[Daguanyuan Bridge] 恢复导入按钮失败：${String(error && error.message || error)}`);
    }
  }

  function showImportReport(controller, result, selectionTask) {
    if (result.cancelled || selectionTask && (selectionTask !== controller.importTask || selectionTask.dismissed)) return;
    controller.lastCategoryImportReportText = __DAGUANYUAN_IMPORT_REPORT_GLOBAL__.textFor(result);
    function fallback(error) {
      console.log(`[Daguanyuan Bridge] 网页结果显示失败：${String(error && error.message || error)}`);
      try { __DAGUANYUAN_IMPORT_REPORT_GLOBAL__.show(controller, result); }
      catch (failure) { showMessage(controller, controller.lastCategoryImportReportText); }
    }
    try {
      if (selectionTask) __DAGUANYUAN_IMPORT_SELECTION_GLOBAL__.show(controller, result).catch(fallback);
      else __DAGUANYUAN_IMPORT_REPORT_GLOBAL__.show(controller, result);
    }
    catch (error) { fallback(error); }
  }

  function showCategoryImportResult(controller, result, emptyMessage, selectionTask) {
    if (selectionTask) { showImportReport(controller, result, selectionTask); return; }
    if (!result.total) { showMessage(controller, emptyMessage); return; }
    if (result.failed.length || result.commentFoldWarnings && result.commentFoldWarnings.length) { showImportReport(controller, result); return; }
    showMessage(controller, `导入完成：新建 ${result.createdCount} 道，补答案 ${result.answerAddedCount || 0} 道，跳过 ${result.skippedCount} 道，失败 0 道`);
  }

  function handleCategoryImport(controller, selectionScope, fromToolbar) {
    if (controller.categoryImportBusy) return;
    if (controller.questionToolBusy) { finishCategoryImport(controller); showMessage(controller, "正在读取当前题目，请稍后导入"); return; }
    if (controller.singleImportBusy) {
      finishCategoryImport(controller);
      showMessage(controller, "正在导入本题，请稍后再导入整类题目");
      return;
    }
    if ((!fromToolbar && !categoryImportVisible()) || ["math", "408"].indexOf(controller.currentContentPage) < 0) {
      showMessage(controller, "请在数学或 408 页开启导入题目");
      return;
    }
    controller.categoryImportBusy = true;
    const selecting = fromToolbar && selectionScope === 'selected';
    let selectionTask, beforeImport;
    try {
      if (selecting) {
        selectionTask = __DAGUANYUAN_IMPORT_SELECTION_GLOBAL__.begin(controller, "准备选题导入", 'selected');
        beforeImport = __DAGUANYUAN_IMPORT_SELECTION_GLOBAL__.confirmation(controller);
      }
    }
    catch (error) { finishCategoryImport(controller); showMessage(controller, "无法打开导入确认框：" + String(error.message || error)); return; }
    function report(result) { showImportReport(controller, result, selectionTask); }
    function progress(value) {
      if (selecting) __DAGUANYUAN_IMPORT_SELECTION_GLOBAL__.progress(controller, value);
      else showMessage(controller, `已处理 ${value.processed}/${value.total} 道：新建 ${value.created}，补答案 ${value.answerAdded || 0}，跳过 ${value.skipped}，失败 ${value.failed}`);
    }
    if (selecting) {
      selectionTask.ready.then(function () {
        beforeImport.check();
        return __DAGUANYUAN_IMPORT_SELECTION_GLOBAL__.evaluate(controller, 'window.__DAGUANYUAN_IMPORT_UI__.pageSnapshot()');
      }).then(function (raw) {
        beforeImport.check();
        const page = JSON.parse(String(raw));
        if (page.provider !== controller.currentContentPage) throw new Error('当前题库已切换，请重新打开选题导入');
        return page.provider === 'math' ? __DAGUANYUAN_MATH_SELECTION_GLOBAL__.importPage(controller.addon, page, progress, beforeImport)
          : __DAGUANYUAN_408_IMPORT_GLOBAL__.importCategory(controller, progress, null, beforeImport, page);
      }).then(function (result) {
        showCategoryImportResult(controller, result, '当前页面暂无可导入题目', selectionTask);
      }).catch(function (failure) {
        const result = failure.importResult || { failed: [] };
        result.interrupted = String(failure.message || failure); report(result);
      }).then(function () { finishCategoryImport(controller); }, function (failure) {
        finishCategoryImport(controller); console.log('[Daguanyuan Bridge] 选题导入提示失败：' + String(failure.message || failure));
      });
      return;
    }
    if (controller.currentContentPage === "408") {
      showMessage(controller, "正在读取当前 408 分类的全部题目…");
      Promise.resolve().then(function () {
        return __DAGUANYUAN_408_IMPORT_GLOBAL__.importCategory(controller, progress, null, beforeImport);
      }).then(function (result) {
        if (result.failed.length) console.log(`[Daguanyuan Bridge] 408 导入失败详情：${__DAGUANYUAN_IMPORT_REPORT_GLOBAL__.textFor(result)}`);
        showCategoryImportResult(controller, result, "当前 408 分类没有题目", selectionTask);
      }).catch(function (failure) {
        const result = failure.importResult || { createdCount: 0, skippedCount: 0, failed: [] };
        result.interrupted = String(failure && failure.message || failure);
        report(result);
      }).then(function () { finishCategoryImport(controller); }, function (failure) {
        finishCategoryImport(controller);
        console.log(`[Daguanyuan Bridge] 导入结束提示失败：${String(failure && failure.message || failure)}`);
      });
      return;
    }
    controller.webView.evaluateJavaScript(__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__.importContextScript(), function (contextJSON, error) {
      let importContext;
      try {
        if (error) throw error;
        importContext = JSON.parse(String(contextJSON || ""));
      } catch (failure) {
        report({ interrupted: "无法读取当前数学页面，请刷新后重试", failed: [] });
        finishCategoryImport(controller);
        return;
      }
      const categoryId = __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.categoryIdFromURL(importContext.url);
      if (!categoryId) {
        report({ interrupted: "请先进入具体的数学题型分类", failed: [] });
        finishCategoryImport(controller);
        return;
      }
      let scope;
      try {
        scope = __DAGUANYUAN_MATH_API_GLOBAL__.questionScope(importContext.scope);
      } catch (failure) {
        report({ interrupted: String(failure && failure.message || failure), failed: [] });
        finishCategoryImport(controller);
        return;
      }
      const scopeName = { complete: "完整", core: "严选", exam: "真题" }[scope];
      showMessage(controller, `正在读取“${scopeName}”范围的题目列表…`);
      Promise.resolve().then(function () {
        return __DAGUANYUAN_MATH_IMPORT_GLOBAL__.importCategory(controller.addon, categoryId, scope, function (value) {
          if (value.phase === "importing" || selecting && value.phase === "fetching") {
            progress(value);
          }
        }, beforeImport);
      }).then(function (result) {
        injectRetestButtons(controller);
        if (result.failed.length) console.log(`[Daguanyuan Bridge] 分类导入失败详情：${__DAGUANYUAN_IMPORT_REPORT_GLOBAL__.textFor(result)}`);
        showCategoryImportResult(controller, result, "当前分类没有直接归属的题目", selectionTask);
      }).catch(function (failure) {
        const result = failure.importResult || { failed: [] };
        result.interrupted = String(failure && failure.message || failure);
        report(result);
      }).then(function () { finishCategoryImport(controller); }, function (failure) {
        finishCategoryImport(controller);
        console.log(`[Daguanyuan Bridge] 导入结束提示失败：${String(failure && failure.message || failure)}`);
      });
    });
  }

  function injectRetestButtons(controller) {
    if (!controller || !controller.webView) return;
    try {
      controller.webView.evaluateJavaScript(__DAGUANYUAN_RETEST_BRIDGE_GLOBAL__.script(websiteLocateCardsVisible(), noteAddVisible()), function (result, error) {
        if (error) console.log(`[Daguanyuan Bridge] 注入错题定位按钮失败：${error.localizedDescription || error}`);
      });
    } catch (error) {
      console.log(`[Daguanyuan Bridge] 注入错题定位按钮失败：${error && error.message || error}`);
    }
  }

  function injectWebsiteLocateButtons(controller) {
    if (!controller || !controller.webView) return;
    injectRetestButtons(controller);
    try {
      controller.webView.evaluateJavaScript(__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__.practiceScript(websiteLocateCardsVisible(), noteAddVisible()), function (result, error) {
        if (error) console.log(`[Daguanyuan Bridge] 注入题目定位按钮失败：${error.localizedDescription || error}`);
      });
    } catch (error) {
      console.log(`[Daguanyuan Bridge] 注入网页按钮失败：${error && error.message || error}`);
    }
  }

  function finishSingleImport(controller) {
    controller.singleImportBusy = false;
    try {
      controller.webView.evaluateJavaScript("window.__DAGUANYUAN_SINGLE_IMPORT_BUTTONS__&&window.__DAGUANYUAN_SINGLE_IMPORT_BUTTONS__.finishImport()", function () {});
    } catch (error) { console.log(`[Daguanyuan Bridge] 恢复单题导入按钮失败：${error && error.message || error}`); }
  }

  function handleSingleImport(controller, address) {
    if (controller.singleImportBusy) return;
    try {
      if (controller.categoryImportBusy) throw new Error("正在导入整类题目，请稍后再导入本题");
      if (controller.questionToolBusy) throw new Error("正在读取当前题目，请稍后导入");
      if (!singleImportVisible()) throw new Error("请先在设置的题目工具中开启显示导入本题");
      const target = __DAGUANYUAN_SINGLE_IMPORT_GLOBAL__.targetFromAddress(address);
      if (target.provider !== controller.currentContentPage) throw new Error("题库页面已切换，请重新点击导入本题");
      controller.singleImportBusy = true;
      const position = __DAGUANYUAN_SINGLE_IMPORT_GLOBAL__.position();
      const operation = __DAGUANYUAN_SINGLE_IMPORT_GLOBAL__.importQuestion(controller, target, position);
      showMessage(controller, position === "sibling" ? "正在将此题导入为所选卡片的同级节点…" : "正在将此题导入为所选卡片的子节点…");
      operation.then(function (result) {
        showCategoryImportResult(controller, result, "没有可导入的题目");
      }).catch(function (error) {
        if (error.importResult) {
          error.importResult.interrupted = String(error.message || error);
          showImportReport(controller, error.importResult);
        } else showMessage(controller, String(error && error.message || error));
      }).then(function () { finishSingleImport(controller); }, function (error) {
        finishSingleImport(controller);
        console.log(`[Daguanyuan Bridge] 单题导入结束提示失败：${error && error.message || error}`);
      });
    } catch (error) {
      finishSingleImport(controller);
      showMessage(controller, String(error && error.message || error));
    }
  }

  function injectSingleImportButtons(controller) {
    if (!controller || !controller.webView) return;
    try {
      controller.webView.evaluateJavaScript(__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__.singleImportScript(singleImportVisible()), function (result, error) {
        if (error) console.log(`[Daguanyuan Bridge] 注入单题导入按钮失败：${error.localizedDescription || error}`);
      });
    } catch (error) { console.log(`[Daguanyuan Bridge] 注入单题导入按钮失败：${error && error.message || error}`); }
  }

  function finishQuestionTool(controller, method) {
    try {
      controller.webView.evaluateJavaScript("window.__DAGUANYUAN_QUESTION_TOOLS__&&window.__DAGUANYUAN_QUESTION_TOOLS__." + method + "()", function () {});
    } catch (error) { console.log(`[Daguanyuan Bridge] 恢复题目工具按钮失败：${error && error.message || error}`); }
  }

  function handleCardLocate(controller, questionId, provider) {
    if (controller.categoryImportBusy || controller.singleImportBusy || controller.questionToolBusy) {
      showMessage(controller, "题目正在读取、导入或定位，请稍后重试");
      if (!controller.cardLocationActive) finishQuestionTool(controller, "finishLocate");
      return Promise.resolve();
    }
    controller.questionToolBusy = true;
    controller.cardLocationActive = true;
    return Promise.resolve().then(function () {
      return __DAGUANYUAN_MATH_IMPORT_GLOBAL__.focusQuestion(controller.addon, questionId, provider);
    }).then(function () {
      controller.questionToolBusy = false;
      controller.cardLocationActive = false;
      finishQuestionTool(controller, "finishLocate");
      showMessage(controller, "已定位脑图卡片");
      performClosePanel(controller);
    }, function (error) {
      controller.questionToolBusy = false;
      controller.cardLocationActive = false;
      finishQuestionTool(controller, "finishLocate");
      showMessage(controller, String(error && error.message || error));
    });
  }

  function handle408QuestionTool(controller, address, addingNote) {
    const finishMethod = addingNote ? "finishNotePaste" : "finishLocate";
    let ownsLookup = false;
    try {
      if (controller.currentContentPage !== "408") throw new Error("请先进入 408 题目页");
      if (addingNote && !noteAddVisible()) throw new Error("添加笔记暂不可用");
      if (!addingNote && !websiteLocateCardsVisible()) throw new Error("请先开启对应的题目工具开关");
      if (controller.categoryImportBusy || controller.singleImportBusy || controller.questionToolBusy) throw new Error("题目正在读取或导入，请稍后重试");
      if (addingNote && controller.notePasteOperation) throw new Error("上一张图片仍在添加中，请稍候");
      const target = __DAGUANYUAN_SINGLE_IMPORT_GLOBAL__.targetFromAddress(address);
      if (target.provider !== "408") throw new Error("408 题目参数无效");
      controller.questionToolBusy = true;
      ownsLookup = true;
      __DAGUANYUAN_408_IMPORT_GLOBAL__.resolveQuestion(controller, target).then(function (question) {
        controller.questionToolBusy = false;
        if (!addingNote) {
          return handleCardLocate(controller, question.id, "408");
        }
        return __DAGUANYUAN_408_NOTE_PASTE_GLOBAL__.start(controller, question).then(function (token) {
          if (controller.notePasteOperation && controller.notePasteOperation.token === token) showMessage(controller, "正在添加图片，等待 408 网站保存");
        });
      }).catch(function (error) {
        controller.questionToolBusy = false;
        finishQuestionTool(controller, finishMethod);
        showMessage(controller, String(error && error.message || error));
      });
    } catch (error) {
      if (ownsLookup) controller.questionToolBusy = false;
      if (addingNote || !controller.cardLocationActive) finishQuestionTool(controller, finishMethod);
      showMessage(controller, String(error && error.message || error));
    }
  }

  function injectWebsiteButtons(controller) {
    injectBindCategoryButton(controller);
    if (typeof __DAGUANYUAN_IMPORT_SELECTION_GLOBAL__ !== 'undefined') {
      __DAGUANYUAN_IMPORT_SELECTION_GLOBAL__.inject(controller).catch(function (error) { console.log('[Daguanyuan Bridge] 导入界面加载失败：' + error.message); });
    }
    injectWebsiteLocateButtons(controller);
    injectSingleImportButtons(controller);
  }

  function injectExerciseQuestion(controller) {
    const token = Number(controller.exerciseQuestionRequestToken || 0) + 1;
    controller.exerciseQuestionRequestToken = token;
    controller.webView.evaluateJavaScript(__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__.exerciseQuestionScript(), function (result, error) {
      if (error) {
        showMessage(controller, "题目页面已打开，但自动选题失败");
        console.log(`[Daguanyuan Bridge] 注入题目选题失败：${error.localizedDescription || error}`);
      }
      const key = String(result || "");
      if (!/^(?:year:)?\d+:\d+$/.test(key) || typeof NSTimer === "undefined" || !NSTimer.scheduledTimerWithTimeInterval) return;
      NSTimer.scheduledTimerWithTimeInterval(90.5, false, function () {
        if (controller.exerciseQuestionRequestToken !== token) return;
        controller.webView.evaluateJavaScript("document.documentElement.getAttribute('data-daguanyuan-408-question-locator') || ''", function (status) {
          if (controller.exerciseQuestionRequestToken === token && String(status || "") === "failed:" + key) {
            showMessage(controller, "已打开对应题目范围，但未能自动选中目标题，请手动选择或重新定位");
          }
        });
      });
    });
  }

  function injectBindCategoryButton(controller) {
    if (!controller || !controller.webView) return;
    controller.webView.evaluateJavaScript(__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__.bindCategoryScript(bindCategoryVisible(), categoryImportVisible(), selectionImportVisible()), function (result, error) {
      if (error) console.log(`[Daguanyuan Bridge] 注入分类绑定按钮失败：${error.localizedDescription || error}`);
    });
  }

  function bindCurrentCategory(controller) {
    let source;
    try {
      source = __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.currentCategorySource(controller.addon);
    } catch (error) {
      showMessage(controller, error && error.message ? error.message : String(error));
      return;
    }
    controller.webView.evaluateJavaScript("String(window.location.href || '')", function (result) {
      try {
        if (controller.currentContentPage === "408") {
          const binding = __DAGUANYUAN_CATEGORY_MAPPING_STORE_GLOBAL__.save408Binding(source, result);
          showMessage(controller, `已绑定：${source.parentTitle} → ${binding.targetURL}`);
          return;
        }
        const categoryId = __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.categoryIdFromURL(result);
        if (!categoryId) throw new Error("请先进入一个具体的大观园题型分类");
        const target = __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.resultForCategoryId(categoryId);
        if (target.status !== "resolved") throw new Error("当前大观园分类不在本地分类数据中");
        __DAGUANYUAN_CATEGORY_MAPPING_STORE_GLOBAL__.saveBinding(source, categoryId);
        showMessage(controller, `已绑定：${source.parentTitle} → ${target.name}`);
      } catch (error) {
        showMessage(controller, error && error.message ? error.message : String(error));
      }
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

    toggleMNBrowserIntegration: function (sender) {
      __DAGUANYUAN_PLUGIN_INTEGRATION_SETTINGS_GLOBAL__.toggle(self, sender);
    },

    selectCardLocationChoice: function (sender) {
      __DAGUANYUAN_CARD_LOCATOR_UI_GLOBAL__.select(self, Number(sender && sender.tag), sender);
    },

    cancelCardLocationChoice: function () {
      __DAGUANYUAN_CARD_LOCATOR_UI_GLOBAL__.cancel(self);
    },

    chooseCardLocationMode: function () {
      const controller = self;
      try {
        __DAGUANYUAN_CARD_LOCATOR_UI_GLOBAL__.chooseMode(controller, __DAGUANYUAN_CARD_LOCATOR_GLOBAL__.mode(), function (requested) {
          try {
            __DAGUANYUAN_CARD_LOCATOR_GLOBAL__.setMode(requested);
            refreshWebsiteLocateSetting(controller);
          } catch (error) { showMessage(controller, String(error && error.message || error)); }
        });
      } catch (error) { showMessage(controller, String(error && error.message || error)); }
    },

    selectCardLocationMode: function (sender) {
      __DAGUANYUAN_CARD_LOCATOR_UI_GLOBAL__.selectMode(self, Number(sender && sender.tag), sender);
    },

    chooseSingleImportPosition: function () {
      const controller = self;
      try {
        __DAGUANYUAN_CARD_LOCATOR_UI_GLOBAL__.chooseOption(controller, "导入本题位置",
          ["child", "sibling"], ["所选卡片的子节点", "所选卡片的同级节点"],
          __DAGUANYUAN_SINGLE_IMPORT_GLOBAL__.position(), "selectSingleImportPosition:", function (requested) {
            try {
              __DAGUANYUAN_SINGLE_IMPORT_GLOBAL__.setPosition(requested);
              refreshSingleImportSetting(controller);
            } catch (error) { showMessage(controller, String(error && error.message || error)); }
          });
      } catch (error) { showMessage(controller, String(error && error.message || error)); }
    },

    selectSingleImportPosition: function (sender) {
      __DAGUANYUAN_CARD_LOCATOR_UI_GLOBAL__.selectMode(self, Number(sender && sender.tag), sender);
    },

    openDaguanyuan: function () {
      if (self.currentContentPage === "math") setActivePage(self, "math");
      else loadURL(self, DAGUANYUAN_HOME_URL, "daguanyuan");
    },

    open408: function () {
      if (self.currentContentPage === "408") setActivePage(self, "408");
      else loadURL(self, OS408_HOME_URL, "408os");
    },

    openImport: function () {
      setActivePage(self, 'import');
      if (self.importReportView) self.importReportView.hidden = true;
      if (!self.importWorkspaceLoaded) {
        self.importWorkspaceLoaded = true;
        self.importWebView.loadHTMLStringBaseURL(__DAGUANYUAN_IMPORT_WORKSPACE_HTML__, null);
      } else {
        self.importWebView.evaluateJavaScript('window.__DAGUANYUAN_IMPORT_WORKSPACE__&&window.__DAGUANYUAN_IMPORT_WORKSPACE__.resume()', function () {});
      }
    },

    openSettings: function (sender) {
      setActivePage(self, "settings");
    },

    selectSettingsSection: function (sender) { __DAGUANYUAN_SETTINGS_NAVIGATION_GLOBAL__.select(self, sender); },
    openPluginGuide: function () { __DAGUANYUAN_ABOUT_SETTINGS_GLOBAL__.open(self); },
    resetSettingsPanelFrame: function () {
      resetPanelFrame(self);
    },
    resetPanelOnDoubleTap: function (recognizer) {
      if (recognizer.state !== 3) return;
      const point = recognizer.locationInView(self.titleBar);
      // 导航标签与关闭按钮保留各自操作，仅空白处双击重置。
      const controls = [self.homeButton, self.os408Button, self.importButton, self.settingsButton, self.closeButton];
      if (controls.some(control => {
        const frame = control.frame;
        return point.x >= frame.x && point.x <= frame.x + frame.width
          && point.y >= frame.y && point.y <= frame.y + frame.height;
      })) return;
      resetPanelFrame(self);
    },

    closeCategoryImportReport: function () {
      __DAGUANYUAN_IMPORT_REPORT_GLOBAL__.close(self);
    },

    copyCategoryImportReport: function () {
      if (__DAGUANYUAN_IMPORT_REPORT_GLOBAL__.copy(self)) showMessage(self, "已复制导入详情");
    },

    bindCurrentCategory: function (sender) {
      bindCurrentCategory(self);
    },

    openCategoryManager: function (sender) {
      setActivePage(self, "category-manager");
    },

    closeCategoryManager: function (sender) {
      setActivePage(self, "settings");
    },

    toggleMasteryMarking: function () { __DAGUANYUAN_CARD_TOOLS_SETTINGS_GLOBAL__.toggle(self); },
    toggleSourceCommentFold: function (sender) { __DAGUANYUAN_CARD_TOOLS_SETTINGS_GLOBAL__.toggleFold(self, sender); },
    openImportedCardManagement: function () { __DAGUANYUAN_CARD_TOOLS_SETTINGS_GLOBAL__.openManagement(self); },
    selectImportedCardManagement: function (sender) { __DAGUANYUAN_CARD_LOCATOR_UI_GLOBAL__.selectMode(self, Number(sender && sender.tag), sender); },
    confirmCardRepair: function (sender) { __DAGUANYUAN_CARD_REPAIR_UI_GLOBAL__.confirm(self, sender); },
    cancelCardRepair: function (sender) { __DAGUANYUAN_CARD_REPAIR_UI_GLOBAL__.cancel(self); },

    updateCategoryCatalog: function (sender) {
      __DAGUANYUAN_CATEGORY_MANAGER_UI_GLOBAL__.setUpdating(self, true);
      __DAGUANYUAN_CATEGORY_CATALOG_STORE_GLOBAL__.fetchLatest(function (error, result) {
        __DAGUANYUAN_CATEGORY_MANAGER_UI_GLOBAL__.setUpdating(self, false);
        if (error) {
          showMessage(self, `更新失败：${error && error.message ? error.message : error}`);
          return;
        }
        try {
          __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.replaceCatalog(result.catalog);
          __DAGUANYUAN_CATEGORY_MANAGER_UI_GLOBAL__.refresh(self);
          const changes = result.changes;
          showMessage(self, `分类数据已更新：新增 ${changes.added}，变更 ${changes.changed}，失效 ${changes.removed}`);
        } catch (reloadError) {
          showMessage(self, reloadError && reloadError.message ? reloadError.message : String(reloadError));
        }
      });
    },

    openManagedBinding: function (sender) {
      try {
        const binding = self.categoryManagerBindings[Number(sender && sender.tag)];
        if (!binding) throw new Error("未找到这条题型绑定");
        if (binding.provider === "408") {
          loadURL(self, binding.targetURL, "408os");
          return;
        }
        const target = __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.resultForCategoryId(binding.targetCategoryId);
        if (target.status !== "resolved") throw new Error("这条绑定的目标分类已经失效");
        const url = __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.urlFor(target);
        if (!url) throw new Error("题型分类地址无效");
        openDaguanyuanCategory(self, url);
      } catch (error) {
        showMessage(self, error && error.message ? error.message : String(error));
      }
    },

    deleteManagedBinding: function (sender) {
      try {
        const binding = self.categoryManagerBindings[Number(sender && sender.tag)];
        if (!binding) throw new Error("未找到这条题型绑定");
        const deleted = __DAGUANYUAN_CATEGORY_MAPPING_STORE_GLOBAL__.deleteBinding(binding.key, binding.provider);
        __DAGUANYUAN_CATEGORY_MANAGER_UI_GLOBAL__.refresh(self);
        showMessage(self, deleted ? `已删除：${binding.parentTitle || "未命名题型"}` : "这条绑定已经不存在");
      } catch (error) {
        showMessage(self, error && error.message ? error.message : String(error));
      }
    },

    clearCategoryBindings: function (sender) {
      try {
        const count = __DAGUANYUAN_CATEGORY_MAPPING_STORE_GLOBAL__.clearBindings();
        __DAGUANYUAN_CATEGORY_MANAGER_UI_GLOBAL__.refresh(self);
        showMessage(self, count ? `已清除 ${count} 条题型绑定` : "当前没有题型绑定");
      } catch (error) {
        showMessage(self, error && error.message ? error.message : String(error));
      }
    },

    toggleCategoryDisplay: function (sender) {
      const requested = sender && typeof sender.on !== "undefined"
        ? Boolean(sender.on)
        : !__DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.categoryEnabled();
      __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.setCategoryEnabled(requested);
      if (self.addon) {
        __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.show(self.addon);
      }
      refreshCategorySetting(self);
    },

    toggleCategoryJump: function (sender) {
      const requested = sender && typeof sender.on !== "undefined"
        ? Boolean(sender.on)
        : !__DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.categoryJumpEnabled();
      __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.setCategoryJumpEnabled(requested);
      refreshCategoryJumpSetting(self);
    },

    toggleBindCategoryDisplay: function (sender) {
      const requested = sender && typeof sender.on !== "undefined" ? Boolean(sender.on) : !bindCategoryVisible();
      NSUserDefaults.standardUserDefaults().setObjectForKey(requested, "cn.marginnote.daguanyuan-bridge.category-navigation.bind-button-visible");
      refreshBindCategorySetting(self);
      injectBindCategoryButton(self);
    },

    toggleSelectionImportDisplay: function (sender) {
      const requested = sender && typeof sender.on !== "undefined" ? Boolean(sender.on) : !selectionImportVisible();
      NSUserDefaults.standardUserDefaults().setObjectForKey(requested, SELECTION_IMPORT_KEY);
      refreshCategoryImportSetting(self);
      injectBindCategoryButton(self);
    },

    toggleCategoryImportDisplay: function (sender) {
      const requested = sender && typeof sender.on !== "undefined" ? Boolean(sender.on) : !categoryImportVisible();
      NSUserDefaults.standardUserDefaults().setObjectForKey(requested, CATEGORY_IMPORT_KEY);
      refreshCategoryImportSetting(self);
      injectBindCategoryButton(self);
    },

    toggleQuestionLocator: function (sender) {
      const requested = sender && typeof sender.on !== "undefined"
        ? Boolean(sender.on)
        : !__DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.questionLocatorEnabled();
      __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.setQuestionLocatorEnabled(requested);
      if (self.addon) __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.syncQuestionLocator(self.addon);
      refreshQuestionLocatorSetting(self);
    },

    toggleWebsiteLocateCards: function (sender) {
      const requested = sender && typeof sender.on !== "undefined" ? Boolean(sender.on) : !websiteLocateCardsVisible();
      NSUserDefaults.standardUserDefaults().setObjectForKey(requested, WEBSITE_LOCATE_KEY);
      refreshWebsiteLocateSetting(self);
      injectWebsiteLocateButtons(self);
    },

    toggleNoteAddDisplay: function (sender) {
      refreshNoteAddSetting(self);
      injectWebsiteLocateButtons(self);
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

    toggleSingleImportDisplay: function (sender) {
      const requested = sender && typeof sender.on !== "undefined" ? Boolean(sender.on) : !singleImportVisible();
      NSUserDefaults.standardUserDefaults().setObjectForKey(requested, SINGLE_IMPORT_KEY);
      refreshSingleImportSetting(self);
      injectSingleImportButtons(self);
    },

    webViewShouldStartLoadWithRequestNavigationType: function (webView, request) {
      const address = requestAddress(request);
      if (webView === self.import408Worker) return /^https:\/\/www\.408os\.cn\//.test(address) || address === 'about:blank';
      if (webView === self.importWebView) {
        if (/^daguanyuanbridge:\/\/ui\?/.test(address)) {
          __DAGUANYUAN_WEB_BRIDGE_COMMANDS_GLOBAL__.handle({ controller: self, webView, isImportWorkspace: true }, address);
          return false;
        }
        return !address || address === 'about:blank';
      }
      if (webView === self.webView && /^daguanyuanbridge:\/\/ui\?/.test(address)) {
        const controller = self;
        __DAGUANYUAN_WEB_BRIDGE_COMMANDS_GLOBAL__.handle({ controller,
          openCategory: function (scope) { handleCategoryImport(controller, scope, true); },
          bindCategory: function () { bindCurrentCategory(controller); },
        }, address);
        return false;
      }
      if (webView === self.webView && /^daguanyuanbridge:\/\/import-single\?/i.test(address)) {
        handleSingleImport(self, address);
        return false;
      }
      if (webView === self.webView && __DAGUANYUAN_VIDEO_BROWSER_GLOBAL__.handles(address)) {
        const controller = self;
        if (controller.videoOpening) return false;
        controller.videoOpening = true;
        __DAGUANYUAN_VIDEO_BROWSER_GLOBAL__.open(address, function (message) { showMessage(controller, message); }, controller.addon.window).then(function (opened) {
          controller.videoOpening = false;
          if (opened) performClosePanel(controller);
        }, function (error) {
          controller.videoOpening = false;
          showMessage(controller, "打开视频失败：" + String(error && error.message || error));
        });
        return false;
      }
      if (webView === self.webView && /^daguanyuanbridge:\/\/import-category(?:[/?#]|$)/i.test(address)) {
        handleCategoryImport(self);
        return false;
      }
      if (webView === self.webView && /^daguanyuanbridge:\/\/locate-card\?/i.test(address)) {
        if (/[?&]payload=/.test(address)) { handle408QuestionTool(self, address, false); return false; }
        try {
          const match = address.match(/[?&]id=(\d+)/);
          if (!match) throw new Error("题目 ID 无效");
          handleCardLocate(self, Number(match[1]));
        } catch (error) {
          showMessage(self, String(error && error.message || error));
          finishQuestionTool(self, "finishLocate");
        }
        return false;
      }
      if (webView === self.webView && /^daguanyuanbridge:\/\/add-note-result\?/i.test(address)) {
        const token = (address.match(/[?&]token=([0-9-]+)/) || ["", ""])[1];
        const status = (address.match(/[?&]status=([a-z]+)/i) || ["", ""])[1];
        const message = __DAGUANYUAN_NOTE_PASTE_GLOBAL__.result(self, token, status);
        if (message) { finishQuestionTool(self, "finishNotePaste"); showMessage(self, message); }
        return false;
      }
      if (webView === self.webView && /^daguanyuanbridge:\/\/add-note\?/i.test(address)) {
        if (/[?&]payload=/.test(address)) { handle408QuestionTool(self, address, true); return false; }
        const match = address.match(/[?&]id=(\d+)/);
        if (!noteAddVisible() || !match) { finishQuestionTool(self, "finishNotePaste"); showMessage(self, "添加笔记暂不可用"); return false; }
        __DAGUANYUAN_NOTE_PASTE_GLOBAL__.start(self, Number(match[1])).then(function (token) {
          if (self.notePasteOperation && self.notePasteOperation.token === token) showMessage(self, "正在添加图片，等待网站保存");
        }).catch(function (error) {
          finishQuestionTool(self, "finishNotePaste");
          showMessage(self, String(error && error.message || error));
        });
        return false;
      }
      if (webView === self.webView && /^daguanyuanbridge:\/\/bind-category(?:[/?#]|$)/i.test(address)) {
        bindCurrentCategory(self);
        return false;
      }
      return true;
    },

    webViewDidFinishLoad: function (webView) {
      if (webView === self.import408Worker) { __DAGUANYUAN_408_WORKSPACE_GLOBAL__.loaded(self, webView); return; }
      if (webView === self.webView) {
        injectVideoPopupCompatibility(self);
        injectWebsiteButtons(self);
        injectExerciseQuestion(self);
        self.webView.evaluateJavaScript("String(window.location.href || '')", function (result, error) {
          const address = String(result || "");
          const isLogin = /\/login(?:[/?#]|$)/i.test(address);
          if (!isLogin) injectQuestionLocator(self);
        });
      }
    },

    webViewDidFailLoadWithError: function (webView, error) {
      const errorCodeValue = error && error.code;
      const errorCode = Number(typeof errorCodeValue === "function" ? errorCodeValue.call(error) : errorCodeValue);
      if (errorCode === -999) return;
      if (webView === self.import408Worker) { __DAGUANYUAN_408_WORKSPACE_GLOBAL__.failed(self, webView, error); return; }
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
    refreshCategorySetting(controller);
    refreshCategoryJumpSetting(controller);
    refreshQuestionLocatorSetting(controller);
    refreshWebsiteLocateSetting(controller);
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
    openDaguanyuanCategory,
    open408Page,
    openDaguanyuanQuestion,
    currentQuestionScope,
    open408Question,
    questionLocatorScript,
    prepareCategoryBinding,
    shouldRestorePanel,
    refreshCategorySetting,
    refreshCategoryJumpSetting,
    refreshQuestionLocatorSetting,
    refreshRetestButtons: injectWebsiteButtons,
  };
})();
