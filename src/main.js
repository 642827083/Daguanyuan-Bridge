JSB.require("DaguanyuanFocusNextCore");
JSB.require("DaguanyuanCategoryCatalog");
JSB.require("DaguanyuanCategoryCatalogStore");
JSB.require("DaguanyuanCategoryRoutes");
JSB.require("DaguanyuanCategoryMappingStore");
JSB.require("DaguanyuanFocusNextUI");
JSB.require("DaguanyuanCategoryManagerUI");
JSB.require("WebPanelController");
JSB.require("WebAddon");

JSB.newAddon = function () {
  return createDaguanyuanBridgeAddon();
};
