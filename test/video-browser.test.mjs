import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../src/DaguanyuanVideoBrowser.js", import.meta.url), "utf8");
const panelSource = readFileSync(new URL("../src/WebPanelController.js", import.meta.url), "utf8");

function nativeBrowser(mnUtil, globals = {}) {
  const context = { MNUtil: mnUtil, ...globals };
  vm.runInNewContext(source, context);
  return context.__DAGUANYUAN_VIDEO_BROWSER_GLOBAL__;
}

function browserWindow(hidden, miniMode, options = {}) {
  const events = [];
  const frame = { x: 20, y: 40, width: 419, height: 450 };
  const view = { hidden, frame: miniMode ? { x: 20, y: 40, width: 40, height: 40 } : { ...frame }, subviews: [] };
  const webview = { hidden: miniMode, evaluateJavaScript() {} };
  const controller = {
    view, webview, miniMode, isMainWindow: options.secondary !== true, lastFrame: { ...frame },
    setWebMode() {}, toMinimode() {}, openOrJump() {},
    show(beginFrame, endFrame) {
      events.push("restore");
      if (options.restoreError) throw Error("恢复失败");
      this.miniMode = false; view.hidden = false; webview.hidden = false;
      if (endFrame) { view.frame = { ...endFrame }; endFrame.x = 0; }
    },
  };
  webview.delegate = controller; view.subviews.push(webview);
  const studyView = { subviews: [view], bringSubviewToFront(target) { assert.equal(target, view); events.push("front"); } };
  const mnUtil = { studyView, postNotification(name, payload) {
    events.push({ name, payload: JSON.parse(JSON.stringify(payload)) });
    // 对照 MNBrowser 0.2.6：通知加载网址后，仅在窗口隐藏时调用展开方法。
    webview.url = payload.url;
    if (view.hidden) controller.show();
  } };
  return { events, frame, view, webview, controller, studyView, mnUtil };
}

test("视频跳转恢复最小化的 MNBrowser 主窗口，并保留原尺寸、分 P 和起播时间", () => {
  const run = browserWindow(false, true);
  const browser = nativeBrowser(run.mnUtil);
  assert.equal(browser.open("bilibili://video/BV164411o7Qo?page=80&start_progress=12000", assert.fail), true);
  assert.equal(run.controller.miniMode, false);
  assert.equal(run.webview.hidden, false);
  assert.equal(run.view.hidden, false);
  assert.deepEqual(run.view.frame, run.frame);
  assert.deepEqual(run.controller.lastFrame, run.frame);
  assert.deepEqual(run.events, ["restore", "front", { name: "openInBrowser", payload: {
    url: "https://www.bilibili.com/video/BV164411o7Qo/?p=81&t=12", desktop: true,
  } }]);
});

test("已展开和已关闭的 MNBrowser 沿用原来的通知逻辑", () => {
  for (const hidden of [false, true]) {
    const run = browserWindow(hidden, false), browser = nativeBrowser(run.mnUtil);
    assert.equal(browser.open("bilibili://video/BV164411o7Qo", assert.fail), true);
    assert.equal(run.controller.miniMode, false);
    assert.equal(run.view.hidden, false);
    assert.equal(run.events.filter(event => event === "restore").length, hidden ? 1 : 0);
    assert.deepEqual(run.view.frame, run.frame);
  }
});

test("不恢复 MNBrowser 副窗口或其他插件的最小化面板", () => {
  for (const otherPlugin of [false, true]) {
    const run = browserWindow(false, true, { secondary: !otherPlugin });
    if (otherPlugin) delete run.controller.toMinimode;
    const browser = nativeBrowser(run.mnUtil);
    assert.equal(browser.open("bilibili://video/BV164411o7Qo", assert.fail), true);
    assert.equal(run.controller.miniMode, true);
    assert.equal(run.events.length, 1);
  }
});

test("恢复最小化窗口失败时显示错误，不将跳转报告为成功", () => {
  const run = browserWindow(false, true, { restoreError: true }), browser = nativeBrowser(run.mnUtil);
  let message;
  assert.equal(browser.open("bilibili://video/BV164411o7Qo", value => { message = value; }), false);
  assert.match(message, /恢复失败/);
  assert.equal(run.events.some(event => event && event.name === "openInBrowser"), false);
});

test("只从发起跳转的活动窗口获取 MNBrowser，不展开其他窗口", () => {
  const active = browserWindow(false, true), other = browserWindow(false, true);
  const targetWindow = {}, inactiveWindow = {};
  const globals = { Application: { sharedInstance() { return {
    focusWindow: targetWindow,
    studyController(window) { assert.equal(window, targetWindow); return { view: active.studyView }; },
  }; } } };
  active.mnUtil.studyView = other.studyView;
  const browser = nativeBrowser(active.mnUtil, globals);
  assert.equal(browser.open("bilibili://video/BV164411o7Qo", assert.fail, targetWindow), true);
  assert.equal(active.controller.miniMode, false);
  assert.equal(other.controller.miniMode, true);
  active.controller.miniMode = true;
  assert.equal(browser.open("bilibili://video/BV164411o7Qo", assert.fail, inactiveWindow), true);
  assert.equal(active.controller.miniMode, true);
  assert.equal(other.controller.miniMode, true);
});

