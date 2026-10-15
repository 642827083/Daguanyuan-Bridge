function createDaguanyuanBridgeAddon() {
  return JSB.defineClass("DaguanyuanBridgeAddon : JSExtension", {
    sceneWillConnect: function () {
      self.__daguanyuanFocusNextRememberToken = 0;
      self.__daguanyuanFocusNextPlaceToken = 0;
      self.panelController = __DAGUANYUAN_WEB_PANEL_GLOBAL__.createController(self);
      if (typeof __DAGUANYUAN_MASTERY_UI_GLOBAL__ !== 'undefined') __DAGUANYUAN_MASTERY_UI_GLOBAL__.register(self);
      if (typeof __DAGUANYUAN_SOURCE_LINK_GLOBAL__ !== 'undefined' && !__DAGUANYUAN_SOURCE_LINK_GLOBAL__.register(self)) {
        __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.showMessage(self, '查看原题需要 MN Utils，请安装并启用最新版 MN Utils');
      }
      console.log("[Daguanyuan Bridge] 插件已初始化");
    },

    sceneDidDisconnect: function () {
      if (typeof __DAGUANYUAN_MASTERY_UI_GLOBAL__ !== 'undefined') __DAGUANYUAN_MASTERY_UI_GLOBAL__.unregister(self);
      if (typeof __DAGUANYUAN_MASTERY_SYNC_GLOBAL__ !== 'undefined') __DAGUANYUAN_MASTERY_SYNC_GLOBAL__.cancel(self);
      if (typeof __DAGUANYUAN_SOURCE_LINK_GLOBAL__ !== 'undefined') __DAGUANYUAN_SOURCE_LINK_GLOBAL__.unregister(self);
      if (typeof __DAGUANYUAN_IMPORT_WORKSPACE_GLOBAL__ !== 'undefined') __DAGUANYUAN_IMPORT_WORKSPACE_GLOBAL__.close(self.panelController);
      if (self.panelController && typeof __DAGUANYUAN_IMPORT_SELECTION_GLOBAL__ !== "undefined") __DAGUANYUAN_IMPORT_SELECTION_GLOBAL__.close(self.panelController);
      if (typeof __DAGUANYUAN_CARD_LOCATOR_GLOBAL__ !== "undefined") __DAGUANYUAN_CARD_LOCATOR_GLOBAL__.cancel(self);
      if (typeof __DAGUANYUAN_CARD_LOCATOR_UI_GLOBAL__ !== "undefined") __DAGUANYUAN_CARD_LOCATOR_UI_GLOBAL__.cancelMode(self.panelController);
      self.__daguanyuanFocusNextRememberToken += 1;
      self.__daguanyuanFocusNextPlaceToken += 1;
      __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.remove(self);
      if (self.panelController && self.panelController.view && self.panelController.view.superview) {
        self.panelController.view.removeFromSuperview();
      }
      self.panelController = null;
    },

    notebookWillOpen: function () {
      if (typeof __DAGUANYUAN_MASTERY_UI_GLOBAL__ !== 'undefined') { __DAGUANYUAN_MASTERY_UI_GLOBAL__.hide(self); __DAGUANYUAN_MASTERY_UI_GLOBAL__.register(self); }
      if (typeof __DAGUANYUAN_SOURCE_LINK_GLOBAL__ !== 'undefined') __DAGUANYUAN_SOURCE_LINK_GLOBAL__.register(self);
      self.panelController.addon = self;
      self.panelController.addonWindow = self.window;
      if (typeof __DAGUANYUAN_CARD_LOCATOR_GLOBAL__ !== "undefined") __DAGUANYUAN_CARD_LOCATOR_GLOBAL__.resume(self);
      self.__daguanyuanFocusNextLastFocus = null;
      __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.show(self);
      __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.syncQuestionLocator(self);
      if (typeof __DAGUANYUAN_WEB_PANEL_GLOBAL__.refreshRetestButtons === "function") {
        __DAGUANYUAN_WEB_PANEL_GLOBAL__.refreshRetestButtons(self.panelController);
      }
      if (__DAGUANYUAN_WEB_PANEL_GLOBAL__.shouldRestorePanel()) {
        __DAGUANYUAN_WEB_PANEL_GLOBAL__.showPanel(self.panelController);
      }
    },

    onSourceLink: function (sender) {
      try { __DAGUANYUAN_SOURCE_LINK_GLOBAL__.receive(self, sender); }
      catch (error) { __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.showMessage(self, String(error && error.message || error)); }
    },

    notebookWillClose: function () {
      __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.hide(self);
      self.__daguanyuanFocusNextLastFocus = null;
      if (typeof __DAGUANYUAN_MASTERY_UI_GLOBAL__ !== 'undefined') __DAGUANYUAN_MASTERY_UI_GLOBAL__.hide(self);
      if (typeof __DAGUANYUAN_MASTERY_SYNC_GLOBAL__ !== 'undefined') __DAGUANYUAN_MASTERY_SYNC_GLOBAL__.cancel(self);
    },

    onMasteryCard: function (sender) { __DAGUANYUAN_MASTERY_UI_GLOBAL__.show(self, sender); },
    onMasteryCardClose: function () { __DAGUANYUAN_MASTERY_UI_GLOBAL__.close(self); },
    onMasteryPress: function (sender) { __DAGUANYUAN_MASTERY_UI_GLOBAL__.press(self, sender); },
    onMasteryClick: function (sender) { __DAGUANYUAN_MASTERY_UI_GLOBAL__.click(self, sender); },

    queryAddonCommandStatus: function () {
      const checked = __DAGUANYUAN_WEB_PANEL_GLOBAL__.isPanelVisible(self.panelController);
      return {
        image: "icon.png",
        object: self,
        selector: "togglePanel:",
        checked,
      };
    },

    togglePanel: function (sender) {
      const controller = self.panelController;
      const beforeVisible = __DAGUANYUAN_WEB_PANEL_GLOBAL__.isPanelVisible(controller);

      if (beforeVisible) {
        __DAGUANYUAN_WEB_PANEL_GLOBAL__.hidePanel(self.panelController);
      } else {
        __DAGUANYUAN_WEB_PANEL_GLOBAL__.showPanel(self.panelController);
        Application.sharedInstance().studyController(self.window).refreshAddonCommands();
      }
    },

    openFocusCategory: function (sender) {
      if (self.__daguanyuanFocusCategorySuppressTap) {
        self.__daguanyuanFocusCategorySuppressTap = false;
        return;
      }
      if (!__DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.categoryJumpEnabled()) return;
      try {
        const source = __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.currentCategorySource(self);
        const binding408 = __DAGUANYUAN_CATEGORY_MAPPING_STORE_GLOBAL__.binding408ForSource(source);
        if (binding408) {
          __DAGUANYUAN_WEB_PANEL_GLOBAL__.open408Page(self.panelController, binding408.targetURL);
          return;
        }
        const binding = __DAGUANYUAN_CATEGORY_MAPPING_STORE_GLOBAL__.bindingForSource(source);
        const result = binding
          ? __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.resultForCategoryId(binding.targetCategoryId)
          : __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.resolve(source.sourcePath);
        if (result.status !== "resolved") {
          const reason = binding
            ? "已绑定的大观园分类不存在"
            : result.status === "ambiguous"
              ? "自动匹配到多个同名分类"
              : "未找到对应的大观园分类";
          __DAGUANYUAN_WEB_PANEL_GLOBAL__.prepareCategoryBinding(
            self.panelController,
            `${reason}，请进入正确分类后点击“绑定分类”`
          );
          return;
        }
        const url = __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.urlFor(result);
        if (!url) throw new Error("题型分类地址无效");
        __DAGUANYUAN_WEB_PANEL_GLOBAL__.openDaguanyuanCategory(self.panelController, url);
      }
      catch (error) {
        const message = error && error.message ? error.message : String(error);
        __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.showMessage(self, message);
        console.log(`[Daguanyuan Bridge Category] 跳转失败：${message}`);
      }
    },

    locateQuestion: function (sender) {
      if (self.__daguanyuanQuestionLocatorSuppressTap) {
        self.__daguanyuanQuestionLocatorSuppressTap = false;
        return;
      }
      try {
        const focused = __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.navigationNote(self);
        const context = __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.currentQuestionContext(self, focused);
        const source = context.source;
        const binding408 = __DAGUANYUAN_CATEGORY_MAPPING_STORE_GLOBAL__.binding408ForSource(source);
        if (binding408) {
          __DAGUANYUAN_WEB_PANEL_GLOBAL__.open408Question(self.panelController, binding408.targetURL, context.progress.index);
          return;
        }
        const binding = __DAGUANYUAN_CATEGORY_MAPPING_STORE_GLOBAL__.bindingForSource(source);
        const result = binding
          ? __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.resultForCategoryId(binding.targetCategoryId)
          : __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.resolve(source.sourcePath);
        if (result.status !== "resolved") {
          const reason = binding
            ? "已绑定的大观园分类不存在"
            : result.status === "ambiguous"
              ? "自动匹配到多个同名分类"
              : "未找到对应的大观园分类";
          __DAGUANYUAN_WEB_PANEL_GLOBAL__.prepareCategoryBinding(
            self.panelController,
            `${reason}，请进入正确分类后点击“绑定分类”`
          );
          return;
        }
        const route = __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.questionRouteFor(result, context.progress.index);
        if (!route) throw new Error("无法生成对应题目的大观园地址");
        __DAGUANYUAN_WEB_PANEL_GLOBAL__.openDaguanyuanQuestion(self.panelController, route);
      }
      catch (error) {
        const message = error && error.message ? error.message : String(error);
        __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.showMessage(self, message);
        console.log(`[Daguanyuan Bridge Question Locator] 定位失败：${message}`);
      }
    },

    handleFocusCategoryButtonPan: function (recognizer) {
      __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.handleCategoryPan(self, recognizer);
    },

    handleQuestionLocatorButtonPan: function (recognizer) {
      __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.handleQuestionLocatorPan(self, recognizer);
    },

  });
}
