var __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__ = (function () {
  const BUTTON_WIDTH = 76;
  const MAX_BUTTON_WIDTH = 260;
  const TITLE_HORIZONTAL_PADDING = 28;
  const BUTTON_HEIGHT = 36;
  const RIGHT_MARGIN = 10;
  const CATEGORY_POSITION_KEY = "cn.marginnote.daguanyuan-bridge.focus-next.category-button-position";
  const QUESTION_LOCATOR_POSITION_KEY = "cn.marginnote.daguanyuan-bridge.question-navigation.locator-button-position";

  function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }

  function readSavedPosition(key) {
    try {
      const stored = NSUserDefaults.standardUserDefaults().objectForKey(key);
      if (stored === undefined || stored === null) return undefined;
      const text = String(stored);
      if (text.charAt(0) === "{") {
        try { return JSON.parse(text); } catch (ignored) {}
      }
      const parts = text.split(",");
      if (parts.length === 2 && Number.isFinite(Number(parts[0])) && Number.isFinite(Number(parts[1]))) {
        return { xRatio: Number(parts[0]), yRatio: Number(parts[1]) };
      }
      return stored;
    } catch (error) {
      console.log(`[Daguanyuan Bridge Focus Next] 读取按钮位置失败：${error && error.message || error}`);
      return undefined;
    }
  }

  function viewFor(addon) {
    const application = Application.sharedInstance();
    const focusWindow = application && application.focusWindow;
    // 已知所属窗口时只等待该窗口，避免脑图切换期间把按钮移到另一窗口。
    const candidates = addon && addon.window ? [addon.window] : [focusWindow, undefined];
    for (const window of candidates) {
      try {
        const controller = window === undefined ? application.studyController() : application.studyController(window);
        if (controller && controller.view) return controller.view;
      } catch (ignored) {}
    }
    return undefined;
  }

  function isAttachedToView(button, view) {
    if (!button || !view) return false;
    try {
      // 原生对象的 JS 包装可能不同，优先用原生子视图集合判断归属。
      const children = typeof view.subviews === 'function' ? view.subviews() : view.subviews;
      if (children && typeof children.containsObject === 'function') return Boolean(children.containsObject(button));
    } catch (ignored) { /* 旧环境没有集合接口时保留原来的引用比较。 */ }
    return button.superview === view;
  }

  function buttonWidth(button) {
    const preferredWidth = finiteNumber(button && button.__daguanyuanContentWidth);
    if (preferredWidth !== undefined) return Math.max(BUTTON_WIDTH, Math.min(MAX_BUTTON_WIDTH, preferredWidth));
    return BUTTON_WIDTH;
  }

  function measuredTitleWidth(button, title) {
    const text = String(title || "");
    try {
      const label = button && button.titleLabel;
      if (label && typeof label.sizeThatFits === "function") {
        label.text = text;
        const size = label.sizeThatFits({ width: 1000, height: BUTTON_HEIGHT });
        const nativeWidth = finiteNumber(size && size.width);
        if (nativeWidth !== undefined && nativeWidth > 0) return nativeWidth;
      }
    } catch (ignored) {}
    let estimatedWidth = 0;
    for (let index = 0; index < text.length; index += 1) {
      estimatedWidth += text.charCodeAt(index) <= 127 ? 8 : 14;
    }
    return estimatedWidth;
  }

  function setAdaptiveTitle(button, title) {
    if (!button) return false;
    const width = Math.max(
      BUTTON_WIDTH,
      Math.min(MAX_BUTTON_WIDTH, Math.ceil(measuredTitleWidth(button, title) + TITLE_HORIZONTAL_PADDING))
    );
    const changed = finiteNumber(button.__daguanyuanContentWidth) !== width;
    button.__daguanyuanContentWidth = width;
    button.setTitleForState(String(title || ""), 0);
    return changed;
  }

  function placeButton(addon, button, positionKey, defaultX, defaultY) {
    const view = viewFor(addon);
    if (!button || !view || !view.bounds) return false;
    const saved = readSavedPosition(positionKey);
    const width = buttonWidth(button);
    const availableWidth = Math.max(0, view.bounds.width - width);
    const availableHeight = Math.max(0, view.bounds.height - BUTTON_HEIGHT);
    const savedXRatio = finiteNumber(saved && saved.xRatio);
    const savedYRatio = finiteNumber(saved && saved.yRatio);
    const legacyX = finiteNumber(saved && saved.x);
    const legacyY = finiteNumber(saved && saved.y);
    const savedViewWidth = finiteNumber(saved && saved.viewWidth);
    const savedViewHeight = finiteNumber(saved && saved.viewHeight);
    const legacyWidth = Math.max(1, (savedViewWidth || view.bounds.width) - width);
    const legacyHeight = Math.max(1, (savedViewHeight || view.bounds.height) - BUTTON_HEIGHT);
    const fallbackY = defaultY === undefined ? availableHeight / 2 : defaultY;
    const x = savedXRatio !== undefined ? savedXRatio * availableWidth : legacyX !== undefined ? (legacyX / legacyWidth) * availableWidth : defaultX;
    const y = savedYRatio !== undefined ? savedYRatio * availableHeight : legacyY !== undefined ? (legacyY / legacyHeight) * availableHeight : fallbackY;
    button.frame = {
      x: Math.max(0, Math.min(availableWidth, x)),
      y: Math.max(0, Math.min(availableHeight, y)),
      width,
      height: BUTTON_HEIGHT,
    };
    return true;
  }

  function place(addon) {
    const category = addon && addon.__daguanyuanFocusCategoryButton;
    const questionLocator = addon && addon.__daguanyuanQuestionLocatorButton;
    const view = viewFor(addon);
    if (!view || !view.bounds) return false;
    const categoryPlaced = placeButton(
      addon,
      category,
      CATEGORY_POSITION_KEY,
      Math.max(0, view.bounds.width - buttonWidth(category) - RIGHT_MARGIN),
      Math.max(0, (view.bounds.height - BUTTON_HEIGHT) / 2 - BUTTON_HEIGHT - 10)
    );
    const questionLocatorPlaced = placeButton(
      addon,
      questionLocator,
      QUESTION_LOCATOR_POSITION_KEY,
      Math.max(0, view.bounds.width - buttonWidth(questionLocator) - RIGHT_MARGIN),
      Math.max(0, (view.bounds.height - BUTTON_HEIGHT) / 2 - (BUTTON_HEIGHT + 10) * 2)
    );
    return categoryPlaced || questionLocatorPlaced;
  }

  function savePosition(addon, button, positionKey) {
    if (!button || !button.frame) return;
    const view = viewFor(addon);
    if (!view || !view.bounds) return;
    const width = buttonWidth(button);
    const availableWidth = Math.max(1, view.bounds.width - width);
    const availableHeight = Math.max(1, view.bounds.height - BUTTON_HEIGHT);
    const position = {
      xRatio: Math.max(0, Math.min(1, (Number(button.frame.x) || 0) / availableWidth)),
      yRatio: Math.max(0, Math.min(1, (Number(button.frame.y) || 0) / availableHeight)),
      viewWidth: Number(view.bounds.width) || 0,
      viewHeight: Number(view.bounds.height) || 0,
    };
    try { NSUserDefaults.standardUserDefaults().setObjectForKey(JSON.stringify(position), positionKey); } catch (error) {
      console.log(`[Daguanyuan Bridge Focus Next] 保存按钮位置失败：${error && error.message || error}`);
    }
  }

  function schedulePlace(addon) {
    if (!addon || typeof NSTimer === "undefined" || !NSTimer.scheduledTimerWithTimeInterval) return;
    const token = Number(addon.__daguanyuanFocusNextPlaceToken || 0) + 1;
    addon.__daguanyuanFocusNextPlaceToken = token;
    const delays = [0.08, 0.25, 0.6];
    function run(index) {
      if (!addon || addon.__daguanyuanFocusNextPlaceToken !== token || addon.__daguanyuanFocusNextDragging) return;
      place(addon);
      if (index < delays.length) NSTimer.scheduledTimerWithTimeInterval(delays[index], false, function () { run(index + 1); });
    }
    NSTimer.scheduledTimerWithTimeInterval(delays[0], false, function () { run(1); });
  }

  function handlePan(addon, recognizer, button, positionKey) {
    const view = viewFor(addon);
    if (!button || !view || !view.bounds) return;
    const state = Number(recognizer.state);
    if (state === 1) {
      addon.__daguanyuanFocusNextDragging = true;
      addon.__daguanyuanFocusNextPlaceToken = Number(addon.__daguanyuanFocusNextPlaceToken || 0) + 1;
      return;
    }
    if (state === 2) {
      const translation = recognizer.translationInView(view);
      const frame = button.frame;
      const width = buttonWidth(button);
      button.frame = {
        x: Math.max(0, Math.min(view.bounds.width - width, frame.x + Number(translation.x || 0))),
        y: Math.max(0, Math.min(view.bounds.height - BUTTON_HEIGHT, frame.y + Number(translation.y || 0))),
        width,
        height: BUTTON_HEIGHT,
      };
      recognizer.setTranslationInView({ x: 0, y: 0 }, view);
      return;
    }
    if (state === 3 || state === 4) {
      if (addon.__daguanyuanFocusNextDragging) {
        savePosition(addon, button, positionKey);
        if (button === addon.__daguanyuanFocusCategoryButton) addon.__daguanyuanFocusCategorySuppressTap = true;
        else if (button === addon.__daguanyuanQuestionLocatorButton) addon.__daguanyuanQuestionLocatorSuppressTap = true;
      }
      addon.__daguanyuanFocusNextDragging = false;
    }
  }

  function refreshCategory(addon, note) {
    const button = addon && addon.__daguanyuanFocusCategoryButton;
    if (!button) return "";
    const focusNote = note || (addon && addon.__daguanyuanFocusNextLastFocus);
    const title = __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.parentTitle(focusNote);
    const widthChanged = setAdaptiveTitle(button, title);
    button.__daguanyuanDisplayedCategoryTitle = title;
    if (widthChanged || Number(button.frame && button.frame.width) !== buttonWidth(button)) place(addon);
    return title;
  }

  function diagnosticValue(object, key) {
    try {
      const value = object && object[key];
      return typeof value === 'function' ? value.call(object) : value;
    } catch (ignored) { return undefined; }
  }

  function diagnose(addon, stage) {
    // 只记录计数和相等关系，不记录学习集 ID、卡片 ID、标题或正文，也不重启刷新。
    if (!addon || typeof __DAGUANYUAN_DIAGNOSTICS_GLOBAL__ === 'undefined') return;
    try {
      const app = Application.sharedInstance(), study = app.studyController(addon.window);
      const notebook = diagnosticValue(study, 'notebookController');
      const bookId = String(diagnosticValue(notebook, 'notebookId') || '');
      if (bookId && addon.__daguanyuanFocusNextTraceNotebookId !== bookId) {
        addon.__daguanyuanFocusNextTraceNotebookId = bookId;
        addon.__daguanyuanFocusNextTraceNotebookSequence = Number(addon.__daguanyuanFocusNextTraceNotebookSequence || 0) + 1;
      }
      const focus = diagnosticValue(notebook, 'focusNote'), visible = diagnosticValue(notebook, 'visibleFocusNote');
      const memory = addon.__daguanyuanFocusNextLastFocus, view = diagnosticValue(study, 'view');
      const category = addon.__daguanyuanFocusCategoryButton, locator = addon.__daguanyuanQuestionLocatorButton;
      function relation(left, right) { return !left || !right ? 'unknown' : String(left) === String(right) ? 'match' : 'mismatch'; }
      function membership(note) { return relation(diagnosticValue(note, 'notebookId'), bookId); }
      function sameNote(note) { return relation(diagnosticValue(note, 'noteId'), diagnosticValue(memory, 'noteId')); }
      function buttonState(button) {
        if (!button) return 'missing';
        if (diagnosticValue(button, 'hidden')) return 'hidden';
        const parent = diagnosticValue(button, 'superview');
        return isAttachedToView(button, view) ? 'attached' : parent ? 'other_view' : 'detached';
      }
      function titleMatches(note) {
        return note && category ? relation(category.__daguanyuanDisplayedCategoryTitle, __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.parentTitle(note)) : 'unknown';
      }
      const state = {
        notebookSequence: Number(addon.__daguanyuanFocusNextTraceNotebookSequence || 0),
        notebookMatchesOpening: relation(bookId, addon.__daguanyuanFocusNextOpeningNotebookId),
        viewAvailable: view ? 1 : 0, categoryState: buttonState(category), locatorState: buttonState(locator),
        focusInNotebook: membership(focus), visibleFocusInNotebook: membership(visible), memoryInNotebook: membership(memory),
        focusMatchesMemory: sameNote(focus), visibleFocusMatchesMemory: sameNote(visible),
        categoryMatchesFocus: titleMatches(focus), categoryMatchesVisible: titleMatches(visible), categoryMatchesMemory: titleMatches(memory),
      };
      const key = JSON.stringify(state), now = Date.now();
      if (stage === 'loop_sample' && addon.__daguanyuanFocusNextTraceKey === key
        && now - Number(addon.__daguanyuanFocusNextTraceAt || 0) < 5000) return;
      addon.__daguanyuanFocusNextTraceKey = key;
      addon.__daguanyuanFocusNextTraceAt = now;
      state.stage = stage;
      state.loopGeneration = Number(addon.__daguanyuanFocusNextRememberToken || 0);
      state.tickCount = Number(addon.__daguanyuanFocusNextTickCount || 0);
      state.heartbeatAgeMs = addon.__daguanyuanFocusNextTickAt === undefined ? -1 : Math.max(0, now - addon.__daguanyuanFocusNextTickAt);
      __DAGUANYUAN_DIAGNOSTICS_GLOBAL__.info('focus.trace', state);
    } catch (ignored) { /* 诊断采样不能影响选卡和原来的刷新任务。 */ }
  }

  function activeButtons(addon) {
    if (!addon) return [];
    const core = __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__;
    // 原生 hidden 在学习集切换期间会暂时为真，不能把它当作用户关闭跟随。
    return [addon.__daguanyuanFocusCategoryRequested === true && core.categoryEnabled() && addon.__daguanyuanFocusCategoryButton,
      addon.__daguanyuanQuestionLocatorRequested === true && core.questionLocatorEnabled() && addon.__daguanyuanQuestionLocatorButton]
      .filter(Boolean);
  }

  function restoreNavigationViews(addon) {
    const view = viewFor(addon);
    if (!view) return false;
    let changed = false;
    for (const button of activeButtons(addon)) {
      if (button.hidden) button.hidden = false;
      if (isAttachedToView(button, view)) continue;
      if (button.superview) button.removeFromSuperview();
      view.addSubview(button);
      changed = true;
    }
    if (changed) place(addon);
    return true;
  }

  function rememberLoop(addon, token) {
    if (!addon || addon.__daguanyuanFocusNextRememberToken !== token) return;
    if (!activeButtons(addon).length) { diagnose(addon, 'loop_inactive'); return; }
    addon.__daguanyuanFocusNextTickCount = Number(addon.__daguanyuanFocusNextTickCount || 0) + 1;
    addon.__daguanyuanFocusNextTickAt = Date.now();
    try {
      // 切换脑图时学习界面可能暂时消失或被替换，不能据此结束选卡跟随。
      if (restoreNavigationViews(addon)) {
        const note = __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.rememberFocus(addon);
        refreshCategory(addon, note);
        addon.__daguanyuanFocusNextRefreshFailed = false;
      }
    } catch (error) {
      if (!addon.__daguanyuanFocusNextRefreshFailed) console.log(`[Daguanyuan Bridge Focus Next] 刷新暂时失败，将自动重试：${error && error.message || error}`);
      if (!addon.__daguanyuanFocusNextRefreshFailed && typeof __DAGUANYUAN_DIAGNOSTICS_GLOBAL__ !== 'undefined') {
        try { __DAGUANYUAN_DIAGNOSTICS_GLOBAL__.error('focus.refresh.failure', error, { stage: 'refresh_category' }); }
        catch (ignored) { /* 日志异常不能中断下一轮刷新。 */ }
      }
      addon.__daguanyuanFocusNextRefreshFailed = true;
    } finally {
      diagnose(addon, 'loop_sample');
      if (addon.__daguanyuanFocusNextRememberToken === token && activeButtons(addon).length
        && typeof NSTimer !== "undefined" && NSTimer.scheduledTimerWithTimeInterval) {
        NSTimer.scheduledTimerWithTimeInterval(0.15, false, function () { rememberLoop(addon, token); });
      }
    }
  }

  function startRemembering(addon) {
    if (!addon) return;
    const token = Number(addon.__daguanyuanFocusNextRememberToken || 0) + 1;
    addon.__daguanyuanFocusNextRememberToken = token;
    diagnose(addon, 'loop_start');
    rememberLoop(addon, token);
  }

  function show(addon) {
    if (!addon) return false;
    const view = viewFor(addon);
    const showCategory = __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.categoryEnabled();
    addon.__daguanyuanFocusCategoryRequested = Boolean(showCategory);
    const buttonDefinitions = [
      { property: "__daguanyuanFocusCategoryButton", title: "无题型分类", action: "openFocusCategory:", panAction: "handleFocusCategoryButtonPan:", visible: showCategory },
    ];
    for (const definition of buttonDefinitions) {
      let button = addon[definition.property];
      if (definition.visible === false) {
        if (button) {
          button.hidden = true;
          if (button.superview) button.removeFromSuperview();
        }
        continue;
      }
      if (!button) {
        button = new UIButton({ x: 0, y: 0, width: BUTTON_WIDTH, height: BUTTON_HEIGHT });
        setAdaptiveTitle(button, definition.title);
        button.setTitleColorForState(UIColor.whiteColor(), 0);
        button.titleLabel.font = UIFont.boldSystemFontOfSize(14);
        button.titleLabel.numberOfLines = 1;
        button.titleLabel.lineBreakMode = 4;
        button.backgroundColor = UIColor.colorWithRedGreenBlueAlpha(0.12, 0.42, 0.78, 0.94);
        button.layer.cornerRadius = 8;
        button.layer.masksToBounds = true;
        if (definition.action) button.addTargetActionForControlEvents(addon, definition.action, 1 << 6);
        button.addGestureRecognizer(new UIPanGestureRecognizer(addon, definition.panAction));
        addon[definition.property] = button;
      }
      if (view && !isAttachedToView(button, view)) {
        if (button.superview) button.removeFromSuperview();
        view.addSubview(button);
      }
      button.hidden = false;
    }
    place(addon);
    schedulePlace(addon);
    startRemembering(addon);
    return Boolean(view);
  }

  function syncQuestionLocator(addon) {
    if (!addon) return false;
    const view = viewFor(addon);
    let button = addon.__daguanyuanQuestionLocatorButton;
    addon.__daguanyuanQuestionLocatorRequested = Boolean(__DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.questionLocatorEnabled());
    if (!addon.__daguanyuanQuestionLocatorRequested) {
      if (button) {
        button.hidden = true;
        if (button.superview) button.removeFromSuperview();
      }
      startRemembering(addon);
      return false;
    }
    if (!button) {
      button = new UIButton({ x: 0, y: 0, width: BUTTON_WIDTH, height: BUTTON_HEIGHT });
      button.setTitleForState("定位题目", 0);
      button.setTitleColorForState(UIColor.whiteColor(), 0);
      button.titleLabel.font = UIFont.boldSystemFontOfSize(14);
      button.titleLabel.numberOfLines = 1;
      button.titleLabel.lineBreakMode = 4;
      button.backgroundColor = UIColor.colorWithRedGreenBlueAlpha(0.12, 0.42, 0.78, 0.94);
      button.layer.cornerRadius = 8;
      button.layer.masksToBounds = true;
      button.addTargetActionForControlEvents(addon, "locateQuestion:", 1 << 6);
      button.addGestureRecognizer(new UIPanGestureRecognizer(addon, "handleQuestionLocatorButtonPan:"));
      addon.__daguanyuanQuestionLocatorButton = button;
    }
    button.__daguanyuanContentWidth = BUTTON_WIDTH;
    if (view && !isAttachedToView(button, view)) {
      if (button.superview) button.removeFromSuperview();
      view.addSubview(button);
    }
    button.hidden = false;
    place(addon);
    schedulePlace(addon);
    startRemembering(addon);
    return Boolean(view);
  }

  function hide(addon) {
    if (addon) {
      addon.__daguanyuanFocusCategoryRequested = false;
      addon.__daguanyuanQuestionLocatorRequested = false;
      addon.__daguanyuanFocusNextRememberToken = Number(addon.__daguanyuanFocusNextRememberToken || 0) + 1;
      addon.__daguanyuanFocusNextPlaceToken = Number(addon.__daguanyuanFocusNextPlaceToken || 0) + 1;
    }
    const buttons = [addon && addon.__daguanyuanFocusCategoryButton, addon && addon.__daguanyuanQuestionLocatorButton];
    for (const button of buttons) {
      if (!button) continue;
      button.hidden = true;
      if (button.superview) button.removeFromSuperview();
    }
    diagnose(addon, 'navigation_hidden');
  }

  function remove(addon) {
    hide(addon);
    if (addon) {
      addon.__daguanyuanFocusCategoryButton = null;
      addon.__daguanyuanQuestionLocatorButton = null;
    }
  }

  function handleCategoryPan(addon, recognizer) {
    handlePan(addon, recognizer, addon && addon.__daguanyuanFocusCategoryButton, CATEGORY_POSITION_KEY);
  }

  function handleQuestionLocatorPan(addon, recognizer) {
    handlePan(addon, recognizer, addon && addon.__daguanyuanQuestionLocatorButton, QUESTION_LOCATOR_POSITION_KEY);
  }

  return {
    show,
    hide,
    remove,
    place,
    handleCategoryPan,
    refreshCategory,
    syncQuestionLocator,
    handleQuestionLocatorPan,
    diagnose,
  };
})();
