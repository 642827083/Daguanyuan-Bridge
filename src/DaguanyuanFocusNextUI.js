var __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__ = (function () {
  const BUTTON_WIDTH = 76;
  const BUTTON_HEIGHT = 36;
  const RIGHT_MARGIN = 10;
  const NEXT_POSITION_KEY = "cn.marginnote.daguanyuan-bridge.focus-next.next-button-position";
  const PREVIOUS_POSITION_KEY = "cn.marginnote.daguanyuan-bridge.focus-next.previous-button-position";

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

  function placeButton(addon, button, positionKey, defaultX) {
    const view = viewFor(addon);
    if (!button || !view || !view.bounds) return false;
    const saved = readSavedPosition(positionKey);
    const availableWidth = Math.max(0, view.bounds.width - BUTTON_WIDTH);
    const availableHeight = Math.max(0, view.bounds.height - BUTTON_HEIGHT);
    const savedXRatio = finiteNumber(saved && saved.xRatio);
    const savedYRatio = finiteNumber(saved && saved.yRatio);
    const legacyX = finiteNumber(saved && saved.x);
    const legacyY = finiteNumber(saved && saved.y);
    const savedViewWidth = finiteNumber(saved && saved.viewWidth);
    const savedViewHeight = finiteNumber(saved && saved.viewHeight);
    const legacyWidth = Math.max(1, (savedViewWidth || view.bounds.width) - BUTTON_WIDTH);
    const legacyHeight = Math.max(1, (savedViewHeight || view.bounds.height) - BUTTON_HEIGHT);
    const defaultY = availableHeight / 2;
    const x = savedXRatio !== undefined ? savedXRatio * availableWidth : legacyX !== undefined ? (legacyX / legacyWidth) * availableWidth : defaultX;
    const y = savedYRatio !== undefined ? savedYRatio * availableHeight : legacyY !== undefined ? (legacyY / legacyHeight) * availableHeight : defaultY;
    button.frame = {
      x: Math.max(0, Math.min(availableWidth, x)),
      y: Math.max(0, Math.min(availableHeight, y)),
      width: BUTTON_WIDTH,
      height: BUTTON_HEIGHT,
    };
    return true;
  }

  function place(addon) {
    const previous = addon && addon.__daguanyuanFocusPreviousButton;
    const next = addon && addon.__daguanyuanFocusNextButton;
    const view = viewFor(addon);
    if (!view || !view.bounds) return false;
    const previousPlaced = placeButton(addon, previous, PREVIOUS_POSITION_KEY, RIGHT_MARGIN);
    const nextPlaced = placeButton(addon, next, NEXT_POSITION_KEY, Math.max(0, (view.bounds.width - BUTTON_WIDTH) - RIGHT_MARGIN));
    return previousPlaced || nextPlaced;
  }

  function savePosition(addon, button, positionKey) {
    if (!button || !button.frame) return;
    const view = viewFor(addon);
    if (!view || !view.bounds) return;
    const availableWidth = Math.max(1, view.bounds.width - BUTTON_WIDTH);
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
      button.frame = {
        x: Math.max(0, Math.min(view.bounds.width - BUTTON_WIDTH, frame.x + Number(translation.x || 0))),
        y: Math.max(0, Math.min(view.bounds.height - BUTTON_HEIGHT, frame.y + Number(translation.y || 0))),
        width: BUTTON_WIDTH,
        height: BUTTON_HEIGHT,
      };
      recognizer.setTranslationInView({ x: 0, y: 0 }, view);
      return;
    }
    if (state === 3 || state === 4) {
      if (addon.__daguanyuanFocusNextDragging) {
        savePosition(addon, button, positionKey);
        addon.__daguanyuanFocusNextSuppressTap = true;
      }
      addon.__daguanyuanFocusNextDragging = false;
    }
  }

  function rememberLoop(addon, token) {
    const next = addon && addon.__daguanyuanFocusNextButton;
    const previous = addon && addon.__daguanyuanFocusPreviousButton;
    if (!addon || addon.__daguanyuanFocusNextRememberToken !== token || (!next && !previous) || (next && next.hidden && previous && previous.hidden)) return;
    __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.rememberFocus(addon);
    if (typeof NSTimer !== "undefined" && NSTimer.scheduledTimerWithTimeInterval) NSTimer.scheduledTimerWithTimeInterval(0.15, false, function () { rememberLoop(addon, token); });
  }

  function startRemembering(addon) {
    if (!addon || typeof NSTimer === "undefined" || !NSTimer.scheduledTimerWithTimeInterval) return;
    const token = Number(addon.__daguanyuanFocusNextRememberToken || 0) + 1;
    addon.__daguanyuanFocusNextRememberToken = token;
    __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.rememberFocus(addon);
    NSTimer.scheduledTimerWithTimeInterval(0.15, false, function () { rememberLoop(addon, token); });
  }

  function show(addon) {
    const view = viewFor(addon);
    if (!view) return false;
    const buttonDefinitions = [
      { property: "__daguanyuanFocusPreviousButton", title: "上一张", action: "focusPrevious:", panAction: "handleFocusPreviousButtonPan:" },
      { property: "__daguanyuanFocusNextButton", title: "下一张", action: "focusNext:", panAction: "handleFocusNextButtonPan:" },
    ];
    for (const definition of buttonDefinitions) {
      let button = addon[definition.property];
      if (!button) {
        button = new UIButton({ x: 0, y: 0, width: BUTTON_WIDTH, height: BUTTON_HEIGHT });
        button.setTitleForState(definition.title, 0);
        button.setTitleColorForState(UIColor.whiteColor(), 0);
        button.titleLabel.font = UIFont.boldSystemFontOfSize(14);
        button.backgroundColor = UIColor.colorWithRedGreenBlueAlpha(0.12, 0.42, 0.78, 0.94);
        button.layer.cornerRadius = 8;
        button.layer.masksToBounds = true;
        button.addTargetActionForControlEvents(addon, definition.action, 1 << 6);
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
    const buttons = [addon && addon.__daguanyuanFocusPreviousButton, addon && addon.__daguanyuanFocusNextButton];
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
    }
  }

  function handleNextPan(addon, recognizer) {
    handlePan(addon, recognizer, addon && addon.__daguanyuanFocusNextButton, NEXT_POSITION_KEY);
  }

  function handlePreviousPan(addon, recognizer) {
    handlePan(addon, recognizer, addon && addon.__daguanyuanFocusPreviousButton, PREVIOUS_POSITION_KEY);
  }

  return { show, hide, remove, place, handleNextPan, handlePreviousPan };
})();
