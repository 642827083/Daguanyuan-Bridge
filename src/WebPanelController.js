var __DAGUANYUAN_WEB_PANEL_GLOBAL__ = (function () {
  const DAGUANYUAN_HOME_URL = "https://cxyonly.fans/math";
  const OS408_HOME_URL = "https://www.408os.cn/overview";
  const FRAME_KEY = "cn.marginnote.daguanyuan-bridge.panel-frame";
  const PANEL_KEY = "cn.marginnote.daguanyuan-bridge.panel-visible";
  const TITLE_HEIGHT = 38;
  const STATUS_HEIGHT = 52;
  const HEADER_HEIGHT = TITLE_HEIGHT + STATUS_HEIGHT;
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

  function setStatus(controller, message) {
    if (controller && controller.statusLabel) controller.statusLabel.text = String(message || "");
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
    controller.pageStatusRefreshToken = Number(controller.pageStatusRefreshToken || 0) + 1;
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
    controller.titleLabel.frame = { x: 372, y: 0, width: Math.max(0, bounds.width - 508), height: TITLE_HEIGHT };
    controller.statusBar.frame = { x: 0, y: TITLE_HEIGHT, width: bounds.width, height: STATUS_HEIGHT };
    controller.statusLabel.frame = { x: 10, y: 2, width: Math.max(120, bounds.width - 300), height: STATUS_HEIGHT - 4 };
    controller.webView.frame = { x: 0, y: HEADER_HEIGHT, width: bounds.width, height: Math.max(0, bounds.height - HEADER_HEIGHT) };
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

    controller.statusBar = new UIView({ x: 0, y: TITLE_HEIGHT, width: DEFAULT_WIDTH, height: STATUS_HEIGHT });
    controller.statusBar.backgroundColor = UIColor.colorWithWhiteAlpha(0.985, 1);
    controller.containerView.addSubview(controller.statusBar);

    controller.statusLabel = new UILabel({ x: 10, y: 2, width: DEFAULT_WIDTH - 300, height: STATUS_HEIGHT - 4 });
    controller.statusLabel.text = "正在读取当前页面…";
    controller.statusLabel.numberOfLines = 2;
    controller.statusLabel.font = UIFont.systemFontOfSize(12);
    controller.statusLabel.textColor = UIColor.darkGrayColor();
    controller.statusBar.addSubview(controller.statusLabel);

    const pan = new UIPanGestureRecognizer(controller, "movePanel:");
    controller.titleBar.addGestureRecognizer(pan);

    controller.webView = new UIWebView({ x: 0, y: HEADER_HEIGHT, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT - HEADER_HEIGHT });
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

  function loadURL(controller, urlString, questionId, provider) {
    const url = NSURL.URLWithString(urlString);
    if (!url) throw new Error("题库地址无效");
    controller.pendingQuestionId = String(questionId || "");
    controller.pendingQuestionProvider = String(provider || "daguanyuan");
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

  function errorMessage(error) {
    if (!error) return "未知错误";
    let value = error.localizedDescription;
    if (typeof value === "function") value = value.call(error);
    return String(value || error.message || error);
  }

  function parsedJSON(value) {
    return typeof value === "string" ? JSON.parse(value) : value;
  }

  function setCollectionBusy(controller, busy, message) {
    controller.collectionBusy = Boolean(busy);
    const importable = Boolean(controller.currentPageStatus && controller.currentPageStatus.importable);
    controller.importButton.enabled = !busy && importable;
    if (message) setStatus(controller, message);
    if (busy) Application.sharedInstance().waitHUDOnView("正在准备题目…", controller.view);
    else {
      Application.sharedInstance().stopWaitHUDOnView(controller.view);
      controller.webView.evaluateJavaScript(__DAGUANYUAN_PAGE_COLLECTOR_GLOBAL__.restoreCategoryMenuScript(), function () {});
    }
  }

  function shouldRetryPayload(payload) {
    const state = payload && payload.renderState || {};
    return Number(payload && payload.unavailableQuestionCount || 0) > 0 ||
      Number(state.pendingImageCount || 0) > 0 ||
      Number(state.pendingFormulaCount || 0) > 0;
  }

  function importSummary(payload, result) {
    const state = payload.renderState || {};
    const path = (result.categoryPath || payload.categoryPath || []).join(" > ");
    const pageCount = `${state.completeQuestionCount || payload.questions.length}/${state.expectedQuestionCount || payload.questions.length}`;
    const unread = payload.unavailableQuestionCount ? `，未读取 ${payload.unavailableQuestionCount}` : "";
    const broken = state.brokenImageCount ? `，网页坏图 ${state.brokenImageCount}` : "";
    return `${path || "当前分类"}｜网页题目 ${pageCount}\n新建 ${result.createdCount}，更新 ${result.updatedCount}，跳过 ${result.skippedCount}${unread}${broken}`;
  }

  function finishImport(controller, payload) {
    try {
      const result = __DAGUANYUAN_PRACTICE_IMPORT_GLOBAL__.importCurrentPractice(controller.addon, payload);
      const summary = importSummary(payload, result);
      controller.lastImportResult = { payload, result };
      setStatus(controller, summary);
      showMessage(controller, `导入完成：新建 ${result.createdCount}，更新 ${result.updatedCount}，跳过 ${result.skippedCount}`);
    } catch (error) {
      setStatus(controller, `导入失败：${errorMessage(error)}`);
      showMessage(controller, errorMessage(error));
    }
    setCollectionBusy(controller, false);
  }

  function finishCollectedPayload(controller, rawResult) {
    try {
      const normalized = __DAGUANYUAN_PRACTICE_IMPORT_GLOBAL__.validatePayload(parsedJSON(rawResult));
      finishImport(controller, normalized);
    } catch (error) {
      setStatus(controller, `读取题目失败：${errorMessage(error)}`);
      showMessage(controller, errorMessage(error));
      setCollectionBusy(controller, false);
    }
  }

  function collectPreparedPage(controller, retryCount) {
    controller.webView.evaluateJavaScript(__DAGUANYUAN_PAGE_COLLECTOR_GLOBAL__.collectionScript(), function (rawResult, error) {
      if (error) {
        setStatus(controller, `读取题目失败：${errorMessage(error)}`);
        showMessage(controller, errorMessage(error));
        setCollectionBusy(controller, false);
        return;
      }
      try {
        const previewPayload = parsedJSON(rawResult);
        if (retryCount < 1 && shouldRetryPayload(previewPayload)) {
          setStatus(controller, "部分题目、公式或图片仍在渲染，正在自动重试…");
          NSTimer.scheduledTimerWithTimeInterval(0.9, false, function () {
            collectPreparedPage(controller, retryCount + 1);
          });
          return;
        }
      } catch (parseError) {
        setStatus(controller, `读取题目失败：${errorMessage(parseError)}`);
        showMessage(controller, errorMessage(parseError));
        setCollectionBusy(controller, false);
        return;
      }
      finishCollectedPayload(controller, rawResult);
    });
  }

  function pollPreload(controller, pollCount) {
    controller.webView.evaluateJavaScript(__DAGUANYUAN_PAGE_COLLECTOR_GLOBAL__.preloadStatusScript(), function (rawState, error) {
      if (error) {
        setStatus(controller, `预加载失败：${errorMessage(error)}`);
        setCollectionBusy(controller, false);
        return;
      }
      let state = {};
      try { state = parsedJSON(rawState) || {}; } catch (parseError) { state = {}; }
      if (state.running && pollCount < 24) {
        setStatus(controller, `正在加载完整题目… 已触发 ${state.loadMoreClickCount || 0} 次“加载更多”`);
        NSTimer.scheduledTimerWithTimeInterval(0.45, false, function () {
          pollPreload(controller, pollCount + 1);
        });
        return;
      }
      collectPreparedPage(controller, 0);
    });
  }

  function prepareCategoryMenu(controller, completion) {
    const attempt = Number(arguments[2] || 0);
    controller.webView.evaluateJavaScript(__DAGUANYUAN_PAGE_COLLECTOR_GLOBAL__.prepareCategoryMenuScript(), function (result, error) {
      if (error) {
        completion(error);
        return;
      }
      let state = {};
      try { state = parsedJSON(result) || {}; } catch (parseError) {
        completion(parseError);
        return;
      }
      if (state.ready || attempt >= 4) {
        completion(state.ready ? null : new Error("未读取到当前分类路径"));
        return;
      }
      // 大观园使用 React 异步绘制分类列，轮询等待分类列生成后再读取路径。
      NSTimer.scheduledTimerWithTimeInterval(0.2, false, function () {
        prepareCategoryMenu(controller, completion, attempt + 1);
      });
    });
  }

  function beginCollection(controller) {
    if (controller.collectionBusy) {
      showMessage(controller, "题目正在处理中，请稍候");
      return;
    }
    controller.collectionBusy = true;
    controller.importButton.enabled = false;
    setStatus(controller, "正在识别当前分类…");
    readPageStatus(controller, function (error, status) {
      if (error) {
        controller.collectionBusy = false;
        controller.importButton.enabled = Boolean(controller.currentPageStatus && controller.currentPageStatus.importable);
        setStatus(controller, `无法读取当前页面状态：${errorMessage(error)}`);
        showMessage(controller, errorMessage(error));
        return;
      }
      if (!status.importable) {
        controller.collectionBusy = false;
        controller.importButton.enabled = false;
        showMessage(controller, "当前页面不是可导入的具体分类");
        return;
      }
      setCollectionBusy(controller, true, "正在识别分类并等待题目、公式、图片完成渲染…");
      prepareCategoryMenu(controller, function (menuError) {
        if (menuError) {
          setStatus(controller, `读取分类失败：${errorMessage(menuError)}`);
          showMessage(controller, errorMessage(menuError));
          setCollectionBusy(controller, false);
          return;
        }
        controller.webView.evaluateJavaScript(__DAGUANYUAN_PAGE_COLLECTOR_GLOBAL__.preloadScript(), function (result, preloadError) {
          if (preloadError) {
            setStatus(controller, `预加载失败：${errorMessage(preloadError)}`);
            showMessage(controller, errorMessage(preloadError));
            setCollectionBusy(controller, false);
            return;
          }
          pollPreload(controller, 0);
        });
      });
    });
  }

  function pageStatusText(status) {
    const providerName = status.provider === "daguanyuan" ? "大观园" : status.provider === "408os" ? "408 真题" : "当前页面";
    const category = status.categoryLabel ? `｜${status.categoryLabel}` : "";
    return status.importable ? `${providerName}${category}｜可以导入当前分类` : `${providerName}｜当前页面不是可导入的具体分类`;
  }

  function readPageStatus(controller, completion) {
    controller.webView.evaluateJavaScript(__DAGUANYUAN_PAGE_COLLECTOR_GLOBAL__.pageStatusScript(), function (rawResult, error) {
      if (error) {
        setStatus(controller, "无法读取当前页面状态");
        if (completion) completion(error);
        return;
      }
      try {
        const status = parsedJSON(rawResult) || {};
        controller.currentPageStatus = status;
        setStatus(controller, pageStatusText(status));
        controller.importButton.enabled = !controller.collectionBusy && Boolean(status.importable);
        if (completion) completion(null, status);
      } catch (parseError) {
        setStatus(controller, "无法识别当前页面状态");
        if (completion) completion(parseError);
      }
    });
  }

  function updatePageStatus(controller, completion) {
    readPageStatus(controller, completion);
  }

  function schedulePageStatusRefresh(controller) {
    controller.pageStatusRefreshToken = Number(controller.pageStatusRefreshToken || 0) + 1;
    const token = controller.pageStatusRefreshToken;
    function refresh() {
      if (!controller.panelVisible || controller.pageStatusRefreshToken !== token) return;
      updatePageStatus(controller);
      NSTimer.scheduledTimerWithTimeInterval(0.8, false, refresh);
    }
    NSTimer.scheduledTimerWithTimeInterval(0.8, false, refresh);
  }

  const panelClass = JSB.defineClass("DaguanyuanBridgePanelController : UIViewController <UIWebViewDelegate>", {
    viewDidLoad: function () {
      setup(self);
      self.importButton.enabled = false;
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

    importCurrentPractice: function (sender) {
      beginCollection(self);
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
      self.currentPageStatus = undefined;
      self.importButton.enabled = false;
      setStatus(self, "页面正在加载…");
    },

    webViewDidFinishLoad: function () {
      self.titleLabel.text = "Daguanyuan Bridge";
      injectRetestEnhancement(self);
      injectVideoPopupCompatibility(self);
      injectSelectedQuestionLocator(self);
      updatePageStatus(self);
    },

    webViewDidFailLoadWithError: function (webView, error) {
      self.titleLabel.text = "页面加载失败";
      setStatus(self, `页面加载失败：${errorMessage(error)}`);
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
    updatePageStatus(controller);
    schedulePageStatusRefresh(controller);
  }

  function hidePanel(controller) {
    performClosePanel(controller);
  }

  function shouldRestorePanel() {
    return NSUserDefaults.standardUserDefaults().objectForKey(PANEL_KEY) === true;
  }

  return { createController, isPanelVisible, showPanel, hidePanel, shouldRestorePanel };
})();
