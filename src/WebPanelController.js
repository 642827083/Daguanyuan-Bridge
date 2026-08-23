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
    controller.containerView.frame = bounds;
    controller.titleBar.frame = { x: 0, y: 0, width: bounds.width, height: TITLE_HEIGHT };
    controller.closeButton.frame = { x: 4, y: 2, width: 34, height: 34 };
    controller.homeButton.frame = { x: 44, y: 4, width: 76, height: 30 };
    controller.os408Button.frame = { x: 124, y: 4, width: 76, height: 30 };
    controller.openQuestionButton.frame = { x: 204, y: 4, width: 120, height: 30 };
    controller.aiButton.frame = { x: 328, y: 4, width: 56, height: 30 };
    controller.importButton.frame = { x: bounds.width - 128, y: 4, width: 120, height: 30 };
    controller.titleLabel.frame = { x: 390, y: 0, width: Math.max(0, bounds.width - 526), height: TITLE_HEIGHT };
    controller.webView.frame = { x: 0, y: TITLE_HEIGHT, width: bounds.width, height: Math.max(0, bounds.height - TITLE_HEIGHT) };
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
    controller.titleBar.addSubview(controller.closeButton);

    controller.homeButton = button("大观园", controller, "openDaguanyuan:");
    controller.titleBar.addSubview(controller.homeButton);

    controller.os408Button = button("408 真题", controller, "open408:");
    controller.titleBar.addSubview(controller.os408Button);

    controller.openQuestionButton = button("打开选中题目", controller, "openSelectedQuestion:");
    controller.titleBar.addSubview(controller.openQuestionButton);

    controller.aiButton = button("问AI", controller, "openSelectedQuestionAI:");
    controller.titleBar.addSubview(controller.aiButton);

    controller.importButton = button("导入当前分类", controller, "importCurrentPractice:");
    controller.titleBar.addSubview(controller.importButton);

    controller.titleLabel = new UILabel({ x: 0, y: 0, width: 300, height: TITLE_HEIGHT });
    controller.titleLabel.text = "Daguanyuan Bridge";
    controller.titleLabel.textAlignment = 1;
    controller.titleLabel.font = UIFont.boldSystemFontOfSize(14);
    controller.titleLabel.textColor = UIColor.darkGrayColor();
    controller.titleBar.addSubview(controller.titleLabel);

    const pan = new UIPanGestureRecognizer(controller, "movePanel:");
    controller.titleBar.addGestureRecognizer(pan);

    controller.webView = new UIWebView({ x: 0, y: TITLE_HEIGHT, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT - TITLE_HEIGHT });
    controller.webView.backgroundColor = UIColor.whiteColor();
    controller.webView.scalesPageToFit = true;
    controller.webView.delegate = controller;
    controller.containerView.addSubview(controller.webView);

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
    layout(controller);
  }

  function loadURL(controller, urlString) {
    const url = NSURL.URLWithString(urlString);
    if (!url) throw new Error("题库地址无效");
    controller.webView.loadRequest(NSURLRequest.requestWithURL(url));
  }

  function nativeURLMember(object, key) {
    if (!object) return "";
    let value = object[key];
    if (typeof value === "function") value = value.call(object);
    return String(value || "");
  }

  function injectRetestEnhancement(controller) {
    const script = __DAGUANYUAN_RETEST_GLOBAL__.enhancementScript();
    controller.webView.evaluateJavaScript(script, function (result, error) {
      if (error) console.log(`[Daguanyuan Bridge] 注入错题定位按钮失败：${error.localizedDescription || error}`);
    });
  }

  function resolveRetestQuestion(controller, requestURL) {
    const absolute = nativeURLMember(requestURL, "absoluteString");
    const questionId = __DAGUANYUAN_RETEST_GLOBAL__.questionIdFromBridgeURL(absolute);
    if (!questionId) throw new Error("错题复测定位指令无效");
    return __DAGUANYUAN_WEB_BRIDGE_COMMANDS_GLOBAL__.commands.resolveRetestQuestion(
      { addon: controller.addon },
      { questionId },
    );
  }

  function scheduleRetestQuestionFocus(controller, note, noteId) {
    NSTimer.scheduledTimerWithTimeInterval(0.2, false, function () {
      try {
        __DAGUANYUAN_RETEST_GLOBAL__.focusQuestionCard(controller.addon, note, noteId);
      } catch (error) {
        showMessage(controller, error && error.message ? error.message : error);
      }
    });
  }

  function handleImportResult(controller, rawResult, error) {
    if (error) {
      showMessage(controller, `读取题目失败：${error.localizedDescription || error}`);
      return;
    }
    try {
      const payload = typeof rawResult === "string" ? JSON.parse(rawResult) : rawResult;
      const normalized = __DAGUANYUAN_PRACTICE_IMPORT_GLOBAL__.validatePayload(payload);
      const result = __DAGUANYUAN_PRACTICE_IMPORT_GLOBAL__.importCurrentPractice(controller.addon, normalized);
      const updated = result.updatedCount ? `，更新 ${result.updatedCount} 题` : "";
      const unavailable = normalized.unavailableQuestionCount ? `，未读取正文 ${normalized.unavailableQuestionCount} 题` : "";
      showMessage(controller, `已导入 ${result.createdCount} 题${updated}，跳过 ${result.skippedCount} 题${unavailable}`);
    } catch (importError) {
      showMessage(controller, importError && importError.message ? importError.message : importError);
    }
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
      loadURL(self, DAGUANYUAN_HOME_URL);
    },

    open408: function () {
      loadURL(self, OS408_HOME_URL);
    },

    openSelectedQuestion: function (sender) {
      try {
        const url = __DAGUANYUAN_SELECTION_GLOBAL__.firstSelectedQuestionURL(self.addonWindow || self.addon.window);
        loadURL(self, url);
      } catch (error) {
        showMessage(self, error && error.message ? error.message : error);
      }
    },

    openSelectedQuestionAI: function (sender) {
      try {
        const url = __DAGUANYUAN_SELECTION_GLOBAL__.firstSelectedQuestionAIURL(self.addonWindow || self.addon.window);
        loadURL(self, url);
      } catch (error) {
        showMessage(self, error && error.message ? error.message : error);
      }
    },

    importCurrentPractice: function () {
      const script = __DAGUANYUAN_PAGE_COLLECTOR_GLOBAL__.collectionScript();
      self.webView.evaluateJavaScript(script, function (result, error) {
        handleImportResult(self, result, error);
      });
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

    webViewDidStartLoad: function () {
      self.titleLabel.text = "正在加载题库…";
    },

    webViewDidFinishLoad: function () {
      self.titleLabel.text = "Daguanyuan Bridge";
      injectRetestEnhancement(self);
    },

    webViewDidFailLoadWithError: function (webView, error) {
      self.titleLabel.text = "页面加载失败";
      console.log(`[Daguanyuan Bridge] 页面加载失败：${error && error.localizedDescription || error}`);
    },

    webViewShouldStartLoadWithRequestNavigationType: function (webView, request, navigationType) {
      const requestURL = request && (typeof request.URL === "function" ? request.URL() : request.URL);
      const scheme = nativeURLMember(requestURL, "scheme").toLowerCase();
      if (scheme !== __DAGUANYUAN_RETEST_GLOBAL__.bridgeScheme) return true;
      try {
        const result = resolveRetestQuestion(self, requestURL);
        performClosePanel(self);
        scheduleRetestQuestionFocus(self, result.note, result.noteId);
      } catch (error) {
        showMessage(self, error && error.message ? error.message : error);
      }
      return false;
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
  }

  function hidePanel(controller) {
    performClosePanel(controller);
  }

  function shouldRestorePanel() {
    return NSUserDefaults.standardUserDefaults().objectForKey(PANEL_KEY) === true;
  }

  return { createController, isPanelVisible, showPanel, hidePanel, shouldRestorePanel };
})();