test("原窗口位置失效时提示手动展开，避免恢复为错误尺寸", () => {
  const run = browserWindow(false, true), browser = nativeBrowser(run.mnUtil);
  run.controller.lastFrame.width = 0;
  let message;
  assert.equal(browser.open("bilibili://video/BV164411o7Qo", value => { message = value; }), false);
  assert.match(message, /原窗口位置不可用/);
  assert.equal(run.controller.miniMode, true);
  assert.deepEqual(run.events, []);
});

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

function panelRuntime(provider, options = {}) {
  let methods;
  const events = [], messages = [], timers = [];
  const stored = new Map([["cn.marginnote.daguanyuan-bridge.panel-visible", true]]);
  const study = { view: { bounds: { x: 0, y: 0, width: 1024, height: 768 }, addSubview(view) { view.superview = this; } },
    refreshAddonCommands() { events.push("refresh"); } };
  const panel = { addon: { window: {} }, panelVisible: true, activePage: provider, currentContentPage: provider,
    view: { hidden: false, superview: study.view, removeFromSuperview() { events.push("hide"); this.superview = null; } },
    webView: { URL: provider === "math" ? "https://cxyonly.fans/math" : "https://www.408os.cn/exercise?year=2026",
      loadRequest() { assert.fail("恢复面板不应重新加载网页"); } }, settingsPage: {}, categoryManagerPage: {} };
  const context = {
    console, JSB: { defineClass(name, value) { methods = value; return {}; } },
    MNUtil: options.missingUtils ? undefined : { postNotification(name, payload) {
      assert.equal(panel.panelVisible, true);
      assert.equal(panel.view.hidden, false);
      if (options.notificationError) throw Error("发送失败");
      events.push({ name, payload: JSON.parse(JSON.stringify(payload)) });
    } },
    Application: { sharedInstance() { return { showHUD(message) { messages.push(message); }, studyController() { return study; } }; } },
    NSUserDefaults: { standardUserDefaults() { return {
      objectForKey(key) { return stored.get(key); }, setObjectForKey(value, key) { stored.set(key, value); },
    }; } },
    NSTimer: { scheduledTimerWithTimeInterval(interval, repeats, callback) { timers.push(callback); } },
    __DAGUANYUAN_CARD_LOCATOR_UI_GLOBAL__: { cancelMode() {} },
    self: panel,
  };
  vm.createContext(context); vm.runInContext(source, context); vm.runInContext(panelSource, context);
  return { panel, events, messages, stored, timers, browser: context.__DAGUANYUAN_VIDEO_BROWSER_GLOBAL__,
    api: context.__DAGUANYUAN_WEB_PANEL_GLOBAL__,
    send(address, webView = panel.webView) {
      return methods.webViewShouldStartLoadWithRequestNavigationType(webView, { URL: { absoluteString: address } });
    } };
}

test("数学视频链接、408 跳转播放和深链发出请求后收起，恢复保留原页面", () => {
  const url = "https://www.bilibili.com/video/BV164411o7Qo/?p=81&t=12";
  for (const entry of ["math", "408", "deep-link"]) {
    const run = panelRuntime(entry === "math" ? "math" : "408");
    const page = webPage(run.browser);
    let address;
    if (entry === "math") {
      const anchor = { tagName: "A", href: url, getAttribute() { return "_blank"; } };
      page.listeners.click({ target: anchor, preventDefault() {}, stopImmediatePropagation() {} });
      address = page.frames[0].src;
    } else if (entry === "408") {
      page.listeners.click({ target: { tagName: "BUTTON", className: "jump-btn", textContent: "跳转播放" } });
      page.window.open(url, "_blank"); address = page.frames[0].src;
    } else address = "bilibili://video/BV164411o7Qo?page=80&start_progress=12000";
    const originalURL = run.panel.webView.URL, originalWebView = run.panel.webView;
    assert.equal(run.send(address), false);
    assert.deepEqual(run.events, [{ name: "openInBrowser", payload: { url, desktop: true } }, "hide"]);
    assert.equal(run.panel.panelVisible, false); assert.equal(run.panel.view.hidden, true);
    assert.equal(run.panel.view.superview, null);
    assert.equal(run.stored.get("cn.marginnote.daguanyuan-bridge.panel-visible"), false);
    assert.equal(run.timers.length, 1); run.timers[0](); assert.equal(run.events.at(-1), "refresh");
    run.api.showPanel(run.panel);
    assert.equal(run.panel.panelVisible, true); assert.equal(run.panel.view.hidden, false);
    assert.equal(run.panel.webView, originalWebView); assert.equal(run.panel.webView.URL, originalURL);
    assert.equal(run.panel.activePage, entry === "math" ? "math" : "408");
    assert.equal(run.stored.get("cn.marginnote.daguanyuan-bridge.panel-visible"), true);
  }
});

