JSB.require("DaguanyuanPageCollector");
JSB.require("DaguanyuanStorage");
JSB.require("DaguanyuanSelection");
JSB.require("DaguanyuanRetest");
JSB.require("DaguanyuanFocusNextCore");
JSB.require("DaguanyuanFocusNextUI");
JSB.require("WebBridgeCommands");
JSB.require("WebPanelController");
JSB.require("WebAddon");

JSB.newAddon = function () {
  return createDaguanyuanBridgeAddon();
};
