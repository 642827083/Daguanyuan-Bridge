var __DAGUANYUAN_MASTERY_UI_GLOBAL__ = (function () {
  const KEY = 'cn.marginnote.daguanyuan-bridge.card-tools.mastery-enabled';
  const choices = [
    { title: '不熟', value: 'needs_practice', color: [0.98, 0.77, 0.18], darkText: true },
    { title: '不会', value: 'not_known', color: [0.88, 0.24, 0.24] },
    { title: '掌握', value: 'mastered', color: [0.19, 0.65, 0.36] }
  ];
  function value(object, key) {
    if (!object) return undefined;
    let item = object[key];
    if (item === undefined && typeof object.objectForKey === 'function') item = object.objectForKey(key);
    return typeof item === 'function' ? item.call(object) : item;
  }
  function enabled() {
    const flag = NSUserDefaults.standardUserDefaults().objectForKey(KEY);
    if (flag === undefined || flag === null) return false;
    if (typeof flag.booleanValue === 'function') return Boolean(flag.booleanValue());
    return !(flag === false || flag === 0 || String(flag).toLowerCase() === 'false');
  }
  function active(addon) {
    const app = Application.sharedInstance();
    return (typeof MNUtil !== 'undefined' && value(MNUtil, 'currentWindow') || value(app, 'focusWindow')) === addon.window;
  }
  function target(note) {
    const comments = __DAGUANYUAN_CARD_COMMENTS_GLOBAL__.items(value(note, 'comments'));
    const meta = __DAGUANYUAN_CARD_COMMENTS_GLOBAL__.text(comments[1]);
    const matches = meta.match(/<!--\s*DAGUANYUAN_(?:408_)?(?:QUESTION|ANSWER)_ID:([1-9]\d*)\s*-->/g) || [];
    const source = __DAGUANYUAN_SOURCE_LINK_GLOBAL__.fromComment(meta);
    if (matches.length !== 1 || !source) return null;
    const identity = matches[0].match(/DAGUANYUAN_(408_)?QUESTION_ID:([1-9]\d*)/);
    if (!identity || (identity[1] ? '408' : 'math') !== source.provider || Number(identity[2]) !== source.questionId) return null;
    const noteId = String(value(note, 'noteId') || ''), notebookId = String(value(note, 'notebookId') || '');
    if (!noteId || !notebookId) return null;
    return { noteId, notebookId, provider: source.provider, questionId: source.questionId };
  }
  function rect(raw) {
    try {
      const result = typeof raw === 'string' ? JSON.parse('[' + raw.replace(/[{}]/g, '') + ']') : null;
      if (!result || result.length !== 4 || result.some(function (n) { return typeof n !== 'number' || !Number.isFinite(n); }) || result[2] <= 0 || result[3] <= 0) return null;
      return { x: result[0], y: result[1], width: result[2], height: result[3] };
    } catch (_) { return null; }
  }
  function frame(card, studyFrame) {
    const margin = 8, gap = 6, width = Math.min(240, studyFrame.width - margin * 2), height = 36;
    if (width < 180 || studyFrame.height < height + margin * 2) return null;
    const bottom = card.y - studyFrame.y + card.height + gap;
    const above = card.y - studyFrame.y - height - gap;
    const y = bottom + height <= studyFrame.height - margin ? bottom : above >= margin ? above : studyFrame.height - height - margin;
    return { x: Math.max(margin, Math.min(studyFrame.width - width - margin, card.x - studyFrame.x + (card.width - width) / 2)), y: Math.max(margin, y), width, height };
  }
  function hide(addon) {
    addon.__daguanyuanMasteryTarget = null;
    addon.__daguanyuanMasteryNote = null;
    addon.__daguanyuanMasteryEpoch = (addon.__daguanyuanMasteryEpoch || 0) + 1;
    if (addon.__daguanyuanMasteryToolbar) addon.__daguanyuanMasteryToolbar.hidden = true;
  }
  function create(addon) {
    if (addon.__daguanyuanMasteryToolbar) return addon.__daguanyuanMasteryToolbar;
    const toolbar = new UIView({ x: 0, y: 0, width: 240, height: 36 });
    toolbar.backgroundColor = UIColor.clearColor(); toolbar.hidden = true;
    addon.__daguanyuanMasteryButtons = choices.map(function (choice, index) {
      const button = new UIButton({ x: 0, y: 0, width: 76, height: 36 });
      button.tag = index; button.setTitleForState(choice.title, 0);
      button.setTitleColorForState(choice.darkText ? UIColor.darkGrayColor() : UIColor.whiteColor(), 0);
      button.backgroundColor = UIColor.colorWithRedGreenBlueAlpha(choice.color[0], choice.color[1], choice.color[2], 1);
      button.titleLabel.font = UIFont.boldSystemFontOfSize(14); button.layer.cornerRadius = 7;
      button.addTargetActionForControlEvents(addon, 'onMasteryPress:', 1 << 0);
      button.addTargetActionForControlEvents(addon, 'onMasteryClick:', 1 << 6);
      toolbar.addSubview(button); return button;
    });
    addon.__daguanyuanMasteryToolbar = toolbar; return toolbar;
  }
  function show(addon, sender) {
    if (!active(addon)) return;
    hide(addon);
    if (!enabled()) return;
    const info = value(sender, 'userInfo'), note = value(info, 'note'), selected = target(note), card = rect(value(info, 'winRect'));
    if (!selected || !card) return;
    const study = Application.sharedInstance().studyController(addon.window);
    if (!study || !study.view) return;
    const notebook = value(study, 'notebookController');
    if (String(value(notebook, 'notebookId') || '') !== selected.notebookId) return;
    const placement = frame(card, study.view.frame);
    if (!placement) return;
    const toolbar = create(addon); toolbar.frame = placement;
    addon.__daguanyuanMasteryButtons.forEach(function (button, index) {
      const width = (placement.width - 12) / 3;
      button.frame = { x: index * (width + 6), y: 0, width, height: 36 };
      button.enabled = !addon.__daguanyuanMasteryTask;
    });
    if (toolbar.superview !== study.view) { if (toolbar.superview) toolbar.removeFromSuperview(); study.view.addSubview(toolbar); }
    addon.__daguanyuanMasteryTarget = selected; addon.__daguanyuanMasteryRect = card; addon.__daguanyuanMasteryNote = note;
    addon.__daguanyuanMasteryPress = null;
    addon.__daguanyuanMasteryPressedUntil = 0; toolbar.hidden = false;
  }
  function close(addon) {
    if (!active(addon)) return;
    const epoch = addon.__daguanyuanMasteryEpoch;
    // 宿主菜单关闭通知可能晚于下一张题卡的显示，也可能由按钮轻点触发。
    NSTimer.scheduledTimerWithTimeInterval(0.15, false, function () {
      if (epoch !== addon.__daguanyuanMasteryEpoch) return;
      if (Date.now() < (addon.__daguanyuanMasteryPressedUntil || 0)) {
        NSTimer.scheduledTimerWithTimeInterval(0.5, false, function () { if (epoch === addon.__daguanyuanMasteryEpoch) close(addon); }); return;
      }
      const menu = typeof PopupMenu !== 'undefined' && typeof PopupMenu.currentMenu === 'function' && PopupMenu.currentMenu(), expected = addon.__daguanyuanMasteryRect;
      const current = value(menu, 'targetWinRect');
      if (value(menu, 'visible') && expected && current && ['x', 'y', 'width', 'height'].every(function (key) { return Math.abs(current[key] - expected[key]) <= 2; })) return;
      hide(addon);
    });
  }
  function press(addon, sender) {
    addon.__daguanyuanMasteryPressedUntil = Date.now() + 600;
    addon.__daguanyuanMasteryPress = { epoch: addon.__daguanyuanMasteryEpoch, index: Number(value(sender, 'tag')) };
  }
  function click(addon, sender) {
    const selected = addon.__daguanyuanMasteryTarget, choice = choices[Number(value(sender, 'tag'))];
    if (!active(addon) || !enabled() || !selected || !choice || addon.__daguanyuanMasteryTask) return;
    const pressed = addon.__daguanyuanMasteryPress;
    if (pressed && (pressed.epoch !== addon.__daguanyuanMasteryEpoch || pressed.index !== Number(value(sender, 'tag')))) return;
    const study = Application.sharedInstance().studyController(addon.window), notebook = value(study, 'notebookController');
    const focused = value(notebook, 'visibleFocusNote') || value(notebook, 'focusNote');
    if (String(value(notebook, 'notebookId') || '') !== selected.notebookId || focused && String(value(focused, 'noteId') || '') !== selected.noteId) { hide(addon); return; }
    // 点工具按钮可能关闭宿主菜单并清空焦点；此时只允许刚按下的题卡操作。
    const selectedNote = focused || (pressed && Date.now() < addon.__daguanyuanMasteryPressedUntil ? addon.__daguanyuanMasteryNote : null);
    const current = target(selectedNote);
    if (!current || current.questionId !== selected.questionId || current.provider !== selected.provider) { hide(addon); return; }
    hide(addon);
    function message(text) { if (addon.panelController && active(addon)) __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.showMessage(addon, text); }
    message('正在同步“' + choice.title + '”…');
    __DAGUANYUAN_MASTERY_SYNC_GLOBAL__.save(addon, selected, choice.value).then(function (result) {
      message(result && result.mode === 'retest' ? '已记录本次复测：' + choice.title : '已同步到' + (selected.provider === '408' ? '408 网站' : '大观园') + '：' + choice.title);
    }, function (error) { message(String(error.message || error)); }).then(function () {
      (addon.__daguanyuanMasteryButtons || []).forEach(function (button) { button.enabled = true; });
    });
  }
  function register(addon) {
    if (addon.__daguanyuanMasteryObservers) return true;
    if (typeof MNUtil === 'undefined' || typeof MNUtil.addObserver !== 'function' || typeof MNUtil.removeObserver !== 'function') return false;
    MNUtil.addObserver(addon, 'onMasteryCard:', 'PopupMenuOnNote');
    MNUtil.addObserver(addon, 'onMasteryCardClose:', 'ClosePopupMenuOnNote');
    addon.__daguanyuanMasteryObservers = true; return true;
  }
  function unregister(addon) {
    hide(addon);
    if (addon.__daguanyuanMasteryObservers && typeof MNUtil !== 'undefined' && typeof MNUtil.removeObserver === 'function') {
      MNUtil.removeObserver(addon, 'PopupMenuOnNote'); MNUtil.removeObserver(addon, 'ClosePopupMenuOnNote');
    }
    addon.__daguanyuanMasteryObservers = false;
    if (addon.__daguanyuanMasteryToolbar && addon.__daguanyuanMasteryToolbar.superview) addon.__daguanyuanMasteryToolbar.removeFromSuperview();
    addon.__daguanyuanMasteryToolbar = null; addon.__daguanyuanMasteryButtons = null;
  }
  function setEnabled(addon, flag) {
    if (flag && !register(addon)) throw new Error('掌握标记需要 MN Utils，请安装并启用最新版 MN Utils');
    NSUserDefaults.standardUserDefaults().setObjectForKey(Boolean(flag), KEY);
    if (!flag) hide(addon);
    return enabled();
  }
  return { enabled, setEnabled, register, unregister, show, close, hide, press, click, target, rect, frame };
})();
