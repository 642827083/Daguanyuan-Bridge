var __DAGUANYUAN_IMPORT_REPORT_GLOBAL__ = (function () {
  function safeText(value) {
    return String(value == null ? "" : value)
      .replace(/data:image\/[^\s)]+/gi, "[图片数据已省略]")
      .replace(/https?:\/\/[^\s<>"']+/gi, function (url) { return url.split(/[?#]/)[0]; });
  }

  function textFor(result) {
    const lines = [`导入结果：新建 ${result.createdCount || 0} 道，补答案 ${result.answerAddedCount || 0} 道，跳过 ${result.skippedCount || 0} 道，失败 ${(result.failed || []).length} 道`];
    if (result.interrupted) lines.push(`导入中断：${safeText(result.interrupted)}`);
    (result.commentFoldWarnings || []).forEach(function (warning) {
      lines.push('题卡已保存，原题评论未折叠：' + safeText(warning.reason));
    });
    (result.failed || []).forEach(function (failure, index) {
      lines.push("", `${index + 1}. ${safeText(failure.source || "题目 ID " + failure.questionId)}`,
        `题目 ID：${failure.questionId}`, `失败阶段：${safeText(failure.stage || "题目处理")}`,
        `失败原因：${safeText(failure.reason || "未返回错误信息")}`);
      const details = failure.diagnostics || {};
      const names = { imageKind: "图片类型", imageCount: "图片数量", base64Chars: "图片数据字符数",
        width: "图片宽度", height: "图片高度", nestedImages: "内嵌图片数量", foreignObjects: "HTML 图形块数量",
        processorAvailable: "图片保存接口可用", processorResult: "图片保存接口返回值",
        remainingImages: "保存后未转换图片数", mediaChanged: "媒体列表发生变化" };
      Object.keys(names).forEach(function (key) {
        if (details[key] != null) lines.push(`${names[key]}：${safeText(details[key])}`);
      });
    });
    if ((result.failed || []).length) lines.push("", "再次导入会跳过已有题目，缺少答案子卡时可补建答案，并重试失败题目。补答案失败保留原题内容。", "可点击“复制详情”反馈上述信息。");
    return lines.join("\n");
  }

  function button(title, controller, selector) {
    const view = new UIButton({ x: 0, y: 0, width: 90, height: 34 });
    view.setTitleForState(title, 0);
    view.setTitleColorForState(UIColor.colorWithRedGreenBlueAlpha(0.1, 0.36, 0.72, 1), 0);
    view.titleLabel.font = UIFont.boldSystemFontOfSize(14);
    view.addTargetActionForControlEvents(controller, selector, 1 << 0);
    return view;
  }

  function layout(controller) {
    if (!controller.importReportView) return;
    const bounds = controller.view.bounds;
    // 导入页的备用原生详情也限定在右栏，宽度与网页的筛选列断点一致。
    const filterWidth = controller.activePage === 'import' ? bounds.width <= 540 ? 185 : bounds.width <= 760 ? 230 : 300 : 0;
    controller.importReportView.frame = { x: filterWidth + 12, y: 50, width: Math.max(0, bounds.width - filterWidth - 24), height: Math.max(0, bounds.height - 62) };
    const width = controller.importReportView.frame.width;
    const height = controller.importReportView.frame.height;
    controller.importReportTitle.frame = { x: 16, y: 12, width: Math.max(0, width - 216), height: 30 };
    controller.importReportCopy.frame = { x: Math.max(16, width - 192), y: 10, width: 100, height: 34 };
    controller.importReportClose.frame = { x: Math.max(16, width - 82), y: 10, width: 66, height: 34 };
    controller.importReportText.frame = { x: 12, y: 56, width: Math.max(0, width - 24), height: Math.max(0, height - 68) };
    if (controller.importReportBodyLabel) {
      const textWidth = Math.max(1, width - 48);
      const columns = Math.max(1, Math.floor(textWidth / 16));
      const lines = controller.lastCategoryImportReportText.split("\n").reduce(function (count, line) {
        return count + Math.max(1, Math.ceil(line.length / columns));
      }, 0);
      const textHeight = lines * 24;
      controller.importReportBodyLabel.frame = { x: 12, y: 8, width: textWidth, height: textHeight };
      controller.importReportText.contentSize = { width: Math.max(0, width - 24), height: textHeight + 24 };
    }
  }

  function show(controller, result) {
    controller.lastCategoryImportReportText = textFor(result);
    if (!controller.importReportView) {
      const view = new UIView({ x: 0, y: 0, width: 100, height: 100 });
      view.backgroundColor = UIColor.whiteColor();
      view.layer.cornerRadius = 10;
      view.layer.borderWidth = 0.5;
      view.layer.borderColor = UIColor.lightGrayColor().colorWithAlphaComponent(0.6);
      controller.importReportTitle = new UILabel({ x: 0, y: 0, width: 100, height: 30 });
      controller.importReportTitle.text = "导入详情";
      controller.importReportTitle.font = UIFont.boldSystemFontOfSize(18);
      controller.importReportTitle.textColor = UIColor.darkGrayColor();
      controller.importReportCopy = button("复制详情", controller, "copyCategoryImportReport:");
      controller.importReportClose = button("关闭", controller, "closeCategoryImportReport:");
      controller.importReportBodyLabel = null;
      try {
        controller.importReportText = new UITextView({ x: 0, y: 0, width: 100, height: 100 });
        controller.importReportText.font = UIFont.systemFontOfSize(14);
        controller.importReportText.textColor = UIColor.darkGrayColor();
        controller.importReportText.editable = false;
        controller.importReportText.selectable = true;
      } catch (error) {
        // 部分宿主不支持文本视图构造，改用已有的滚动容器和多行标签。
        controller.importReportText = new UIScrollView({ x: 0, y: 0, width: 100, height: 100 });
        controller.importReportBodyLabel = new UILabel({ x: 0, y: 0, width: 100, height: 100 });
        controller.importReportBodyLabel.font = UIFont.systemFontOfSize(14);
        controller.importReportBodyLabel.textColor = UIColor.darkGrayColor();
        controller.importReportBodyLabel.numberOfLines = 0;
        controller.importReportText.addSubview(controller.importReportBodyLabel);
      }
      controller.importReportText.showsVerticalScrollIndicator = true;
      view.addSubview(controller.importReportTitle);
      view.addSubview(controller.importReportCopy);
      view.addSubview(controller.importReportClose);
      view.addSubview(controller.importReportText);
      controller.importReportView = view;
    }
    if (controller.importReportBodyLabel) controller.importReportBodyLabel.text = controller.lastCategoryImportReportText;
    else controller.importReportText.text = controller.lastCategoryImportReportText;
    controller.importReportText.contentOffset = { x: 0, y: 0 };
    controller.importReportView.hidden = false;
    // 重新添加到最上层，保证详情不被网页或设置页遮住。
    controller.containerView.addSubview(controller.importReportView);
    layout(controller);
  }

  function close(controller) {
    if (controller.importReportView) controller.importReportView.hidden = true;
  }

  function copy(controller) {
    if (!controller.lastCategoryImportReportText) return false;
    UIPasteboard.generalPasteboard().string = controller.lastCategoryImportReportText;
    return true;
  }
  return { textFor, show, layout, close, copy };
})();
