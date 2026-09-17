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
    controller.titleLabel.frame = { x: 392, y: 0, width: Math.max(0, bounds.width - 490), height: TITLE_HEIGHT };
    controller.focusButton.frame = { x: Math.max(392, bounds.width - 90), y: 4, width: 82, height: 30 };
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

  function refreshFocusButton(controller) {
    if (!controller || !controller.focusButton) return;
    const enabled = !controller.addon || controller.addon.focusNavigationEnabled !== false;
    controller.focusButton.setTitleForState(enabled ? "焦点开" : "焦点关", 0);
    controller.focusButton.setTitleColorForState(
      enabled ? UIColor.colorWithRedGreenBlueAlpha(0.1, 0.36, 0.72, 1) : UIColor.darkGrayColor(),
      0
    );
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

    controller.focusButton = button("焦点开", controller, "toggleFocusNavigation:");
    controller.titleBar.addSubview(controller.focusButton);

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
    refreshFocusButton(controller);
    layout(controller);
  }

  function loadURL(controller, urlString, questionId, provider) {
    const url = NSURL.URLWithString(urlString);
    if (!url) throw new Error("题库地址无效");
    controller.pendingQuestionId = String(questionId || "");
    controller.pendingQuestionProvider = String(provider || "daguanyuan");
    controller.pendingCategoryPath = [];
    controller.pendingOrderedQuestion = undefined;
    controller.webView.loadRequest(NSURLRequest.requestWithURL(url));
  }

  function loadCategory(controller, category) {
    const practiceId = String(category && category.practiceId || "").trim();
    if (!/^\d+$/.test(practiceId)) throw new Error("未能识别选中卡片所属的大观园章节");
    const url = NSURL.URLWithString(`https://cxyonly.fans/math/practice/${practiceId}`);
    if (!url) throw new Error("大观园章节地址无效");
    controller.pendingQuestionId = "";
    controller.pendingQuestionProvider = "";
    controller.pendingCategoryPath = Array.isArray(category.categoryPath) ? category.categoryPath.slice() : [];
    controller.pendingOrderedQuestion = Number.isInteger(category.questionIndex) && category.questionIndex >= 0 && category.noteId
      ? {
        noteId: String(category.noteId),
        notebookId: String(category.notebookId || ""),
        questionIndex: category.questionIndex,
        questionNumber: category.questionIndex + 1,
        categoryPath: controller.pendingCategoryPath.slice(),
        attemptCount: 0,
      }
      : undefined;
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

  function injectSelectedQuestionLocator(controller) {
    const questionId = String(controller.pendingQuestionId || "");
    if (!questionId) return;
    const provider = String(controller.pendingQuestionProvider || "daguanyuan");
    controller.pendingQuestionId = "";
    controller.pendingQuestionProvider = "";
    const script = provider === "408os"
      ? __DAGUANYUAN_SELECTION_GLOBAL__.os408QuestionLocatorScript(questionId)
      : __DAGUANYUAN_SELECTION_GLOBAL__.questionLocatorScript(questionId);
    if (!script) return;
    controller.webView.evaluateJavaScript(script, function (result, error) {
      if (error) console.log(`[Daguanyuan Bridge] 自动定位题目失败：${error.localizedDescription || error}`);
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

  function scheduleRetestQuestionFocus(controller, note, noteId, notebookIds) {
    // 延迟执行，使隐藏面板和跨学习集切换先完成。
    NSTimer.scheduledTimerWithTimeInterval(0.2, false, function () {
      try {
        __DAGUANYUAN_RETEST_GLOBAL__.startQuestionNavigation(controller.addon, {
          note,
          noteId,
          notebookId: controller.pendingRetestNotebookId || "",
          notebookIds: Array.isArray(notebookIds) ? notebookIds : [],
        });
      } catch (error) {
        showMessage(controller, error && error.message ? error.message : error);
      }
    });
  }

  function injectCategoryNavigation(controller) {
    const path = Array.isArray(controller.pendingCategoryPath) ? controller.pendingCategoryPath.slice() : [];
    controller.pendingCategoryPath = [];
    if (path.length) {
      const script = __DAGUANYUAN_PAGE_COLLECTOR_GLOBAL__.categoryNavigationScript(path);
      controller.webView.evaluateJavaScript(script, function (result, error) {
        if (error) console.log(`[Daguanyuan Bridge] 自动打开题型分类失败：${error.localizedDescription || error}`);
      });
    }
    scheduleOrderedQuestionBinding(controller);
  }

  function finishOrderedQuestionBinding(controller, binding, result) {
    const savedCount = __DAGUANYUAN_STORAGE_GLOBAL__.saveQuestionMappings([{
      noteId: binding.noteId,
      provider: "daguanyuan",
      questionId: result.questionId,
      url: result.url,
      categoryPath: binding.categoryPath,
      notebookId: binding.notebookId,
      updatedAt: new Date().toISOString(),
    }]);
    controller.pendingOrderedQuestion = undefined;
    const message = savedCount
      ? `已按第 ${binding.questionNumber} 张卡片定位，并记住原题关联`
      : `已按第 ${binding.questionNumber} 张卡片定位，但未能保存原题关联`;
    showMessage(controller, message);
    loadURL(controller, result.url, result.questionId, "daguanyuan");
  }

  function scheduleOrderedQuestionBinding(controller) {
    const binding = controller.pendingOrderedQuestion;
    if (!binding) return;
    const maxAttempts = Math.max(40, binding.questionNumber + 16);
    controller.orderedQuestionBindingToken = Number(controller.orderedQuestionBindingToken || 0) + 1;
    const token = controller.orderedQuestionBindingToken;
    function poll() {
      if (!controller.pendingOrderedQuestion || controller.orderedQuestionBindingToken !== token) return;
      const script = __DAGUANYUAN_SELECTION_GLOBAL__.orderedQuestionLocatorScript(binding.questionIndex);
      controller.webView.evaluateJavaScript(script, function (rawResult, error) {
        if (!controller.pendingOrderedQuestion || controller.orderedQuestionBindingToken !== token) return;
        binding.attemptCount += 1;
        let result;
        try {
          result = error ? undefined : parsedJSON(rawResult);
        } catch (parseError) {
          result = undefined;
        }
        if (result && result.status === "found" && /^\d+$/.test(String(result.questionId || "")) && result.url) {
          try {
            finishOrderedQuestionBinding(controller, binding, result);
          } catch (saveError) {
            controller.pendingOrderedQuestion = undefined;
            showMessage(controller, `已定位题目，但保存原题关联失败：${errorMessage(saveError)}`);
          }
          return;
        }
        if (binding.attemptCount < maxAttempts && (!result || result.status === "waiting")) {
          NSTimer.scheduledTimerWithTimeInterval(0.25, false, poll);
          return;
        }
        controller.pendingOrderedQuestion = undefined;
        const questionCount = Number(result && result.questionCount || 0);
        const expectedQuestionCount = Number(result && result.expectedQuestionCount || 0);
        const detail = expectedQuestionCount
          ? (binding.questionNumber > expectedQuestionCount
            ? `网页当前共 ${expectedQuestionCount} 道题`
            : `网页显示共 ${expectedQuestionCount} 道题，但只读取到 ${questionCount} 道`)
          : (questionCount ? `只读取到 ${questionCount} 道网页题目` : "网页题目尚未加载");
        showMessage(controller, `${detail}，无法按第 ${binding.questionNumber} 张卡片定位，未保存关联`);
      });
    }
    NSTimer.scheduledTimerWithTimeInterval(0.25, false, poll);
  }

  function errorMessage(error) {
    if (!error) return "未知错误";
    let value = error.localizedDescription;
    if (typeof value === "function") value = value.call(error);
    return String(value || error.message || error);
  }

  function parsedJSON(value) {
    return typeof value === "string" ? JSON.parse(value) : value;
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
        const selected = __DAGUANYUAN_SELECTION_GLOBAL__.firstSelectedQuestion(self.addonWindow || self.addon.window);
        loadURL(self, selected.url, selected.questionId, selected.provider);
      } catch (error) {
        try {
          const category = __DAGUANYUAN_SELECTION_GLOBAL__.firstSelectedDaguanyuanCategory(self.addonWindow || self.addon.window);
          loadCategory(self, category);
        } catch (categoryError) {
          showMessage(self, categoryError && categoryError.message ? categoryError.message : error && error.message ? error.message : error);
        }
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

    toggleFocusNavigation: function (sender) {
      const addon = self.addon;
      if (!addon) {
        showMessage(self, "焦点导航当前不可用");
        return;
      }
      addon.focusNavigationEnabled = __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.setEnabled(!(addon.focusNavigationEnabled !== false));
      if (addon.focusNavigationEnabled) __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.show(addon);
      else __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.hide(addon);
      refreshFocusButton(self);
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
      injectVideoPopupCompatibility(self);
      injectSelectedQuestionLocator(self);
      injectCategoryNavigation(self);
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
        self.pendingRetestNotebookId = result.notebookId || "";
        self.pendingRetestNotebookIds = Array.isArray(result.notebookIds) ? result.notebookIds : [];
        performClosePanel(self);
        scheduleRetestQuestionFocus(self, result.note, result.noteId, self.pendingRetestNotebookIds);
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
    refreshFocusButton(controller);
  }

  function hidePanel(controller) {
    performClosePanel(controller);
  }

  function shouldRestorePanel() {
    return NSUserDefaults.standardUserDefaults().objectForKey(PANEL_KEY) === true;
  }

  return { createController, isPanelVisible, showPanel, hidePanel, shouldRestorePanel, refreshFocusButton };
})();
