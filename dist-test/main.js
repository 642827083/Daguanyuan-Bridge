JSB.require("DaguanyuanFocusNextCore");
JSB.require("DaguanyuanFocusNextUI");
JSB.require("WebPanelController");
JSB.require("WebAddon");

JSB.newAddon = function () {
  return createDaguanyuanBridgeAddon();
};
