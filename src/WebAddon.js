function createDaguanyuanBridgeAddon() {
  return JSB.defineClass("DaguanyuanBridgeAddon : JSExtension", {
    sceneWillConnect: function () {
      self.panelController = __DAGUANYUAN_WEB_PANEL_GLOBAL__.createController(self);
      console.log("[Daguanyuan Bridge] 插件已初始化");
    },

    sceneDidDisconnect: function () {
      if (self.panelController && self.panelController.view && self.panelController.view.superview) {
        self.panelController.view.removeFromSuperview();
      }
      self.panelController = null;
    },

    notebookWillOpen: function () {
      self.panelController.addon = self;
      self.panelController.addonWindow = self.window;
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
  });
}
