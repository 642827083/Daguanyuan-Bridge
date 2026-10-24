var __DAGUANYUAN_PANEL_NAVIGATION_GLOBAL__ = (function () {
  const ANIMATION = 'daguanyuan.panel.navigation';
  function stop(controller) {
    const indicator = controller && controller.mainNavigationIndicator;
    if (indicator && typeof indicator.layer.removeAnimationForKey === 'function') indicator.layer.removeAnimationForKey(ANIMATION);
  }
  function setup(controller) {
    controller.titleBarDragRegions = [0, 1].map(function () {
      const view = new UIView({ x: 0, y: 0, width: 0, height: 0 });
      const pan = new UIPanGestureRecognizer(controller, 'movePanel:');
      view.addGestureRecognizer(pan);
      const doubleTap = new UITapGestureRecognizer(controller, 'resetPanelOnDoubleTap:');
      doubleTap.numberOfTapsRequired = 2;
      doubleTap.cancelsTouchesInView = false;
      doubleTap.delaysTouchesBegan = false; doubleTap.delaysTouchesEnded = false;
      doubleTap.requireGestureRecognizerToFail(pan);
      view.addGestureRecognizer(doubleTap); controller.titleBar.addSubview(view);
      return view;
    });
    const navigation = new UIView({ x: 0, y: 0, width: 0, height: 0 });
    controller.mainNavigation = navigation; controller.titleBar.addSubview(navigation);
    const indicator = new UIView({ x: 0, y: 0, width: 0, height: 0 });
    indicator.backgroundColor = UIColor.colorWithRedGreenBlueAlpha(0.1, 0.36, 0.72, 1);
    controller.mainNavigationIndicator = indicator; navigation.addSubview(indicator);
    controller.importButton.hidden = true;
    controller.importButton.enabled = false;
    controller.mainNavigationButtons = [controller.homeButton, controller.os408Button, controller.settingsButton];
    controller.mainNavigationButtons.forEach(function (view) {
      view.backgroundColor = UIColor.colorWithWhiteAlpha(1, 0);
      view.titleLabel.font = UIFont.boldSystemFontOfSize(14);
      navigation.addSubview(view);
    });
    controller.closeButton.backgroundColor = UIColor.colorWithWhiteAlpha(1, 0);
    controller.titleBar.addSubview(controller.closeButton);
  }
  function refresh(controller, animated) {
    const indicator = controller.mainNavigationIndicator;
    if (!indicator) return;
    const active = controller.activePage === 'category-manager' ? 'settings' : controller.activePage;
    const index = Math.max(0, ['math', '408', 'settings'].indexOf(active));
    const slotWidth = Math.max(0, (controller.mainNavigation.bounds.width - 8) / controller.mainNavigationButtons.length);
    const width = Math.min(24, Math.max(0, slotWidth - 16));
    const height = controller.mainNavigation.bounds.height;
    const target = { x: 4 + index * slotWidth + (slotWidth - width) / 2, y: Math.max(0, height - 6), width, height: 3 };
    controller.mainNavigationButtons.forEach(function (view, position) {
      view.selected = index === position;
      view.setTitleColorForState(view.selected ? UIColor.colorWithRedGreenBlueAlpha(0.1, 0.36, 0.72, 1) : UIColor.darkGrayColor(), 0);
    });
    const previous = indicator.frame;
    if (previous.x === target.x && previous.y === target.y && previous.width === target.width && previous.height === target.height) return;
    let from = previous.x + previous.width / 2;
    if (animated && typeof indicator.layer.presentationLayer === 'function') {
      try {
        const presentation = indicator.layer.presentationLayer();
        if (presentation && presentation.position && Number.isFinite(Number(presentation.position.x))) from = Number(presentation.position.x);
      } catch (_) { /* 无法读取呈现层时沿用上次布局位置。 */ }
    }
    indicator.frame = target; indicator.layer.cornerRadius = target.height / 2;
    stop(controller);
    if (!animated || !previous.width || typeof indicator.layer.addAnimationForKey !== 'function'
        || typeof CABasicAnimation === 'undefined' || typeof CABasicAnimation.animationWithKeyPath !== 'function'
        || typeof CAMediaTimingFunction === 'undefined' || typeof CAMediaTimingFunction.functionWithControlPoints !== 'function'
        || typeof CATransaction === 'undefined' || typeof CATransaction.begin !== 'function'
        || typeof CATransaction.commit !== 'function' || typeof CATransaction.setAnimationDuration !== 'function') return;
    try {
      const animation = CABasicAnimation.animationWithKeyPath('position.x');
      if (!animation) return;
      animation.fromValue = from; animation.toValue = target.x + target.width / 2;
      animation.timingFunction = CAMediaTimingFunction.functionWithControlPoints(0.32, 0.72, 0, 1);
      CATransaction.begin();
      try { CATransaction.setAnimationDuration(0.22); indicator.layer.addAnimationForKey(animation, ANIMATION); }
      finally { CATransaction.commit(); }
    } catch (error) { console.log('[Daguanyuan Bridge] 主导航动画未启用：' + String(error.message || error)); }
  }
  function layout(controller) {
    const bounds = controller.titleBar.bounds, width = Math.min(82 * controller.mainNavigationButtons.length, Math.max(0, bounds.width - 112));
    const x = (bounds.width - width) / 2, height = bounds.height;
    controller.mainNavigation.frame = { x, y: 0, width, height };
    controller.mainNavigationButtons.forEach(function (view, index) { view.frame = { x: 4 + index * (width - 8) / controller.mainNavigationButtons.length, y: 0, width: Math.max(0, (width - 8) / controller.mainNavigationButtons.length), height }; });
    controller.closeButton.frame = { x: Math.max(0, bounds.width - 48), y: 0, width: 44, height };
    controller.titleBarDragRegions[0].frame = { x: 0, y: 0, width: x, height };
    controller.titleBarDragRegions[1].frame = { x: x + width, y: 0, width: Math.max(0, controller.closeButton.frame.x - x - width), height };
    refresh(controller, false);
  }
  function isBlankPoint(controller, point) {
    if (!point) return false;
    return controller.titleBarDragRegions.some(function (view) {
      const f = view.frame;
      return point.x >= f.x && point.x < f.x + f.width && point.y >= f.y && point.y < f.y + f.height;
    });
  }
  return { setup, layout, refresh, stop, isBlankPoint };
})();
