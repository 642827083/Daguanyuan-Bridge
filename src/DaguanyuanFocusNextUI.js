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
    let retry = false;
    try {
      const label = button && button.titleLabel;
      if (label && typeof label.sizeThatFits === "function") {
        retry = true;
        label.text = text;
        const size = label.sizeThatFits({ width: 1000, height: BUTTON_HEIGHT });
        const nativeWidth = finiteNumber(size && size.width);
        if (nativeWidth !== undefined && nativeWidth > 0) return { width: nativeWidth, cacheable: true };
      }
    } catch (ignored) { retry = true; }
    let estimatedWidth = 0;
    for (let index = 0; index < text.length; index += 1) {
      estimatedWidth += text.charCodeAt(index) <= 127 ? 8 : 14;
    }
    return { width: estimatedWidth, cacheable: !retry };
  }

  function setAdaptiveTitle(button, title) {
    if (!button) return false;
    const text = String(title || "");
    // 名称未变化时复用成功的测量结果；仍由刷新循环检查选卡与视图归属。
    if (button.__daguanyuanMeasuredTitle === text && finiteNumber(button.__daguanyuanContentWidth) !== undefined) return false;
    const measured = measuredTitleWidth(button, text);
    const width = Math.max(
      BUTTON_WIDTH,
      Math.min(MAX_BUTTON_WIDTH, Math.ceil(measured.width + TITLE_HORIZONTAL_PADDING))
    );
    const changed = finiteNumber(button.__daguanyuanContentWidth) !== width;
    button.setTitleForState(text, 0);
    button.__daguanyuanContentWidth = width;
    // 切换学习集期间原生测量可能暂不可用，估算宽度不阻止下一轮重试。
    button.__daguanyuanMeasuredTitle = measured.cacheable ? text : undefined;
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
    if (addon && addon.__daguanyuanFocusNextDrag) return false;
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

  function draggingButton(addon, button) {
    const drag = addon.__daguanyuanFocusNextDrag;
    return drag && drag.button === button;
  }

  function finishDrag(addon) {
    const drag = addon && addon.__daguanyuanFocusNextDrag;
    if (!drag) return;
    addon.__daguanyuanFocusNextDrag = null;
    const position = {
      xRatio: drag.x / Math.max(1, drag.maxX),
      yRatio: drag.y / Math.max(1, drag.maxY),
      viewWidth: drag.bounds.width,
      viewHeight: drag.bounds.height,
    };
    try { NSUserDefaults.standardUserDefaults().setObjectForKey(JSON.stringify(position), drag.positionKey); } catch (error) {
      console.log(`[Daguanyuan Bridge Focus Next] 保存按钮位置失败：${error && error.message || error}`);
    }
  }

  function schedulePlace(addon) {
    if (!addon || typeof NSTimer === "undefined" || !NSTimer.scheduledTimerWithTimeInterval) return;
    const token = Number(addon.__daguanyuanFocusNextPlaceToken || 0) + 1;
    addon.__daguanyuanFocusNextPlaceToken = token;
    const delays = [0.08, 0.25, 0.6];
    function run(index) {
      if (!addon || addon.__daguanyuanFocusNextPlaceToken !== token || addon.__daguanyuanFocusNextDrag) return;
      place(addon);
      if (index < delays.length) NSTimer.scheduledTimerWithTimeInterval(delays[index], false, function () { run(index + 1); });
    }
    NSTimer.scheduledTimerWithTimeInterval(delays[0], false, function () { run(1); });
  }

  function bindNavigationButton(addon, button, action, panAction) {
    button.setTitleColorForState(UIColor.colorWithRedGreenBlueAlpha(1, 1, 1, 0.55), 1);
    button.addTargetActionForControlEvents(addon, action, 1 << 6);
    const pan = new UIPanGestureRecognizer(addon, panAction);
    // 由系统只取消本次拖动的触摸，下一次轻点可立即响应。
    pan.cancelsTouchesInView = true;
    pan.delaysTouchesBegan = false;
    pan.delaysTouchesEnded = false;
    button.addGestureRecognizer(pan);
  }

  function handlePan(addon, recognizer, button, positionKey) {
    if (!addon || !button) return;
    const state = Number(recognizer.state);
    let drag = addon.__daguanyuanFocusNextDrag;
    if (state === 1 && !drag) {
      const view = button.superview;
      if (!view || button.hidden) return;
      const bounds = view.bounds, frame = button.frame;
      if (!bounds || !frame) return;
      drag = { button, positionKey, view, bounds, width: frame.width, height: frame.height,
        x: frame.x, y: frame.y, maxX: Math.max(0, bounds.width - frame.width), maxY: Math.max(0, bounds.height - frame.height) };
      addon.__daguanyuanFocusNextDrag = drag;
      addon.__daguanyuanFocusNextPlaceToken = Number(addon.__daguanyuanFocusNextPlaceToken || 0) + 1;
    }
    if (!drag || drag.button !== button) return;
    if (state === 1 || state === 2) {
      // 整次拖动使用同一父视图；移动回调只读手势增量、更新这个按钮。
      const delta = recognizer.translationInView(drag.view);
      if (!delta) return;
      const dx = Number(delta.x), dy = Number(delta.y);
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
      drag.x = Math.max(0, Math.min(drag.maxX, drag.x + dx));
      drag.y = Math.max(0, Math.min(drag.maxY, drag.y + dy));
      button.frame = { x: drag.x, y: drag.y, width: drag.width, height: drag.height };
      recognizer.setTranslationInView({ x: 0, y: 0 }, drag.view);
    } else if (state === 3 || state === 4 || state === 5) {
      finishDrag(addon);
      const bounds = drag.view.bounds;
      if (bounds && (bounds.width !== drag.bounds.width || bounds.height !== drag.bounds.height)) place(addon);
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

  function scheduleRemember(addon, token) {
    if (typeof NSTimer !== 'undefined' && NSTimer.scheduledTimerWithTimeInterval) {
      NSTimer.scheduledTimerWithTimeInterval(0.15, false, function () { rememberLoop(addon, token); });
    }
  }

  function rememberLoop(addon, token) {
    if (!addon || addon.__daguanyuanFocusNextRememberToken !== token) return;
    if (addon.__daguanyuanFocusNextDrag) {
      // 拖动中不重新挂载按钮、测量标题或读取脑图；松手后下一轮自动恢复。
      scheduleRemember(addon, token);
      return;
    }
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
      if (addon.__daguanyuanFocusNextRememberToken === token && activeButtons(addon).length) scheduleRemember(addon, token);
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
          if (draggingButton(addon, button)) finishDrag(addon);
          button.hidden = true;
          if (button.superview) button.removeFromSuperview();
        }
        continue;
      }
      if (!button) {
        button = new UIButton({ x: 0, y: 0, width: BUTTON_WIDTH, height: BUTTON_HEIGHT });
        button.setTitleColorForState(UIColor.whiteColor(), 0);
        button.titleLabel.font = UIFont.boldSystemFontOfSize(14);
        setAdaptiveTitle(button, definition.title);
        button.titleLabel.numberOfLines = 1;
        button.titleLabel.lineBreakMode = 4;
        button.backgroundColor = UIColor.colorWithRedGreenBlueAlpha(0.12, 0.42, 0.78, 0.94);
        button.layer.cornerRadius = 8;
        button.layer.masksToBounds = true;
        bindNavigationButton(addon, button, definition.action, definition.panAction);
        addon[definition.property] = button;
      }
      if (view && !draggingButton(addon, button) && !isAttachedToView(button, view)) {
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
        if (draggingButton(addon, button)) finishDrag(addon);
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
      bindNavigationButton(addon, button, "locateQuestion:", "handleQuestionLocatorButtonPan:");
      addon.__daguanyuanQuestionLocatorButton = button;
    }
    button.__daguanyuanContentWidth = BUTTON_WIDTH;
    if (view && !draggingButton(addon, button) && !isAttachedToView(button, view)) {
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
      finishDrag(addon);
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
    finishDrag,
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
