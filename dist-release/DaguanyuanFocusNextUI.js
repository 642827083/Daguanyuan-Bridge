var __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__ = (function () {
  const BUTTON_WIDTH = 76;
  const MAX_BUTTON_WIDTH = 260;
  const TITLE_HORIZONTAL_PADDING = 28;
  const BUTTON_HEIGHT = 36;
  const RIGHT_MARGIN = 10;
  const NEXT_POSITION_KEY = "cn.marginnote.daguanyuan-bridge.focus-next.next-button-position";
  const PREVIOUS_POSITION_KEY = "cn.marginnote.daguanyuan-bridge.focus-next.previous-button-position";
  const CATEGORY_POSITION_KEY = "cn.marginnote.daguanyuan-bridge.focus-next.category-button-position";

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
    const candidates = [addon && addon.window, focusWindow, undefined];
    for (const window of candidates) {
      try {
        const controller = window === undefined ? application.studyController() : application.studyController(window);
        if (controller && controller.view) return controller.view;
      } catch (ignored) {}
    }
    return undefined;
  }

  function buttonWidth(addon, button) {
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
    const width = buttonWidth(addon, button);
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
    const previous = addon && addon.__daguanyuanFocusPreviousButton;
    const next = addon && addon.__daguanyuanFocusNextButton;
    const category = addon && addon.__daguanyuanFocusCategoryButton;
    const view = viewFor(addon);
    if (!view || !view.bounds) return false;
    const previousPlaced = placeButton(addon, previous, PREVIOUS_POSITION_KEY, RIGHT_MARGIN);
    const nextPlaced = placeButton(addon, next, NEXT_POSITION_KEY, Math.max(0, (view.bounds.width - buttonWidth(addon, next)) - RIGHT_MARGIN));
    const categoryPlaced = placeButton(
      addon,
      category,
      CATEGORY_POSITION_KEY,
      Math.max(0, view.bounds.width - buttonWidth(addon, category) - RIGHT_MARGIN),
      Math.max(0, (view.bounds.height - BUTTON_HEIGHT) / 2 - BUTTON_HEIGHT - 10)
    );
    return previousPlaced || nextPlaced || categoryPlaced;
  }

  function savePosition(addon, button, positionKey) {
    if (!button || !button.frame) return;
    const view = viewFor(addon);
    if (!view || !view.bounds) return;
    const width = buttonWidth(addon, button);
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
      const width = buttonWidth(addon, button);
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
        if (button !== addon.__daguanyuanFocusCategoryButton) addon.__daguanyuanFocusNextSuppressTap = true;
      }
      addon.__daguanyuanFocusNextDragging = false;
    }
  }

  function refreshProgress(addon, note) {
    const previous = addon && addon.__daguanyuanFocusPreviousButton;
    const next = addon && addon.__daguanyuanFocusNextButton;
    const enabled = __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.progressEnabled();
    const progressNote = note || (addon && addon.__daguanyuanFocusNextLastFocus);
    const progress = enabled && __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.siblingProgress(progressNote);
    const suffix = progress ? `（${progress.index}/${progress.total}）` : "";
    let widthChanged = false;
    if (previous) widthChanged = setAdaptiveTitle(previous, `上一张${suffix}`) || widthChanged;
    if (next) widthChanged = setAdaptiveTitle(next, `下一张${suffix}`) || widthChanged;
    const currentWidth = Number((next && next.frame && next.frame.width) || (previous && previous.frame && previous.frame.width));
    if (widthChanged || currentWidth !== buttonWidth(addon, next || previous)) place(addon);
    return progress;
  }

  function refreshCategory(addon, note) {
    const button = addon && addon.__daguanyuanFocusCategoryButton;
    if (!button) return "";
    const focusNote = note || (addon && addon.__daguanyuanFocusNextLastFocus);
    const title = __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.parentTitle(focusNote);
    const widthChanged = setAdaptiveTitle(button, title);
    if (widthChanged || Number(button.frame && button.frame.width) !== buttonWidth(addon, button)) place(addon);
    return title;
  }

  function rememberLoop(addon, token) {
    const next = addon && addon.__daguanyuanFocusNextButton;
    const previous = addon && addon.__daguanyuanFocusPreviousButton;
    if (!addon || addon.__daguanyuanFocusNextRememberToken !== token || (!next && !previous) || (next && next.hidden && previous && previous.hidden)) return;
    const note = __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.rememberFocus(addon);
    refreshProgress(addon, note);
    refreshCategory(addon, note);
    if (typeof NSTimer !== "undefined" && NSTimer.scheduledTimerWithTimeInterval) NSTimer.scheduledTimerWithTimeInterval(0.15, false, function () { rememberLoop(addon, token); });
  }

  function startRemembering(addon) {
    if (!addon) return;
    const token = Number(addon.__daguanyuanFocusNextRememberToken || 0) + 1;
    addon.__daguanyuanFocusNextRememberToken = token;
    const note = __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.rememberFocus(addon);
    refreshProgress(addon, note);
    refreshCategory(addon, note);
    if (typeof NSTimer === "undefined" || !NSTimer.scheduledTimerWithTimeInterval) return;
    NSTimer.scheduledTimerWithTimeInterval(0.15, false, function () { rememberLoop(addon, token); });
  }

  function show(addon) {
    const view = viewFor(addon);
    if (!view) return false;
    const showPrevious = __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.previousEnabled();
    const showCategory = __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.categoryEnabled();
    const buttonDefinitions = [
      { property: "__daguanyuanFocusPreviousButton", title: "上一张", action: "focusPrevious:", panAction: "handleFocusPreviousButtonPan:", visible: showPrevious },
      { property: "__daguanyuanFocusNextButton", title: "下一张", action: "focusNext:", panAction: "handleFocusNextButtonPan:" },
      { property: "__daguanyuanFocusCategoryButton", title: "无题型分类", panAction: "handleFocusCategoryButtonPan:", visible: showCategory },
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
      if (button.superview !== view) {
        if (button.superview) button.removeFromSuperview();
        view.addSubview(button);
      }
      button.hidden = false;
    }
    place(addon);
    schedulePlace(addon);
    startRemembering(addon);
    return true;
  }

  function hide(addon) {
    if (addon) {
      addon.__daguanyuanFocusNextRememberToken = Number(addon.__daguanyuanFocusNextRememberToken || 0) + 1;
      addon.__daguanyuanFocusNextPlaceToken = Number(addon.__daguanyuanFocusNextPlaceToken || 0) + 1;
    }
    const buttons = [addon && addon.__daguanyuanFocusPreviousButton, addon && addon.__daguanyuanFocusNextButton, addon && addon.__daguanyuanFocusCategoryButton];
    for (const button of buttons) {
      if (!button) continue;
      button.hidden = true;
      if (button.superview) button.removeFromSuperview();
    }
  }

  function remove(addon) {
    hide(addon);
    if (addon) {
      addon.__daguanyuanFocusPreviousButton = null;
      addon.__daguanyuanFocusNextButton = null;
      addon.__daguanyuanFocusCategoryButton = null;
    }
  }

  function handleNextPan(addon, recognizer) {
    handlePan(addon, recognizer, addon && addon.__daguanyuanFocusNextButton, NEXT_POSITION_KEY);
  }

  function handlePreviousPan(addon, recognizer) {
    handlePan(addon, recognizer, addon && addon.__daguanyuanFocusPreviousButton, PREVIOUS_POSITION_KEY);
  }

  function handleCategoryPan(addon, recognizer) {
    handlePan(addon, recognizer, addon && addon.__daguanyuanFocusCategoryButton, CATEGORY_POSITION_KEY);
  }

  return {
    show,
    hide,
    remove,
    place,
    handleNextPan,
    handlePreviousPan,
    handleCategoryPan,
    refreshProgress,
    refreshCategory,
  };
})();
