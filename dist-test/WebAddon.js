function createDaguanyuanBridgeAddon() {
  return JSB.defineClass("DaguanyuanBridgeAddon : JSExtension", {
    sceneWillConnect: function () {
      self.focusNavigationEnabled = __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.enabled();
      self.__daguanyuanFocusNextRememberToken = 0;
      self.__daguanyuanFocusNextPlaceToken = 0;
      self.__daguanyuanQuestionLocatorToken = 0;
      self.panelController = __DAGUANYUAN_WEB_PANEL_GLOBAL__.createController(self);
      console.log("[Daguanyuan Bridge] 插件已初始化");
    },

    sceneDidDisconnect: function () {
      self.__daguanyuanFocusNextRememberToken += 1;
      self.__daguanyuanFocusNextPlaceToken += 1;
      self.__daguanyuanQuestionLocatorToken += 1;
      __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.remove(self);
      self.focusNavigationEnabled = false;
      if (self.panelController && self.panelController.view && self.panelController.view.superview) {
        self.panelController.view.removeFromSuperview();
      }
      self.panelController = null;
    },

    notebookWillOpen: function () {
      self.panelController.addon = self;
      self.panelController.addonWindow = self.window;
      self.__daguanyuanFocusNextLastFocus = null;
      if (self.focusNavigationEnabled !== false) __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.show(self);
      else __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.hide(self);
      if (self.focusNavigationEnabled !== false) __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.syncQuestionLocator(self);
      if (__DAGUANYUAN_WEB_PANEL_GLOBAL__.shouldRestorePanel()) {
        __DAGUANYUAN_WEB_PANEL_GLOBAL__.showPanel(self.panelController);
      }
    },

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

    toggleFocusNavigation: function (sender) {
      self.focusNavigationEnabled = __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.setEnabled(!(self.focusNavigationEnabled !== false));
      if (self.focusNavigationEnabled) __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.show(self);
      else __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.hide(self);
      if (self.focusNavigationEnabled) __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.syncQuestionLocator(self);
      __DAGUANYUAN_WEB_PANEL_GLOBAL__.refreshFocusSetting(self.panelController);
      return self.focusNavigationEnabled;
    },

    focusNext: function (sender) {
      if (self.__daguanyuanFocusNextSuppressTap) {
        self.__daguanyuanFocusNextSuppressTap = false;
        return;
      }
      try {
        const result = __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.focusNext(self);
        __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.refreshProgress(self, result.next);
        __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.refreshCategory(self, result.next);
      }
      catch (error) {
        const message = error && error.message ? error.message : String(error);
        __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.showMessage(self, message);
        console.log(`[Daguanyuan Bridge Focus Next] 切换失败：${message}`);
      }
    },

    focusPrevious: function (sender) {
      if (self.__daguanyuanFocusNextSuppressTap) {
        self.__daguanyuanFocusNextSuppressTap = false;
        return;
      }
      try {
        const result = __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.focusPrevious(self);
        __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.refreshProgress(self, result.next);
        __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.refreshCategory(self, result.next);
      }
      catch (error) {
        const message = error && error.message ? error.message : String(error);
        __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.showMessage(self, message);
        console.log(`[Daguanyuan Bridge Focus Next] 切换失败：${message}`);
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
            `${reason}，请进入正确分类后点击“绑定当前分类”`
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
        const context = __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.currentQuestionContext(self);
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
            `${reason}，请进入正确分类后点击“绑定当前分类”`
          );
          return;
        }
        const route = __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.questionRouteFor(result, context.progress.index);
        if (!route) throw new Error("无法生成对应题目的大观园地址");
        const token = Number(self.__daguanyuanQuestionLocatorToken || 0) + 1;
        self.__daguanyuanQuestionLocatorToken = token;
        __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.showMessage(self, `正在读取第 ${route.questionNumber} 题`);
        __DAGUANYUAN_QUESTION_RESOLVER_GLOBAL__.resolve(route, function (resolveError, resolvedRoute) {
          if (token !== self.__daguanyuanQuestionLocatorToken) return;
          if (resolveError) {
            const message = resolveError && resolveError.message ? resolveError.message : String(resolveError);
            __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.showMessage(self, message);
            console.log(`[Daguanyuan Bridge Question Locator] 读取题目失败：${message}`);
            return;
          }
          __DAGUANYUAN_WEB_PANEL_GLOBAL__.openDaguanyuanQuestion(self.panelController, resolvedRoute);
        });
      }
      catch (error) {
        const message = error && error.message ? error.message : String(error);
        __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.showMessage(self, message);
        console.log(`[Daguanyuan Bridge Question Locator] 定位失败：${message}`);
      }
    },

    handleFocusNextButtonPan: function (recognizer) {
      __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.handleNextPan(self, recognizer);
    },

    handleFocusPreviousButtonPan: function (recognizer) {
      __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.handlePreviousPan(self, recognizer);
    },

    handleFocusCategoryButtonPan: function (recognizer) {
      __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.handleCategoryPan(self, recognizer);
    },

    handleQuestionLocatorButtonPan: function (recognizer) {
      __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.handleQuestionLocatorPan(self, recognizer);
    },

  });
}
