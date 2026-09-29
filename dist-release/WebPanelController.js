var __DAGUANYUAN_WEB_PANEL_GLOBAL__ = (function () {
  const DAGUANYUAN_HOME_URL = "https://cxyonly.fans/math";
  const OS408_HOME_URL = "https://www.408os.cn/overview";
  const FRAME_KEY = "cn.marginnote.daguanyuan-bridge.panel-frame";
  const PANEL_KEY = "cn.marginnote.daguanyuan-bridge.panel-visible";
  const WEBSITE_LOCATE_KEY = "cn.marginnote.daguanyuan-bridge.question-navigation.website-locate-card-visible";
  const CATEGORY_IMPORT_KEY = "cn.marginnote.daguanyuan-bridge.question-navigation.import-category-visible";
  const NOTE_ADD_KEY = "cn.marginnote.daguanyuan-bridge.question-tools.add-note-visible";
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
    controller.settingsPage.contentSize = { width: contentFrame.width, height: Math.max(contentFrame.height + 1, 1128) };
    __DAGUANYUAN_CATEGORY_MANAGER_UI_GLOBAL__.layout(controller, contentFrame);
    controller.focusSettingsSection.frame = { x: 20, y: 18, width: sectionWidth, height: 336 };
    controller.categorySettingsSection.frame = { x: 20, y: 366, width: sectionWidth, height: 336 };
    controller.questionNavigationSettingsSection.frame = { x: 20, y: 714, width: sectionWidth, height: 266 };
    controller.questionToolsSettingsSection.frame = { x: 20, y: 992, width: sectionWidth, height: 124 };
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
    controller.previousTitle.frame = { x: 20, y: 271, width: Math.max(0, sectionWidth - 110), height: 24 };
    controller.previousDescription.frame = { x: 20, y: 297, width: Math.max(0, sectionWidth - 110), height: 18 };
    controller.previousSwitch.frame = { x: Math.max(20, sectionWidth - 68), y: 279, width: 51, height: 31 };
    controller.categorySectionTitle.frame = { x: 20, y: 12, width: Math.max(0, sectionWidth - 40), height: 28 };
    controller.categorySectionDivider.frame = { x: 20, y: 48, width: Math.max(0, sectionWidth - 40), height: 1 };
    controller.categoryTitle.frame = { x: 20, y: 61, width: Math.max(0, sectionWidth - 110), height: 24 };
    controller.categoryDescription.frame = { x: 20, y: 87, width: Math.max(0, sectionWidth - 110), height: 18 };
    controller.categorySwitch.frame = { x: Math.max(20, sectionWidth - 68), y: 69, width: 51, height: 31 };
    controller.categoryDivider.frame = { x: 20, y: 118, width: Math.max(0, sectionWidth - 40), height: 1 };
    controller.categoryJumpTitle.frame = { x: 20, y: 131, width: Math.max(0, sectionWidth - 110), height: 24 };
    controller.categoryJumpDescription.frame = { x: 20, y: 157, width: Math.max(0, sectionWidth - 110), height: 18 };
    controller.categoryJumpSwitch.frame = { x: Math.max(20, sectionWidth - 68), y: 139, width: 51, height: 31 };
    controller.bindCategoryDivider.frame = { x: 20, y: 188, width: Math.max(0, sectionWidth - 40), height: 1 };
    controller.bindCategoryTitle.frame = { x: 20, y: 201, width: Math.max(0, sectionWidth - 110), height: 24 };
    controller.bindCategoryDescription.frame = { x: 20, y: 227, width: Math.max(0, sectionWidth - 110), height: 18 };
    controller.bindCategorySwitch.frame = { x: Math.max(20, sectionWidth - 68), y: 209, width: 51, height: 31 };
    controller.categoryManageDivider.frame = { x: 20, y: 258, width: Math.max(0, sectionWidth - 40), height: 1 };
    controller.categoryManageTitle.frame = { x: 20, y: 271, width: Math.max(0, sectionWidth - 90), height: 24 };
    controller.categoryManageDescription.frame = { x: 20, y: 297, width: Math.max(0, sectionWidth - 90), height: 18 };
    controller.categoryManageChevron.frame = { x: Math.max(20, sectionWidth - 52), y: 273, width: 30, height: 36 };
    controller.categoryManageButton.frame = { x: 0, y: 259, width: sectionWidth, height: 76 };
    controller.questionNavigationSectionTitle.frame = { x: 20, y: 12, width: Math.max(0, sectionWidth - 40), height: 28 };
    controller.questionNavigationDivider.frame = { x: 20, y: 48, width: Math.max(0, sectionWidth - 40), height: 1 };
    controller.questionLocatorTitle.frame = { x: 20, y: 61, width: Math.max(0, sectionWidth - 110), height: 24 };
    controller.questionLocatorDescription.frame = { x: 20, y: 87, width: Math.max(0, sectionWidth - 110), height: 18 };
    controller.questionLocatorSwitch.frame = { x: Math.max(20, sectionWidth - 68), y: 69, width: 51, height: 31 };
    controller.websiteLocateDivider.frame = { x: 20, y: 118, width: Math.max(0, sectionWidth - 40), height: 1 };
    controller.websiteLocateTitle.frame = { x: 20, y: 131, width: Math.max(0, sectionWidth - 110), height: 24 };
    controller.websiteLocateDescription.frame = { x: 20, y: 157, width: Math.max(0, sectionWidth - 110), height: 18 };
    controller.websiteLocateSwitch.frame = { x: Math.max(20, sectionWidth - 68), y: 139, width: 51, height: 31 };
    controller.categoryImportDivider.frame = { x: 20, y: 188, width: Math.max(0, sectionWidth - 40), height: 1 };
    controller.categoryImportTitle.frame = { x: 20, y: 201, width: Math.max(0, sectionWidth - 110), height: 24 };
    controller.categoryImportDescription.frame = { x: 20, y: 227, width: Math.max(0, sectionWidth - 110), height: 18 };
    controller.categoryImportSwitch.frame = { x: Math.max(20, sectionWidth - 68), y: 209, width: 51, height: 31 };
    controller.questionToolsTitle.frame = { x: 20, y: 12, width: Math.max(0, sectionWidth - 40), height: 28 };
    controller.questionToolsDivider.frame = { x: 20, y: 48, width: Math.max(0, sectionWidth - 40), height: 1 };
    controller.noteAddTitle.frame = { x: 20, y: 61, width: Math.max(0, sectionWidth - 110), height: 24 };
    controller.noteAddDescription.frame = { x: 20, y: 87, width: Math.max(0, sectionWidth - 110), height: 18 };
    controller.noteAddSwitch.frame = { x: Math.max(20, sectionWidth - 68), y: 69, width: 51, height: 31 };
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
    controller.activePage = page;
    const nativePage = page === "settings" || page === "category-manager";
    controller.webView.hidden = nativePage;
    controller.settingsPage.hidden = page !== "settings";
    controller.categoryManagerPage.hidden = page !== "category-manager";
    if (page === "settings") {
      refreshFocusSetting(controller);
      refreshCrossLevelSetting(controller);
      refreshProgressSetting(controller);
      refreshCategorySetting(controller);
      refreshCategoryJumpSetting(controller);
      refreshBindCategorySetting(controller);
      refreshQuestionLocatorSetting(controller);
      refreshWebsiteLocateSetting(controller);
      refreshNoteAddSetting(controller);
      refreshCategoryImportSetting(controller);
      refreshPreviousSetting(controller);
    } else if (page === "category-manager") {
      __DAGUANYUAN_CATEGORY_MANAGER_UI_GLOBAL__.refresh(controller);
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
  }

  function noteAddVisible() {
    try {
      const value = NSUserDefaults.standardUserDefaults().objectForKey(NOTE_ADD_KEY);
      if (value === undefined || value === null) return false;
      if (typeof value.booleanValue === "function") return Boolean(value.booleanValue());
      return value === true || value === 1 || String(value).toLowerCase() === "true";
    } catch (ignored) { return false; }
  }

  function refreshNoteAddSetting(controller) {
    if (controller && controller.noteAddSwitch) controller.noteAddSwitch.on = noteAddVisible();
  }

  function categoryImportVisible() {
    try {
      const value = NSUserDefaults.standardUserDefaults().objectForKey(CATEGORY_IMPORT_KEY);
      if (value === undefined || value === null) return false;
      if (typeof value.booleanValue === "function") return Boolean(value.booleanValue());
      return value === true || value === 1 || String(value).toLowerCase() === "true";
    } catch (ignored) { return false; }
  }

  function refreshCategoryImportSetting(controller) {
    if (controller && controller.categoryImportSwitch) controller.categoryImportSwitch.on = categoryImportVisible();
  }

  function refreshCrossLevelSetting(controller) {
    if (!controller || !controller.crossLevelSwitch) return;
    controller.crossLevelSwitch.on = __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.crossLevelEnabled();
  }

  function prepareCategoryBinding(controller, message) {
    if (!controller) throw new Error("大观园面板当前不可用");
    showPanel(controller);
    if (controller.currentContentPage === "math") setActivePage(controller, "math");
    else loadURL(controller, DAGUANYUAN_HOME_URL, "daguanyuan");
    showMessage(controller, String(message || "请进入正确的大观园分类后点击“绑定当前分类”"));
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

    controller.settingsPage = new UIScrollView({ x: 0, y: TITLE_HEIGHT, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT - TITLE_HEIGHT });
    controller.settingsPage.backgroundColor = UIColor.colorWithWhiteAlpha(0.96, 1);
    controller.settingsPage.showsVerticalScrollIndicator = true;
    controller.settingsPage.alwaysBounceVertical = true;
    controller.settingsPage.hidden = true;
    controller.containerView.addSubview(controller.settingsPage);
    __DAGUANYUAN_CATEGORY_MANAGER_UI_GLOBAL__.setup(controller);

    controller.focusSettingsSection = new UIView({ x: 20, y: 18, width: DEFAULT_WIDTH - 40, height: 336 });
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

    controller.categorySettingsSection = new UIView({ x: 20, y: 366, width: DEFAULT_WIDTH - 40, height: 336 });
    controller.categorySettingsSection.backgroundColor = UIColor.whiteColor();
    controller.categorySettingsSection.layer.cornerRadius = 10;
    controller.categorySettingsSection.layer.borderWidth = 0.5;
    controller.categorySettingsSection.layer.borderColor = UIColor.lightGrayColor().colorWithAlphaComponent(0.45);
    controller.settingsPage.addSubview(controller.categorySettingsSection);

    controller.categorySectionTitle = label("题型导航", UIFont.boldSystemFontOfSize(17), UIColor.darkGrayColor());
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

    controller.bindCategoryTitle = label("显示绑定当前分类", UIFont.boldSystemFontOfSize(16), UIColor.darkGrayColor());
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

    controller.questionNavigationSettingsSection = new UIView({ x: 20, y: 714, width: DEFAULT_WIDTH - 40, height: 266 });
    controller.questionNavigationSettingsSection.backgroundColor = UIColor.whiteColor();
    controller.questionNavigationSettingsSection.layer.cornerRadius = 10;
    controller.questionNavigationSettingsSection.layer.borderWidth = 0.5;
    controller.questionNavigationSettingsSection.layer.borderColor = UIColor.lightGrayColor().colorWithAlphaComponent(0.45);
    controller.settingsPage.addSubview(controller.questionNavigationSettingsSection);

    controller.questionNavigationSectionTitle = label("题目导航", UIFont.boldSystemFontOfSize(17), UIColor.darkGrayColor());
    controller.questionNavigationSettingsSection.addSubview(controller.questionNavigationSectionTitle);

    controller.questionNavigationDivider = new UIView({ x: 20, y: 48, width: DEFAULT_WIDTH - 80, height: 1 });
    controller.questionNavigationDivider.backgroundColor = UIColor.lightGrayColor().colorWithAlphaComponent(0.4);
    controller.questionNavigationSettingsSection.addSubview(controller.questionNavigationDivider);

    controller.questionLocatorTitle = label("显示定位题目", UIFont.boldSystemFontOfSize(16), UIColor.darkGrayColor());
    controller.questionNavigationSettingsSection.addSubview(controller.questionLocatorTitle);

    controller.questionLocatorDescription = label("按当前卡片在所属题型中的序号打开对应题目", UIFont.systemFontOfSize(12), UIColor.grayColor());
    controller.questionNavigationSettingsSection.addSubview(controller.questionLocatorDescription);

    controller.questionLocatorSwitch = new UISwitch({ x: DEFAULT_WIDTH - 108, y: 69, width: 51, height: 31 });
    controller.questionLocatorSwitch.addTargetActionForControlEvents(controller, "toggleQuestionLocator:", 1 << 12);
    controller.questionNavigationSettingsSection.addSubview(controller.questionLocatorSwitch);

    controller.websiteLocateDivider = new UIView({ x: 20, y: 118, width: DEFAULT_WIDTH - 80, height: 1 });
    controller.websiteLocateDivider.backgroundColor = UIColor.lightGrayColor().colorWithAlphaComponent(0.4);
    controller.questionNavigationSettingsSection.addSubview(controller.websiteLocateDivider);

    controller.websiteLocateTitle = label("显示定位卡片", UIFont.boldSystemFontOfSize(16), UIColor.darkGrayColor());
    controller.questionNavigationSettingsSection.addSubview(controller.websiteLocateTitle);

    controller.websiteLocateDescription = label("在大观园题目页和错题复测页显示定位卡片", UIFont.systemFontOfSize(12), UIColor.grayColor());
    controller.questionNavigationSettingsSection.addSubview(controller.websiteLocateDescription);

    controller.websiteLocateSwitch = new UISwitch({ x: DEFAULT_WIDTH - 108, y: 139, width: 51, height: 31 });
    controller.websiteLocateSwitch.addTargetActionForControlEvents(controller, "toggleWebsiteLocateCards:", 1 << 12);
    controller.questionNavigationSettingsSection.addSubview(controller.websiteLocateSwitch);

    controller.categoryImportDivider = new UIView({ x: 20, y: 188, width: DEFAULT_WIDTH - 80, height: 1 });
    controller.categoryImportDivider.backgroundColor = UIColor.lightGrayColor().colorWithAlphaComponent(0.4);
    controller.questionNavigationSettingsSection.addSubview(controller.categoryImportDivider);

    controller.categoryImportTitle = label("显示导入分类题目", UIFont.boldSystemFontOfSize(16), UIColor.darkGrayColor());
    controller.questionNavigationSettingsSection.addSubview(controller.categoryImportTitle);

    controller.categoryImportDescription = label("在数学分类页显示一键导入按钮", UIFont.systemFontOfSize(12), UIColor.grayColor());
    controller.questionNavigationSettingsSection.addSubview(controller.categoryImportDescription);

    controller.categoryImportSwitch = new UISwitch({ x: DEFAULT_WIDTH - 108, y: 209, width: 51, height: 31 });
    controller.categoryImportSwitch.addTargetActionForControlEvents(controller, "toggleCategoryImportDisplay:", 1 << 12);
    controller.questionNavigationSettingsSection.addSubview(controller.categoryImportSwitch);

    controller.questionToolsSettingsSection = new UIView({ x: 20, y: 992, width: DEFAULT_WIDTH - 40, height: 124 });
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

    controller.noteAddTitle = label("显示添加笔记", UIFont.boldSystemFontOfSize(16), UIColor.darkGrayColor());
    controller.questionToolsSettingsSection.addSubview(controller.noteAddTitle);

    controller.noteAddDescription = label("在每题定位卡片右侧显示剪贴板图片添加按钮", UIFont.systemFontOfSize(12), UIColor.grayColor());
    controller.questionToolsSettingsSection.addSubview(controller.noteAddDescription);

    controller.noteAddSwitch = new UISwitch({ x: DEFAULT_WIDTH - 108, y: 69, width: 51, height: 31 });
    controller.noteAddSwitch.addTargetActionForControlEvents(controller, "toggleNoteAddDisplay:", 1 << 12);
    controller.questionToolsSettingsSection.addSubview(controller.noteAddSwitch);

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
    refreshCategoryJumpSetting(controller);
    refreshBindCategorySetting(controller);
    refreshCategoryImportSetting(controller);
    refreshQuestionLocatorSetting(controller);
    refreshNoteAddSetting(controller);
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
          : rows[questionNumber - 1];
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
          var scroller = document.querySelector('[class*="practiceScroll"]');
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
        completion(null, __DAGUANYUAN_MATH_API_GLOBAL__.questionScope(current.scope));
      } catch (failure) { completion(failure); }
    });
  }

  function openDaguanyuanQuestion(controller, route) {
    if (!controller) throw new Error("大观园面板当前不可用");
    if (!route || !route.url || (route.imported ? !route.questionId : !route.questionNumber)) {
      throw new Error("题目定位信息无效");
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
    controller.webView.evaluateJavaScript("window.__DAGUANYUAN_BIND_CATEGORY_BUTTON__&&window.__DAGUANYUAN_BIND_CATEGORY_BUTTON__.finishImport()", function () {});
  }

  function handleCategoryImport(controller) {
    if (controller.categoryImportBusy) return;
    if (!categoryImportVisible() || controller.currentContentPage !== "math") {
      showMessage(controller, "请在数学分类页开启导入分类题目");
      return;
    }
    controller.categoryImportBusy = true;
    controller.webView.evaluateJavaScript(__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__.importContextScript(), function (contextJSON, error) {
      let importContext;
      try {
        if (error) throw error;
        importContext = JSON.parse(String(contextJSON || ""));
      } catch (failure) {
        showMessage(controller, "无法读取当前数学页面，请刷新后重试");
        finishCategoryImport(controller);
        return;
      }
      const categoryId = __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.categoryIdFromURL(importContext.url);
      if (!categoryId) {
        showMessage(controller, "请先进入具体的数学题型分类");
        finishCategoryImport(controller);
        return;
      }
      let scope;
      try {
        scope = __DAGUANYUAN_MATH_API_GLOBAL__.questionScope(importContext.scope);
      } catch (failure) {
        showMessage(controller, String(failure && failure.message || failure));
        finishCategoryImport(controller);
        return;
      }
      const scopeName = { complete: "完整", core: "严选", exam: "真题" }[scope];
      showMessage(controller, `正在按“${scopeName}”范围导入当前分类直接归属的题目…`);
      Promise.resolve().then(function () {
        return __DAGUANYUAN_MATH_IMPORT_GLOBAL__.importCategory(controller.addon, categoryId, scope, function (progress) {
          if (progress.phase === "importing") {
            showMessage(controller, `已处理 ${progress.processed}/${progress.total} 道：新建 ${progress.created}，跳过 ${progress.skipped}，失败 ${progress.failed}`);
          }
        });
      }).then(function (result) {
        injectRetestButtons(controller);
        if (result.failed.length) console.log(`[Daguanyuan Bridge] 分类导入失败详情：${JSON.stringify(result.failed)}`);
        showMessage(controller, result.total
          ? `导入完成：新建 ${result.createdCount} 道，跳过 ${result.skippedCount} 道，失败 ${result.failed.length} 道`
          : "当前分类没有直接归属的题目");
      }).catch(function (failure) {
        showMessage(controller, String(failure && failure.message || failure));
      }).then(function () { finishCategoryImport(controller); });
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

  function injectWebsiteButtons(controller) {
    injectWebsiteLocateButtons(controller);
    injectBindCategoryButton(controller);
  }

  function injectBindCategoryButton(controller) {
    if (!controller || !controller.webView) return;
    controller.webView.evaluateJavaScript(__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__.bindCategoryScript(bindCategoryVisible(), categoryImportVisible()), function (result, error) {
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

    bindCurrentCategory: function (sender) {
      bindCurrentCategory(self);
    },

    openCategoryManager: function (sender) {
      setActivePage(self, "category-manager");
    },

    closeCategoryManager: function (sender) {
      setActivePage(self, "settings");
    },

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
      if (addon.focusNavigationEnabled) __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.syncQuestionLocator(addon);
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
      const requested = sender && typeof sender.on !== "undefined" ? Boolean(sender.on) : !noteAddVisible();
      NSUserDefaults.standardUserDefaults().setObjectForKey(requested, NOTE_ADD_KEY);
      refreshNoteAddSetting(self);
      injectWebsiteLocateButtons(self);
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

    webViewShouldStartLoadWithRequestNavigationType: function (webView, request) {
      const address = requestAddress(request);
      if (webView === self.webView && __DAGUANYUAN_VIDEO_BROWSER_GLOBAL__.handles(address)) {
        __DAGUANYUAN_VIDEO_BROWSER_GLOBAL__.open(address, function (message) { showMessage(self, message); });
        return false;
      }
      if (webView === self.webView && /^daguanyuanbridge:\/\/import-category(?:[/?#]|$)/i.test(address)) {
        handleCategoryImport(self);
        return false;
      }
      if (webView === self.webView && /^daguanyuanbridge:\/\/locate-card\?/i.test(address)) {
        try {
          const match = address.match(/[?&]id=(\d+)/);
          if (!match) throw new Error("题目 ID 无效");
          __DAGUANYUAN_MATH_IMPORT_GLOBAL__.focusQuestion(self.addon, Number(match[1]));
          showMessage(self, "已定位脑图卡片");
        } catch (error) {
          showMessage(self, String(error && error.message || error));
        }
        return false;
      }
      if (webView === self.webView && /^daguanyuanbridge:\/\/add-note-result\?/i.test(address)) {
        const token = (address.match(/[?&]token=([0-9-]+)/) || ["", ""])[1];
        const status = (address.match(/[?&]status=([a-z]+)/i) || ["", ""])[1];
        const message = __DAGUANYUAN_NOTE_PASTE_GLOBAL__.result(self, token, status);
        if (message) showMessage(self, message);
        return false;
      }
      if (webView === self.webView && /^daguanyuanbridge:\/\/add-note\?/i.test(address)) {
        const match = address.match(/[?&]id=(\d+)/);
        if (!noteAddVisible() || !match) { showMessage(self, "请先开启显示添加笔记"); return false; }
        __DAGUANYUAN_NOTE_PASTE_GLOBAL__.start(self, Number(match[1])).then(function (token) {
          if (self.notePasteOperation && self.notePasteOperation.token === token) showMessage(self, "正在添加图片，等待网站保存");
        }).catch(function (error) {
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
      if (webView === self.webView) {
        injectVideoPopupCompatibility(self);
        injectWebsiteButtons(self);
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
    refreshCategoryJumpSetting(controller);
    refreshQuestionLocatorSetting(controller);
    refreshWebsiteLocateSetting(controller);
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
    openDaguanyuanCategory,
    open408Page,
    openDaguanyuanQuestion,
    currentQuestionScope,
    open408Question,
    questionLocatorScript,
    prepareCategoryBinding,
    shouldRestorePanel,
    refreshFocusSetting,
    refreshCrossLevelSetting,
    refreshProgressSetting,
    refreshCategorySetting,
    refreshCategoryJumpSetting,
    refreshQuestionLocatorSetting,
    refreshPreviousSetting,
    refreshRetestButtons: injectWebsiteButtons,
  };
})();
