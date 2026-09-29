import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../src/DaguanyuanVideoBrowser.js", import.meta.url), "utf8");
const panelSource = readFileSync(new URL("../src/WebPanelController.js", import.meta.url), "utf8");

function nativeBrowser(mnUtil) {
  const context = { MNUtil: mnUtil };
  vm.runInNewContext(source, context);
  return context.__DAGUANYUAN_VIDEO_BROWSER_GLOBAL__;
}

function webPage(browser) {
  const frames = [];
  const listeners = {};
  const location = { href: "https://www.408os.cn/exercise" };
  const window = { location, setTimeout() {}, open() {} };
  const document = {
    body: { appendChild(frame) { frames.push(frame); frame.parentNode = this; } },
    createElement(tagName) {
      assert.equal(tagName, "iframe");
      return { style: {} };
    },
    addEventListener(name, callback) { listeners[name] = callback; },
  };
  vm.runInNewContext(browser.pageScript(), { window, document });
  return { frames, listeners, location, window };
}

test("数学视频链接保留分 P 和播放时间并发给 MN Browser", () => {
  const notifications = [];
  const browser = nativeBrowser({ postNotification(name, payload) { notifications.push({ name, payload }); } });
  const page = webPage(browser);
  const address = "https://www.bilibili.com/video/BV164411o7Qo/?p=81&t=12";
  const anchor = { tagName: "A", href: address, getAttribute(name) { return name === "target" ? "_blank" : null; } };
  const event = {
    target: { tagName: "SPAN", parentNode: anchor },
    preventDefault() { this.prevented = true; },
    stopImmediatePropagation() { this.stopped = true; },
  };
  page.listeners.click(event);
  assert.equal(event.prevented, true);
  assert.equal(event.stopped, true);
  assert.equal(page.frames.length, 1);
  assert.equal(page.location.href, "https://www.408os.cn/exercise");
  const bridgeAddress = page.frames[0].src;
  assert.equal(bridgeAddress, "daguanyuanbridge://open-video?url=" + encodeURIComponent(address));
  assert.equal(browser.open(bridgeAddress, () => assert.fail("unexpected error")), true);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].name, "openInBrowser");
  assert.equal(notifications[0].payload.url, "https://player.bilibili.com/player.html?bvid=BV164411o7Qo&p=81&t=12&autoplay=1");
  assert.equal(notifications[0].payload.desktop, true);
});

test("408 跳转播放在网页使用 window.open 时发给 MN Browser", () => {
  const browser = nativeBrowser({ postNotification() {} });
  const page = webPage(browser);
  const button = { tagName: "BUTTON", className: "jump-btn", textContent: "跳转播放" };
  page.listeners.click({ target: { tagName: "SPAN", parentNode: button } });
  page.window.open("https://www.bilibili.com/video/BV164411o7Qo/?p=81&t=12", "_blank");
  assert.equal(page.frames.length, 1);
  assert.equal(browser.videoURL(page.frames[0].src), "https://player.bilibili.com/player.html?bvid=BV164411o7Qo&p=81&t=12&autoplay=1");
});

test("408 iPad 深链转换为播放器链接", () => {
  const notifications = [];
  const browser = nativeBrowser({ postNotification(name, payload) { notifications.push({ name, payload }); } });
  const address = "bilibili://video/BV164411o7Qo?page=80&start_progress=12000";
  assert.equal(browser.handles(address), true);
  assert.equal(browser.open(address, () => assert.fail("unexpected error")), true);
  assert.equal(notifications[0].name, "openInBrowser");
  assert.equal(notifications[0].payload.url, "https://player.bilibili.com/player.html?bvid=BV164411o7Qo&p=81&t=12&autoplay=1");
  assert.equal(notifications[0].payload.desktop, true);
});

test("面板拦截 408 深链并交由 MN Browser 打开", () => {
  const notifications = [];
  let panelMethods;
  const context = {
    MNUtil: { postNotification(name, payload) { notifications.push({ name, payload }); } },
    JSB: { defineClass(name, methods) { panelMethods = methods; return { new() { return {}; } }; } },
    Application: { sharedInstance() { return { showHUD() {} }; } },
    console,
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  vm.runInContext(panelSource, context);
  const webView = {};
  context.self = { webView, addon: { window: {} } };
  const allowed = panelMethods.webViewShouldStartLoadWithRequestNavigationType(webView, {
    URL: { absoluteString: "bilibili://video/BV164411o7Qo?page=80&start_progress=12000" },
  });
  assert.equal(allowed, false);
  assert.equal(notifications[0].payload.url, "https://player.bilibili.com/player.html?bvid=BV164411o7Qo&p=81&t=12&autoplay=1");
  assert.equal(notifications[0].payload.desktop, true);
});

test("非 B 站视频链接保持原地址", () => {
  const notifications = [];
  const browser = nativeBrowser({ postNotification(name, payload) { notifications.push({ name, payload }); } });
  const address = "https://video.example.com/watch?id=42&t=12";
  assert.equal(browser.open("daguanyuanbridge://open-video?url=" + encodeURIComponent(address), () => assert.fail("unexpected error")), true);
  assert.equal(notifications[0].payload.url, address);
  assert.equal(Object.hasOwn(notifications[0].payload, "desktop"), false);
});

test("没有起播时间的 B 站链接不附加零秒参数", () => {
  const browser = nativeBrowser({ postNotification() {} });
  const address = "https://www.bilibili.com/video/BV164411o7Qo/?p=81";
  assert.equal(browser.videoURL("daguanyuanbridge://open-video?url=" + encodeURIComponent(address)),
    "https://player.bilibili.com/player.html?bvid=BV164411o7Qo&p=81&autoplay=1");
});

test("MN Utils 不可用时给出可见错误", () => {
  const browser = nativeBrowser(undefined);
  let error = "";
  const result = browser.open("bilibili://video/BV164411o7Qo", (message) => { error = message; });
  assert.equal(result, false);
  assert.match(error, /MN Utils/);
});