test("视频地址无效、缺少 MN Utils 或发送失败时保持面板并显示原因", () => {
  for (const provider of ["math", "408"]) {
    for (const scenario of [
      { address: "daguanyuanbridge://open-video?url=%ZZ", reason: /视频地址无效/ },
      { missingUtils: true, reason: /安装并启用 MN Utils 和 MN Browser/ },
      { notificationError: true, reason: /打开 MN Browser 失败：发送失败/ },
    ]) {
      const run = panelRuntime(provider, scenario);
      assert.equal(run.send(scenario.address || "bilibili://video/BV164411o7Qo"), false);
      assert.equal(run.panel.panelVisible, true); assert.equal(run.panel.view.hidden, false);
      assert.ok(run.panel.view.superview); assert.deepEqual(run.events, []);
      assert.match(run.messages.at(-1), scenario.reason); assert.equal(run.timers.length, 0);
      assert.equal(run.stored.get("cn.marginnote.daguanyuan-bridge.panel-visible"), true);
    }
  }
});

test("打开视频列表、普通网页导航和其他 WebView 不触发收起", () => {
  for (const provider of ["math", "408"]) {
    const run = panelRuntime(provider), page = webPage(run.browser);
    page.listeners.click({ target: { tagName: "BUTTON", className: "video-btn", textContent: "视频" } });
    assert.equal(page.frames.length, 0);
    assert.equal(run.send("https://www.408os.cn/exercise?year=2026"), true);
    assert.equal(run.send("bilibili://video/BV164411o7Qo", {}), true);
    assert.equal(run.panel.panelVisible, true); assert.equal(run.panel.view.hidden, false);
    assert.deepEqual(run.events, []); assert.equal(run.timers.length, 0);
  }
});

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
  assert.equal(notifications[0].payload.url, "https://www.bilibili.com/video/BV164411o7Qo/?p=81&t=12");
  assert.equal(notifications[0].payload.desktop, true);
});

test("408 跳转播放在网页使用 window.open 时发给 MN Browser", () => {
  const browser = nativeBrowser({ postNotification() {} });
  const page = webPage(browser);
  const button = { tagName: "BUTTON", className: "jump-btn", textContent: "跳转播放" };
  page.listeners.click({ target: { tagName: "SPAN", parentNode: button } });
  page.window.open("https://www.bilibili.com/video/BV164411o7Qo/?p=81&t=12", "_blank");
  assert.equal(page.frames.length, 1);
  assert.equal(browser.videoURL(page.frames[0].src), "https://www.bilibili.com/video/BV164411o7Qo/?p=81&t=12");
});

test("408 iPad 深链转换为完整桌面视频页", () => {
  const notifications = [];
  const browser = nativeBrowser({ postNotification(name, payload) { notifications.push({ name, payload }); } });
  const address = "bilibili://video/BV164411o7Qo?page=80&start_progress=12000";
  assert.equal(browser.handles(address), true);
  assert.equal(browser.open(address, () => assert.fail("unexpected error")), true);
  assert.equal(notifications[0].name, "openInBrowser");
  assert.equal(notifications[0].payload.url, "https://www.bilibili.com/video/BV164411o7Qo/?p=81&t=12");
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
  assert.equal(notifications[0].payload.url, "https://www.bilibili.com/video/BV164411o7Qo/?p=81&t=12");
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
    "https://www.bilibili.com/video/BV164411o7Qo/?p=81");
});

test("移动视频链接改为桌面页并保留小数起播时间", () => {
  const notifications = [];
  const browser = nativeBrowser({ postNotification(name, payload) { notifications.push({ name, payload }); } });
  const address = "https://m.bilibili.com/video/BV164411o7Qo?p=2&t=12.5#reply";
  assert.equal(browser.open("daguanyuanbridge://open-video?url=" + encodeURIComponent(address), assert.fail), true);
  assert.equal(notifications[0].payload.url, "https://www.bilibili.com/video/BV164411o7Qo/?p=2&t=12.5");
  assert.equal(notifications[0].payload.desktop, true);
});

test("未指定分 P 或起播时间时仍打开完整视频页", () => {
  const browser = nativeBrowser({ postNotification() {} });
  assert.equal(browser.videoURL("bilibili://video/BV164411o7Qo"), "https://www.bilibili.com/video/BV164411o7Qo/");
  assert.equal(browser.videoURL("bilibili://video/BV164411o7Qo?page=0&start_progress=0"),
    "https://www.bilibili.com/video/BV164411o7Qo/?p=1&t=0");
});

test("B 站短链保留地址且不冒充已解析的视频页", () => {
  const notifications = [];
  const browser = nativeBrowser({ postNotification(name, payload) { notifications.push({ name, payload }); } });
  const address = "https://b23.tv/example";
  assert.equal(browser.open("daguanyuanbridge://open-video?url=" + encodeURIComponent(address), assert.fail), true);
  assert.equal(notifications[0].payload.url, address);
  assert.equal(Object.hasOwn(notifications[0].payload, "desktop"), false);
});

test("MN Utils 不可用时给出可见错误", () => {
  const browser = nativeBrowser(undefined);
  let error = "";
  const result = browser.open("bilibili://video/BV164411o7Qo", (message) => { error = message; });
  assert.equal(result, false);
  assert.match(error, /MN Utils/);
});
