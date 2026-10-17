var __DAGUANYUAN_SETTINGS_NAVIGATION_GLOBAL__ = (function () {
  const TABS = ['category', 'question', 'card', 'about'];
  const TITLES = ['题型工具', '题目工具', '题卡工具', '关于插件'];
  const CONTENT_TOP = 68;
  const SLIDER_ANIMATION = 'daguanyuan.settings.slider';
  const CONTENT_ANIMATION = 'daguanyuan.settings.content';
  function setup(controller) {
    controller.settingsSection = 'category';
    controller.settingsScrollPositions = {};
    const navigation = new UIView({ x: 20, y: 48, width: 100, height: 48 });
    navigation.backgroundColor = UIColor.colorWithWhiteAlpha(0.96, 0.96);
    navigation.layer.cornerRadius = 24;
    navigation.layer.borderWidth = 0.5;
    navigation.layer.borderColor = UIColor.lightGrayColor().colorWithAlphaComponent(0.45);
    navigation.layer.shadowColor = UIColor.colorWithWhiteAlpha(0, 1);
    navigation.layer.shadowOpacity = 0.1;
    navigation.layer.shadowOffset = { width: 0, height: 3 };
    navigation.layer.shadowRadius = 8;
    navigation.hidden = true;
    controller.settingsNavigation = navigation;
    controller.containerView.addSubview(navigation);
    const slider = new UIView({ x: 4, y: 4, width: 0, height: 40 });
    slider.backgroundColor = UIColor.whiteColor(); slider.layer.cornerRadius = 20;
    slider.layer.shadowColor = UIColor.colorWithWhiteAlpha(0, 1);
    slider.layer.shadowOpacity = 0.08; slider.layer.shadowOffset = { width: 0, height: 1 }; slider.layer.shadowRadius = 3;
    navigation.addSubview(slider); controller.settingsNavigationSlider = slider;
    controller.settingsPage.layer.masksToBounds = true;
    controller.settingsNavigationButtons = TITLES.map(function (title, index) {
      const view = new UIButton({ x: 0, y: 4, width: 100, height: 40 });
      view.tag = index;
      view.setTitleForState(title, 0);
      view.titleLabel.font = UIFont.boldSystemFontOfSize(14);
      view.layer.cornerRadius = 20;
      view.backgroundColor = UIColor.colorWithWhiteAlpha(1, 0);
      view.addTargetActionForControlEvents(controller, 'selectSettingsSection:', 1 << 0);
      navigation.addSubview(view);
      return view;
    });
  }
  function sections(controller) {
    return [controller.categorySettingsSection, controller.questionToolsSettingsSection,
      controller.cardToolsSettingsSection, controller.aboutSettingsSection];
  }
  function removeAnimation(view, key) {
    if (view && view.layer && typeof view.layer.removeAnimationForKey === 'function') view.layer.removeAnimationForKey(key);
  }
  function animate(view, path, from, to, duration, key) {
    if (!view || !view.layer || typeof view.layer.addAnimationForKey !== 'function'
      || typeof CABasicAnimation === 'undefined' || typeof CABasicAnimation.animationWithKeyPath !== 'function'
      || typeof CAMediaTimingFunction === 'undefined' || typeof CAMediaTimingFunction.functionWithControlPoints !== 'function'
      || typeof CATransaction === 'undefined' || typeof CATransaction.begin !== 'function'
      || typeof CATransaction.commit !== 'function' || typeof CATransaction.setAnimationDuration !== 'function') return;
    try {
      const animation = CABasicAnimation.animationWithKeyPath(path);
      if (!animation) return;
      animation.fromValue = from; animation.toValue = to;
      animation.timingFunction = CAMediaTimingFunction.functionWithControlPoints(0.32, 0.72, 0, 1);
      CATransaction.begin();
      try { CATransaction.setAnimationDuration(duration); view.layer.addAnimationForKey(animation, key); }
      finally { CATransaction.commit(); }
    } catch (error) { console.log('[Daguanyuan Bridge] 设置切换动画未启用：' + String(error.message || error)); }
  }
  function moveSlider(controller, frame, animated) {
    const slider = controller.settingsNavigationSlider, previous = slider.frame;
    if (previous.x === frame.x && previous.width === frame.width) return;
    let from = previous.x + previous.width / 2;
    if (animated && typeof slider.layer.presentationLayer === 'function') {
      try {
        const presentation = slider.layer.presentationLayer();
        if (presentation && presentation.position && Number.isFinite(Number(presentation.position.x))) from = Number(presentation.position.x);
      } catch (ignored) { /* 无法读取呈现层时沿用上次布局位置。 */ }
    }
    slider.frame = frame;
    removeAnimation(slider, SLIDER_ANIMATION);
    if (animated && previous.width > 0) animate(slider, 'position.x', from, frame.x + frame.width / 2, 0.45, SLIDER_ANIMATION);
  }
  function stop(controller) {
    removeAnimation(controller.settingsNavigationSlider, SLIDER_ANIMATION);
    sections(controller).forEach(view => removeAnimation(view, CONTENT_ANIMATION));
  }
  function layout(controller, contentFrame, restoredOffset, animated) {
    if (!controller.settingsNavigation) return;
    const offset = controller.settingsPage.contentOffset;
    const requestedOffset = typeof restoredOffset === 'number' ? restoredOffset : Number(offset && offset.y) || 0;
    const width = contentFrame.width, capsuleWidth = Math.min(520, Math.max(0, width - 40));
    controller.settingsNavigation.frame = { x: (width - capsuleWidth) / 2, y: contentFrame.y + 10, width: capsuleWidth, height: 48 };
    controller.settingsNavigation.hidden = controller.activePage !== 'settings';
    controller.settingsPage.frame = contentFrame;
    controller.settingsPage.scrollIndicatorInsets = { top: CONTENT_TOP, left: 0, bottom: 0, right: 0 };
    let contentHeight = 0;
    sections(controller).forEach(function (view, index) {
      if (!view) return;
      view.hidden = TABS[index] !== controller.settingsSection;
      view.frame = { x: 20, y: CONTENT_TOP, width: Math.max(0, width - 40), height: view.frame.height };
      if (!view.hidden) contentHeight = CONTENT_TOP + view.frame.height + 16;
    });
    controller.settingsNavigationButtons.forEach(function (view, index) {
      view.frame = { x: 4 + index * (capsuleWidth - 8) / 4, y: 4, width: Math.max(0, (capsuleWidth - 8) / 4), height: 40 };
      view.selected = TABS[index] === controller.settingsSection;
      view.setTitleColorForState(view.selected ? UIColor.colorWithRedGreenBlueAlpha(0.1, 0.36, 0.72, 1) : UIColor.darkGrayColor(), 0);
    });
    const selected = Math.max(0, TABS.indexOf(controller.settingsSection));
    moveSlider(controller, controller.settingsNavigationButtons[selected].frame, animated);
    const height = controller.settingsPage.frame.height;
    controller.settingsPage.contentSize = { width, height: Math.max(height + 1, contentHeight) };
    controller.settingsPage.contentOffset = { x: 0, y: Math.max(0, Math.min(requestedOffset, Math.max(0, contentHeight - height))) };
  }
  function select(controller, sender) {
    if (controller.activePage !== 'settings' || !sender) return;
    const index = Number(sender.tag);
    if (!TABS[index] || controller.settingsNavigationButtons[index] !== sender || controller.settingsSection === TABS[index]) return;
    const offset = controller.settingsPage.contentOffset;
    controller.settingsScrollPositions[controller.settingsSection] = Math.max(0, Number(offset && offset.y) || 0);
    if (typeof __DAGUANYUAN_SUPPORT_UI_GLOBAL__ !== 'undefined') __DAGUANYUAN_SUPPORT_UI_GLOBAL__.close(controller);
    __DAGUANYUAN_CARD_LOCATOR_UI_GLOBAL__.cancelMode(controller);
    if (typeof __DAGUANYUAN_CARD_REPAIR_UI_GLOBAL__ !== 'undefined') __DAGUANYUAN_CARD_REPAIR_UI_GLOBAL__.cancel(controller);
    if (typeof __DAGUANYUAN_CARD_TOOLS_SETTINGS_GLOBAL__ !== 'undefined') __DAGUANYUAN_CARD_TOOLS_SETTINGS_GLOBAL__.cancelFold(controller);
    sections(controller).forEach(view => removeAnimation(view, CONTENT_ANIMATION));
    controller.settingsSection = TABS[index];
    layout(controller, controller.webView.frame, controller.settingsScrollPositions[controller.settingsSection] || 0, true);
    animate(sections(controller)[index], 'opacity', 0.4, 1, 0.18, CONTENT_ANIMATION);
  }
  return { setup, layout, select, stop };
})();
