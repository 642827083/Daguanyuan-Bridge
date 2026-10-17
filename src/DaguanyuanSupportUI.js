var __DAGUANYUAN_SUPPORT_UI_GLOBAL__ = (function () {
  function label(text, size, bold) {
    const view = new UILabel({ x: 0, y: 0, width: 100, height: 24 });
    view.text = text; view.font = bold ? UIFont.boldSystemFontOfSize(size) : UIFont.systemFontOfSize(size);
    view.textColor = UIColor.colorWithRedGreenBlueAlpha(37 / 255, 40 / 255, 48 / 255, 1);
    return view;
  }
  function close(controller) {
    const popup = controller && controller.supportProjectPopup;
    if (!popup) return;
    controller.supportProjectPopup = null;
    popup.overlay.removeFromSuperview();
  }
  function layout(controller) {
    const popup = controller && controller.supportProjectPopup;
    if (!popup) return;
    const bounds = controller.containerView.bounds;
    const titleHeight = controller.titleBar ? controller.titleBar.frame.height : 44;
    const width = Math.max(0, bounds.width), height = Math.max(0, bounds.height - titleHeight);
    const sheetWidth = Math.min(840, Math.max(0, width - 32));
    const wide = sheetWidth >= 640, padding = 24, gap = 24, headerHeight = 64, captionHeight = 36;
    const introHeight = Math.max(68, Math.ceil(String(popup.intro.text || '').length * 15 / Math.max(1, sheetWidth - padding * 2)) * 20 + 28);
    const columnWidth = Math.max(0, (sheetWidth - padding * 2 - (wide ? gap : 0)) / (wide ? 2 : 1));
    let imageWidth = Math.min(340, columnWidth);
    const desiredHeight = headerHeight + introHeight + (wide
      ? Math.max.apply(null, popup.cards.map(card => imageWidth * card.ratio)) + captionHeight
      : popup.cards.reduce((total, card) => total + imageWidth * card.ratio + captionHeight + gap, -gap)) + padding;
    const sheetHeight = Math.min(desiredHeight, Math.max(0, height - 32));
    const scrollHeight = Math.max(0, sheetHeight - headerHeight);
    // 宽窗口尽量完整展示两张图；空间不足时保留可读尺寸，通过滚动查看。
    if (wide) imageWidth = Math.min(imageWidth, Math.max(240,
      (scrollHeight - introHeight - captionHeight - padding) / Math.max.apply(null, popup.cards.map(card => card.ratio))));
    popup.overlay.frame = { x: 0, y: titleHeight, width, height };
    popup.sheet.frame = { x: (width - sheetWidth) / 2, y: (height - sheetHeight) / 2, width: sheetWidth, height: sheetHeight };
    popup.header.frame = { x: 0, y: 0, width: sheetWidth, height: headerHeight };
    popup.title.frame = { x: 22, y: 18, width: Math.max(0, sheetWidth - 86), height: 28 };
    popup.closeButton.frame = { x: Math.max(0, sheetWidth - 54), y: 10, width: 44, height: 44 };
    popup.scroll.frame = { x: 0, y: headerHeight, width: sheetWidth, height: scrollHeight };
    popup.intro.frame = { x: padding, y: 14, width: Math.max(0, sheetWidth - padding * 2), height: introHeight - 28 };
    let top = introHeight, bottom = top;
    popup.cards.forEach(function (card, index) {
      const imageHeight = imageWidth * card.ratio;
      const x = padding + (wide ? index * (columnWidth + gap) : 0) + (columnWidth - imageWidth) / 2;
      card.imageView.frame = { x, y: top, width: imageWidth, height: imageHeight };
      card.caption.frame = { x, y: top + imageHeight + 8, width: imageWidth, height: 24 };
      bottom = Math.max(bottom, top + imageHeight + captionHeight);
      if (!wide) top = bottom + gap;
    });
    const contentHeight = bottom + padding;
    popup.scroll.contentSize = { width: sheetWidth, height: contentHeight };
    const offset = popup.scroll.contentOffset;
    popup.scroll.contentOffset = { x: 0, y: Math.max(0, Math.min(Number(offset && offset.y) || 0, Math.max(0, contentHeight - scrollHeight))) };
  }
  function show(controller) {
    if (!controller || controller.activePage !== 'settings' || controller.settingsSection !== 'about' || controller.supportProjectPopup) return;
    try {
      if (typeof UIImage === 'undefined' || typeof UIImage.imageWithContentsOfFile !== 'function' || typeof UIImageView === 'undefined') {
        throw new Error('当前 MarginNote 无法显示收款码图片，请更新后重试');
      }
      const directory = String(controller.addon && controller.addon.__daguanyuanAddonPath || '').replace(/\/+$/, '');
      if (!directory) throw new Error('无法读取插件资源目录，请重新启用插件');
      const cards = [['支付宝', 'alipay.jpg'], ['微信', 'wechat.jpg']].map(function (item) {
        const image = UIImage.imageWithContentsOfFile(directory + '/support/' + item[1]);
        const size = image && (typeof image.size === 'function' ? image.size() : image.size);
        if (!size || !Number.isFinite(Number(size.width)) || !Number.isFinite(Number(size.height)) || size.width <= 0 || size.height <= 0) {
          throw new Error('收款码图片读取失败，请重新安装插件');
        }
        const imageView = new UIImageView({ x: 0, y: 0, width: 100, height: 100 }); imageView.image = image;
        const caption = label(item[0], 16, false); caption.textAlignment = 1;
        return { imageView, caption, ratio: Number(size.height) / Number(size.width) };
      });
      const popup = { cards };
      popup.overlay = new UIView({ x: 0, y: 0, width: 100, height: 100 });
      popup.overlay.backgroundColor = UIColor.colorWithWhiteAlpha(0, 0.28);
      popup.sheet = new UIView({ x: 0, y: 0, width: 100, height: 100 });
      popup.sheet.backgroundColor = UIColor.whiteColor(); popup.sheet.layer.cornerRadius = 16; popup.sheet.layer.masksToBounds = true;
      popup.sheet.layer.borderWidth = 0.5;
      popup.sheet.layer.borderColor = UIColor.colorWithRedGreenBlueAlpha(227 / 255, 231 / 255, 237 / 255, 1);
      popup.header = new UIView({ x: 0, y: 0, width: 100, height: 64 });
      popup.header.backgroundColor = UIColor.colorWithRedGreenBlueAlpha(1, 0.95, 0.96, 1);
      popup.title = label('💗 支持项目', 20, true);
      popup.title.textColor = UIColor.colorWithRedGreenBlueAlpha(0.58, 0.12, 0.16, 1);
      popup.closeButton = new UIButton({ x: 0, y: 0, width: 44, height: 44 });
      popup.closeButton.setTitleForState('×', 0); popup.closeButton.titleLabel.font = UIFont.systemFontOfSize(26);
      popup.closeButton.setTitleColorForState(UIColor.colorWithRedGreenBlueAlpha(37 / 255, 40 / 255, 48 / 255, 1), 0);
      popup.closeButton.addTargetActionForControlEvents(controller, 'closeSupportProject:', 1 << 6);
      popup.scroll = new UIScrollView({ x: 0, y: 64, width: 100, height: 100 }); popup.scroll.showsVerticalScrollIndicator = true;
      popup.intro = label('插件功能全部免费，任意打赏，感谢你的支持，让插件持续更新！', 15, false);
      popup.intro.textColor = UIColor.colorWithRedGreenBlueAlpha(122 / 255, 129 / 255, 139 / 255, 1);
      popup.intro.textAlignment = 1; popup.intro.numberOfLines = 0;
      popup.scroll.addSubview(popup.intro);
      cards.forEach(function (card) { popup.scroll.addSubview(card.imageView); popup.scroll.addSubview(card.caption); });
      popup.header.addSubview(popup.title); popup.header.addSubview(popup.closeButton);
      popup.sheet.addSubview(popup.header); popup.sheet.addSubview(popup.scroll); popup.overlay.addSubview(popup.sheet);
      controller.supportProjectPopup = popup;
      layout(controller);
      controller.containerView.addSubview(popup.overlay);
    } catch (error) {
      close(controller);
      Application.sharedInstance().showHUD(String(error.message || error), controller.addon && controller.addon.window, 3);
    }
  }
  return { show, layout, close };
})();
