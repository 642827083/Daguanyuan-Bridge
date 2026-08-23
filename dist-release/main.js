JSB.require("DaguanyuanPageCollector");
JSB.require("DaguanyuanImport");
JSB.require("DaguanyuanSelection");
JSB.require("DaguanyuanRetest");
JSB.require("WebBridgeCommands");
JSB.require("WebPanelController");
JSB.require("WebAddon");

JSB.newAddon = function () {
  return createDaguanyuanBridgeAddon();
};
