JSB.require("DaguanyuanFocusNextCore");
JSB.require("DaguanyuanCategoryCatalog");
JSB.require("DaguanyuanCategoryCatalogStore");
JSB.require("DaguanyuanCategoryRoutes");
JSB.require("Daguanyuan408Routes");
JSB.require("DaguanyuanQuestionResolver");
JSB.require("DaguanyuanMathApi");
JSB.require("DaguanyuanMathImport");
JSB.require("Daguanyuan408Page");
JSB.require("Daguanyuan408Import");
JSB.require("DaguanyuanImportReport");
JSB.require("DaguanyuanRetestBridge");
JSB.require("DaguanyuanWebsiteBridge");
JSB.require("DaguanyuanNotePaste");
JSB.require("DaguanyuanVideoBrowser");
JSB.require("DaguanyuanCategoryMappingStore");
JSB.require("DaguanyuanFocusNextUI");
JSB.require("DaguanyuanCategoryManagerUI");
JSB.require("WebPanelController");
JSB.require("WebAddon");

JSB.newAddon = function () {
  return createDaguanyuanBridgeAddon();
};
