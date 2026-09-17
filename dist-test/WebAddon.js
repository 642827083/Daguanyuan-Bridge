function createDaguanyuanBridgeAddon() {
  return JSB.defineClass("DaguanyuanBridgeAddon : JSExtension", {
    sceneWillConnect: function () {
      self.focusNavigationEnabled = __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.enabled();
      self.__daguanyuanFocusNextRememberToken = 0;
      self.__daguanyuanFocusNextPlaceToken = 0;
      self.panelController = __DAGUANYUAN_WEB_PANEL_GLOBAL__.createController(self);
      console.log("[Daguanyuan Bridge] 插件已初始化");
    },

    sceneDidDisconnect: function () {
      self.__daguanyuanFocusNextRememberToken += 1;
      self.__daguanyuanFocusNextPlaceToken += 1;
      __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.remove(self);
      self.focusNavigationEnabled = false;
      if (self.panelController && self.panelController.view && self.panelController.view.superview) {
        self.panelController.view.removeFromSuperview();
      }
      self.panelController = null;
    },

    notebookWillOpen: function (openedNotebookId) {
      self.panelController.addon = self;
      self.panelController.addonWindow = self.window;
      self.__daguanyuanFocusNextLastFocus = null;
      if (self.focusNavigationEnabled !== false) __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.show(self);
      else __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.hide(self);
      if (__DAGUANYUAN_WEB_PANEL_GLOBAL__.shouldRestorePanel()) {
        __DAGUANYUAN_WEB_PANEL_GLOBAL__.showPanel(self.panelController);
      }
      if (__DAGUANYUAN_RETEST_GLOBAL__ && typeof __DAGUANYUAN_RETEST_GLOBAL__.resumePendingNavigation === "function") {
        __DAGUANYUAN_RETEST_GLOBAL__.resumePendingNavigation(self, openedNotebookId);
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
      __DAGUANYUAN_WEB_PANEL_GLOBAL__.refreshFocusButton(self.panelController);
      return self.focusNavigationEnabled;
    },

    focusNext: function (sender) {
      if (self.__daguanyuanFocusNextSuppressTap) {
        self.__daguanyuanFocusNextSuppressTap = false;
        return;
      }
      try { __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.focusNext(self); }
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
      try { __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.focusPrevious(self); }
      catch (error) {
        const message = error && error.message ? error.message : String(error);
        __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.showMessage(self, message);
        console.log(`[Daguanyuan Bridge Focus Next] 切换失败：${message}`);
      }
    },

    handleFocusNextButtonPan: function (recognizer) {
      __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.handleNextPan(self, recognizer);
    },

    handleFocusPreviousButtonPan: function (recognizer) {
      __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.handlePreviousPan(self, recognizer);
    },
  });
}
