var __DAGUANYUAN_CATEGORY_MANAGER_UI_GLOBAL__ = (function () {
  const ACCENT_COLOR = UIColor.colorWithRedGreenBlueAlpha(0.1, 0.36, 0.72, 1);
  const DANGER_COLOR = UIColor.colorWithRedGreenBlueAlpha(0.72, 0.15, 0.12, 1);
  const PAGE_MARGIN = 20;
  const ROW_HEIGHT = 118;
  const BINDINGS_HEADER_HEIGHT = 70;
  const BINDINGS_FOOTER_HEIGHT = 54;

  function button(title, controller, selector) {
    const result = new UIButton({ x: 0, y: 0, width: 80, height: 34 });
    result.setTitleForState(title, 0);
    result.setTitleColorForState(ACCENT_COLOR, 0);
    result.titleLabel.font = UIFont.boldSystemFontOfSize(14);
    result.addTargetActionForControlEvents(controller, selector, 1 << 0);
    return result;
  }

  function label(text, font, color) {
    const result = new UILabel({ x: 0, y: 0, width: 100, height: 24 });
    result.text = text;
    result.font = font;
    result.textColor = color;
    return result;
  }

  function card() {
    const result = new UIView({ x: 0, y: 0, width: 100, height: 100 });
    result.backgroundColor = UIColor.whiteColor();
    result.layer.cornerRadius = 12;
    result.layer.borderWidth = 1;
    result.layer.borderColor = UIColor.colorWithRedGreenBlueAlpha(227 / 255, 231 / 255, 237 / 255, 1);
    result.layer.masksToBounds = true;
    return result;
  }

  function divider() {
    const result = new UIView({ x: 0, y: 0, width: 100, height: 1 });
    result.backgroundColor = UIColor.colorWithRedGreenBlueAlpha(227 / 255, 231 / 255, 237 / 255, 1);
    return result;
  }

  function setup(controller) {
    controller.categoryManagerPage = new UIView({ x: 0, y: 44, width: 960, height: 636 });
    controller.categoryManagerPage.backgroundColor = UIColor.colorWithRedGreenBlueAlpha(247 / 255, 248 / 255, 250 / 255, 1);
    controller.categoryManagerPage.hidden = true;
    controller.containerView.addSubview(controller.categoryManagerPage);

    controller.categoryManagerBackButton = button("‹ 设置", controller, "closeCategoryManager:");
    controller.categoryManagerBackButton.titleLabel.font = UIFont.systemFontOfSize(15);
    controller.categoryManagerPage.addSubview(controller.categoryManagerBackButton);

    controller.categoryManagerPageTitle = label("题型分类管理", UIFont.boldSystemFontOfSize(18), UIColor.colorWithRedGreenBlueAlpha(37 / 255, 40 / 255, 48 / 255, 1));
    controller.categoryManagerPageTitle.textAlignment = 1;
    controller.categoryManagerPage.addSubview(controller.categoryManagerPageTitle);

    controller.categoryManagerContentScroll = new UIScrollView({ x: 0, y: 52, width: 960, height: 590 });
    controller.categoryManagerContentScroll.backgroundColor = UIColor.colorWithWhiteAlpha(1, 0);
    controller.categoryManagerContentScroll.showsVerticalScrollIndicator = true;
    controller.categoryManagerContentScroll.alwaysBounceVertical = true;
    controller.categoryManagerPage.addSubview(controller.categoryManagerContentScroll);

    controller.categoryCatalogCard = card();
    controller.categoryManagerContentScroll.addSubview(controller.categoryCatalogCard);

    controller.categoryCatalogTitle = label("分类数据", UIFont.boldSystemFontOfSize(17), UIColor.colorWithRedGreenBlueAlpha(37 / 255, 40 / 255, 48 / 255, 1));
    controller.categoryCatalogCard.addSubview(controller.categoryCatalogTitle);

    controller.categoryCatalogStatus = label("", UIFont.systemFontOfSize(13), UIColor.colorWithRedGreenBlueAlpha(122 / 255, 129 / 255, 139 / 255, 1));
    controller.categoryCatalogStatus.numberOfLines = 2;
    controller.categoryCatalogCard.addSubview(controller.categoryCatalogStatus);

    controller.categoryCatalogUpdateButton = button("立即更新", controller, "updateCategoryCatalog:");
    controller.categoryCatalogUpdateButton.backgroundColor = UIColor.colorWithRedGreenBlueAlpha(238 / 255, 244 / 255, 252 / 255, 1);
    controller.categoryCatalogUpdateButton.layer.cornerRadius = 8;
    controller.categoryCatalogCard.addSubview(controller.categoryCatalogUpdateButton);

    controller.categoryBindingsCard = card();
    controller.categoryManagerContentScroll.addSubview(controller.categoryBindingsCard);

    controller.categoryBindingsTitle = label("人工绑定（0）", UIFont.boldSystemFontOfSize(17), UIColor.colorWithRedGreenBlueAlpha(37 / 255, 40 / 255, 48 / 255, 1));
    controller.categoryBindingsCard.addSubview(controller.categoryBindingsTitle);

    controller.categoryBindingsDescription = label("在数学或 408 页进入目标分类后创建绑定", UIFont.systemFontOfSize(12), UIColor.colorWithRedGreenBlueAlpha(122 / 255, 129 / 255, 139 / 255, 1));
    controller.categoryBindingsCard.addSubview(controller.categoryBindingsDescription);

    controller.categoryBindingsHeaderDivider = divider();
    controller.categoryBindingsCard.addSubview(controller.categoryBindingsHeaderDivider);

    controller.categoryBindingsEmpty = label("尚未建立人工绑定", UIFont.systemFontOfSize(14), UIColor.colorWithRedGreenBlueAlpha(122 / 255, 129 / 255, 139 / 255, 1));
    controller.categoryBindingsEmpty.textAlignment = 1;
    controller.categoryBindingsCard.addSubview(controller.categoryBindingsEmpty);

    controller.categoryBindingsFooterDivider = divider();
    controller.categoryBindingsCard.addSubview(controller.categoryBindingsFooterDivider);

    controller.categoryBindingsClearButton = button("清除全部绑定", controller, "clearCategoryBindings:");
    controller.categoryBindingsClearButton.setTitleColorForState(DANGER_COLOR, 0);
    controller.categoryBindingsClearButton.backgroundColor = UIColor.colorWithRedGreenBlueAlpha(1, 0.94, 0.94, 1);
    controller.categoryBindingsClearButton.layer.cornerRadius = 8;
    controller.categoryBindingsCard.addSubview(controller.categoryBindingsClearButton);

    controller.categoryManagerRows = [];
    controller.categoryManagerBindings = [];
  }

  function removeRows(controller) {
    (controller.categoryManagerRows || []).forEach(function (row) {
      if (row && row.view && row.view.superview) row.view.removeFromSuperview();
    });
    controller.categoryManagerRows = [];
  }

  function buildRow(controller, binding, index) {
    const rowView = new UIView({ x: 0, y: 0, width: 100, height: ROW_HEIGHT });
    rowView.backgroundColor = UIColor.whiteColor();
    const title = label(binding.parentTitle || "未命名题型", UIFont.boldSystemFontOfSize(15), UIColor.colorWithRedGreenBlueAlpha(37 / 255, 40 / 255, 48 / 255, 1));
    const source = label((binding.sourcePath || []).join(" / ") || "未记录本地路径", UIFont.systemFontOfSize(11), UIColor.colorWithRedGreenBlueAlpha(122 / 255, 129 / 255, 139 / 255, 1));
    source.numberOfLines = 2;
    const target = binding.provider === "408"
      ? { status: "resolved", path: [] }
      : __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.resultForCategoryId(binding.targetCategoryId);
    const targetText = binding.provider === "408"
      ? `408：${binding.targetURL}`
      : target.status === "resolved"
        ? `大观园：${target.path.join(" / ")}`
        : target.status === "unavailable"
          ? `下载数学分类数据后查看（ID：${binding.targetCategoryId}）`
          : `目标分类已失效（ID：${binding.targetCategoryId}）`;
    const targetColor = target.status === "resolved" ? ACCENT_COLOR
      : target.status === "unavailable" ? UIColor.colorWithRedGreenBlueAlpha(122 / 255, 129 / 255, 139 / 255, 1) : DANGER_COLOR;
    const targetLabel = label(targetText, UIFont.systemFontOfSize(12), targetColor);
    targetLabel.numberOfLines = 2;
    const openButton = button("打开", controller, "openManagedBinding:");
    const deleteButton = button("删除", controller, "deleteManagedBinding:");
    const rowDivider = divider();
    openButton.tag = index;
    deleteButton.tag = index;
    openButton.enabled = target.status === "resolved";
    openButton.alpha = target.status === "resolved" ? 1 : 0.35;
    deleteButton.setTitleColorForState(DANGER_COLOR, 0);
    rowView.addSubview(title);
    rowView.addSubview(source);
    rowView.addSubview(targetLabel);
    rowView.addSubview(openButton);
    rowView.addSubview(deleteButton);
    rowView.addSubview(rowDivider);
    controller.categoryBindingsCard.addSubview(rowView);
    controller.categoryManagerRows.push({
      view: rowView,
      title,
      source,
      target: targetLabel,
      open: openButton,
      delete: deleteButton,
      divider: rowDivider,
    });
  }

  function refresh(controller) {
    if (!controller || !controller.categoryManagerPage) return;
    const metadata = __DAGUANYUAN_CATEGORY_CATALOG_STORE_GLOBAL__.metadata();
    controller.categoryCatalogStatus.text = metadata.size
      ? `本地更新数据\n${metadata.updatedAt || "未知日期"} · ${metadata.size} 个分类`
      : "尚未下载数学分类数据\n请先下载，再使用分类匹配与绑定";
    controller.categoryCatalogUpdateButton.setTitleForState(metadata.size ? "立即更新" : "下载分类数据", 0);
    removeRows(controller);
    controller.categoryManagerBindings = __DAGUANYUAN_CATEGORY_MAPPING_STORE_GLOBAL__.allBindings();
    controller.categoryBindingsTitle.text = `人工绑定（${controller.categoryManagerBindings.length}）`;
    controller.categoryBindingsEmpty.hidden = controller.categoryManagerBindings.length > 0;
    controller.categoryBindingsClearButton.hidden = controller.categoryManagerBindings.length === 0;
    controller.categoryBindingsFooterDivider.hidden = controller.categoryManagerBindings.length === 0;
    controller.categoryManagerBindings.forEach(function (binding, index) {
      buildRow(controller, binding, index);
    });
    layoutRows(controller);
  }

  function layoutRows(controller) {
    if (!controller || !controller.categoryBindingsCard || !controller.categoryManagerContentScroll) return;
    const cardFrame = controller.categoryBindingsCard.frame;
    const cardWidth = Math.max(0, cardFrame.width);
    const textWidth = Math.max(100, cardWidth - 202);
    const count = controller.categoryManagerRows.length;
    const rowsHeight = count * ROW_HEIGHT;
    const cardHeight = count
      ? BINDINGS_HEADER_HEIGHT + rowsHeight + BINDINGS_FOOTER_HEIGHT
      : BINDINGS_HEADER_HEIGHT + 96;
    controller.categoryBindingsCard.frame = {
      x: cardFrame.x,
      y: cardFrame.y,
      width: cardFrame.width,
      height: cardHeight,
    };
    controller.categoryBindingsTitle.frame = { x: 18, y: 12, width: Math.max(0, cardWidth - 36), height: 24 };
    controller.categoryBindingsDescription.frame = { x: 18, y: 39, width: Math.max(0, cardWidth - 36), height: 18 };
    controller.categoryBindingsHeaderDivider.frame = { x: 18, y: BINDINGS_HEADER_HEIGHT - 1, width: Math.max(0, cardWidth - 36), height: 1 };
    (controller.categoryManagerRows || []).forEach(function (row, index) {
      row.view.frame = { x: 0, y: BINDINGS_HEADER_HEIGHT + index * ROW_HEIGHT, width: cardWidth, height: ROW_HEIGHT };
      row.title.frame = { x: 18, y: 10, width: textWidth, height: 22 };
      row.source.frame = { x: 18, y: 34, width: textWidth, height: 32 };
      row.target.frame = { x: 18, y: 72, width: textWidth, height: 34 };
      row.open.frame = { x: Math.max(18, cardWidth - 166), y: 39, width: 68, height: 38 };
      row.delete.frame = { x: Math.max(90, cardWidth - 90), y: 39, width: 68, height: 38 };
      row.divider.frame = { x: 18, y: ROW_HEIGHT - 1, width: Math.max(0, cardWidth - 36), height: 1 };
    });
    controller.categoryBindingsEmpty.frame = { x: 18, y: BINDINGS_HEADER_HEIGHT + 25, width: Math.max(0, cardWidth - 36), height: 34 };
    controller.categoryBindingsFooterDivider.frame = {
      x: 18,
      y: BINDINGS_HEADER_HEIGHT + rowsHeight,
      width: Math.max(0, cardWidth - 36),
      height: 1,
    };
    controller.categoryBindingsClearButton.frame = {
      x: Math.max(18, cardWidth - 148),
      y: cardHeight - 45,
      width: 130,
      height: 34,
    };
    controller.categoryManagerContentScroll.contentSize = {
      width: controller.categoryManagerContentScroll.bounds.width,
      height: cardFrame.y + cardHeight + PAGE_MARGIN,
    };
  }

  function layout(controller, contentFrame) {
    if (!controller || !controller.categoryManagerPage) return;
    controller.categoryManagerPage.frame = contentFrame;
    const bounds = controller.categoryManagerPage.bounds;
    const width = bounds.width;
    const height = bounds.height;
    const cardWidth = Math.max(0, width - PAGE_MARGIN * 2);
    controller.categoryManagerBackButton.frame = { x: 14, y: 7, width: 82, height: 38 };
    controller.categoryManagerPageTitle.frame = { x: 110, y: 9, width: Math.max(0, width - 220), height: 34 };
    controller.categoryManagerContentScroll.frame = { x: 0, y: 52, width, height: Math.max(0, height - 52) };
    controller.categoryCatalogCard.frame = { x: PAGE_MARGIN, y: 8, width: cardWidth, height: 112 };
    controller.categoryCatalogTitle.frame = { x: 18, y: 12, width: Math.max(0, cardWidth - 150), height: 24 };
    controller.categoryCatalogStatus.frame = { x: 18, y: 44, width: Math.max(0, cardWidth - 150), height: 48 };
    controller.categoryCatalogUpdateButton.frame = { x: Math.max(18, cardWidth - 118), y: 38, width: 100, height: 38 };
    const oldBindingsFrame = controller.categoryBindingsCard.frame;
    controller.categoryBindingsCard.frame = {
      x: PAGE_MARGIN,
      y: 136,
      width: cardWidth,
      height: Math.max(166, oldBindingsFrame.height),
    };
    layoutRows(controller);
  }

  function setUpdating(controller, updating) {
    if (!controller || !controller.categoryCatalogUpdateButton) return;
    controller.categoryCatalogUpdateButton.enabled = !updating;
    controller.categoryCatalogUpdateButton.alpha = updating ? 0.55 : 1;
    const hasCatalog = __DAGUANYUAN_CATEGORY_CATALOG_STORE_GLOBAL__.metadata().size > 0;
    controller.categoryCatalogUpdateButton.setTitleForState(updating ? (hasCatalog ? "更新中…" : "下载中…") : (hasCatalog ? "立即更新" : "下载分类数据"), 0);
  }

  return { setup, layout, refresh, setUpdating };
})();
