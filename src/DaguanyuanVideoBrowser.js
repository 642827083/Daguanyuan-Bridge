var __DAGUANYUAN_VIDEO_BROWSER_GLOBAL__ = (function () {
  const ENABLED_KEY = "cn.marginnote.daguanyuan-bridge.plugin-integration.mn-browser-enabled";

  function enabled() {
    try {
      const value = NSUserDefaults.standardUserDefaults().objectForKey(ENABLED_KEY);
      if (value && typeof value.booleanValue === "function") return Boolean(value.booleanValue());
      return value === true || value === 1 || String(value).toLowerCase() === "true";
    } catch (ignored) { return false; }
  }

  function setEnabled(value) {
    NSUserDefaults.standardUserDefaults().setObjectForKey(Boolean(value), ENABLED_KEY);
    return Boolean(value);
  }

  function videoPageURL(bvid, page, start) {
    const parameters = [];
    if (page && Number(page) > 0) parameters.push("p=" + Number(page));
    if (start !== undefined && start !== null && start !== "" && Number(start) >= 0) parameters.push("t=" + Number(start));
    return "https://www.bilibili.com/video/" + bvid + "/" +
      (parameters.length ? "?" + parameters.join("&") : "");
  }

  function webVideoPageURL(address) {
    const match = String(address || "").match(/^https:\/\/(?:www\.|m\.)?bilibili\.com\/video\/(BV[0-9A-Za-z]+)\/?(?:\?([^#]*))?(?:#.*)?$/i);
    if (!match) return "";
    const query = match[2] || "";
    const page = query.match(/(?:^|&)p=(\d+)(?:&|$)/);
    const start = query.match(/(?:^|&)t=(\d+(?:\.\d+)?)(?:&|$)/);
    return videoPageURL(match[1], page && page[1], start && start[1]);
  }

  function videoURL(address) {
    const value = String(address || "").trim();
    const request = value.match(/^daguanyuanbridge:\/\/open-video\?url=([^&#]+)$/i);
    if (request) {
      let decoded;
      try { decoded = decodeURIComponent(request[1]); }
      catch (error) { return ""; }
      return /^https:\/\/[^\s]+$/i.test(decoded) ? webVideoPageURL(decoded) || decoded : "";
    }
    const bilibili = value.match(/^bilibili:\/\/video\/(BV[0-9A-Za-z]+)(?:\?([^#]*))?$/i);
    if (!bilibili) return "";
    const query = bilibili[2] || "";
    const page = query.match(/(?:^|&)page=(\d+)(?:&|$)/);
    const start = query.match(/(?:^|&)start_progress=(\d+)(?:&|$)/);
    return videoPageURL(bilibili[1], page ? Number(page[1]) + 1 : undefined,
      start ? Number(start[1]) / 1000 : undefined);
  }

  function handles(address) {
    return /^daguanyuanbridge:\/\/open-video\?/i.test(String(address || "")) ||
      /^bilibili:\/\/video\//i.test(String(address || ""));
  }

  function studyView(targetWindow) {
    if (targetWindow && typeof Application !== "undefined" && Application &&
        typeof Application.sharedInstance === "function") {
      const app = Application.sharedInstance();
      // MNBrowser 只接收活动窗口的通知，不能提前展开另一个窗口里的浏览器。
      if (app.focusWindow && app.focusWindow !== targetWindow) return null;
      if (typeof app.studyController === "function") {
        const study = app.studyController(targetWindow);
        return study && study.view;
      }
    }
    return MNUtil.studyView;
  }

  function restoreMinimizedBrowser(targetWindow) {
    const root = studyView(targetWindow);
    const panels = root && root.subviews;
    if (!panels) return;
    // 兼容 MNBrowser 0.2.6 的主窗口结构；通过网页代理核对所属面板，避免操作其他插件。
    for (let i = 0; i < panels.length; i++) {
      const panel = panels[i];
      const children = panel && panel.subviews;
      if (!children) continue;
      for (let j = 0; j < children.length; j++) {
        const webview = children[j];
        if (!webview || typeof webview.evaluateJavaScript !== "function") continue;
        const controller = webview.delegate;
        if (!controller || controller.view !== panel || controller.webview !== webview ||
            controller.isMainWindow !== true || typeof controller.toMinimode !== "function" ||
            typeof controller.openOrJump !== "function" || typeof controller.setWebMode !== "function" ||
            typeof controller.show !== "function" || controller.miniMode !== true) continue;
        const saved = controller.lastFrame;
        if (!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.y) ||
            !Number.isFinite(saved.width) || !Number.isFinite(saved.height) ||
            saved.width <= 0 || saved.height <= 0) {
          throw new Error("MN Browser 的原窗口位置不可用，请先手动展开窗口后重试");
        }
        // 展开方法会调整传入矩形，复制保存的位置，防止覆盖浏览器自己的恢复记录。
        controller.show(panel.frame, { x: saved.x, y: saved.y, width: saved.width, height: saved.height });
        if (typeof root.bringSubviewToFront === "function") root.bringSubviewToFront(panel);
        return;
      }
    }
  }

  function openInBrowser(address, reportError, targetWindow) {
    const url = videoURL(address);
    if (!url) {
      reportError("视频地址无效，未打开 MN Browser");
      return false;
    }
    if (typeof MNUtil === "undefined" || !MNUtil || typeof MNUtil.postNotification !== "function") {
      reportError("请先安装并启用 MN Utils 和 MN Browser");
      return false;
    }
    try {
      const payload = { url };
      // 完整视频页使用桌面模式，避免进入移动端或嵌入式播放器。
      if (/^https:\/\/www\.bilibili\.com\/video\/BV[0-9A-Za-z]+\//i.test(url)) payload.desktop = true;
      restoreMinimizedBrowser(targetWindow);
      MNUtil.postNotification("openInBrowser", payload);
      return true;
    } catch (error) {
      reportError("打开 MN Browser 失败：" + String(error && error.message || error));
      return false;
    }
  }

  function appVideoURL(url) {
    const match = url.match(/^https:\/\/www\.bilibili\.com\/video\/(BV[0-9A-Za-z]+)\/(?:\?([^#]*))?$/i);
    if (!match) return url;
    const query = match[2] || "", parameters = [];
    const page = query.match(/(?:^|&)p=(\d+)(?:&|$)/);
    const start = query.match(/(?:^|&)t=(\d+(?:\.\d+)?)(?:&|$)/);
    // 网站 App 深链使用从零开始的分 P 编号与毫秒起播时间。
    if (page) parameters.push("page=" + (Number(page[1]) - 1));
    if (start) parameters.push("start_progress=" + Math.round(Number(start[1]) * 1000));
    return "bilibili://video/" + match[1] + (parameters.length ? "?" + parameters.join("&") : "");
  }

  function open(address, reportError, targetWindow) {
    if (enabled()) return Promise.resolve(openInBrowser(address, reportError, targetWindow));
    const url = videoURL(address);
    if (!url) { reportError("视频地址无效，未打开视频"); return Promise.resolve(false); }
    return new Promise(function (resolve) {
      const destination = appVideoURL(url), bilibili = /^bilibili:\/\//i.test(destination);
      try {
        const app = typeof UIApplication !== "undefined" && UIApplication.sharedApplication();
        if (!app || typeof app.openURLOptionsCompletionHandler !== "function") {
          throw new Error("当前 MarginNote 版本不支持系统视频跳转");
        }
        const nativeURL = NSURL.URLWithString(destination);
        if (!nativeURL) throw new Error("视频地址无效");
        // 直接发起打开并检查回调，避免 canOpenURL 的宿主白名单限制误判 App 未安装。
        app.openURLOptionsCompletionHandler(nativeURL, {}, function (success) {
          if (!success) reportError(bilibili ? "无法打开哔哩哔哩，请确认已安装 App" : "无法打开视频链接，请重试");
          resolve(Boolean(success));
        });
      } catch (error) {
        reportError("打开视频失败：" + String(error && error.message || error));
        resolve(false);
      }
    });
  }

  function pageScript() {
    return "(" + function () {
      if (window.__DAGUANYUAN_VIDEO_BROWSER_READY__ && window.__DAGUANYUAN_VIDEO_BROWSER_READY__.version === 2) return true;
      window.__DAGUANYUAN_VIDEO_BROWSER_READY__ = { version: 2 };
      var videoClick = false;
      function isBilibiliVideo(url) {
        return /^https:\/\/(?:[a-z0-9-]+\.)*bilibili\.com\/video\/BV[0-9A-Za-z]+/i.test(String(url || "")) ||
          /^https:\/\/b23\.tv\//i.test(String(url || ""));
      }
      function sendVideo(url) {
        var value = String(url || "").trim();
        if (!/^https:\/\/[^\s]+$/i.test(value)) return false;
        var frame = document.createElement("iframe");
        frame.style.display = "none";
        frame.src = "daguanyuanbridge://open-video?url=" + encodeURIComponent(value);
        document.body.appendChild(frame);
        window.setTimeout(function () { if (frame.parentNode) frame.parentNode.removeChild(frame); }, 800);
        return true;
      }
      function openHere(url) {
        var value = String(url || "").trim();
        if (!/^https?:\/\//i.test(value)) return false;
        window.location.href = value;
        return true;
      }
      var originalOpen = window.open;
      window.open = function (url) {
        if ((videoClick || isBilibiliVideo(url)) && sendVideo(url)) return window;
        if (openHere(url)) return window;
        return originalOpen ? originalOpen.apply(window, arguments) : null;
      };
      document.addEventListener("click", function (event) {
        var target = event.target;
        var node = target;
        while (node && String(node.tagName || "").toUpperCase() !== "BUTTON") node = node.parentNode;
        if (node && String(node.className || "").includes("jump-btn") &&
          String(node.textContent || "").includes("跳转播放")) {
          videoClick = true;
          window.setTimeout(function () { videoClick = false; }, 0);
          return;
        }
        node = target;
        while (node && String(node.tagName || "").toUpperCase() !== "A") node = node.parentNode;
        if (!node) return;
        var url = node.href || node.getAttribute("href");
        // iPad 的视频标题使用同窗口移动链接，两个入口均交给原生侧按联动开关处理。
        if (isBilibiliVideo(url) && sendVideo(url)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
        if (String(node.getAttribute("target") || "").toLowerCase() === "_blank" && openHere(url)) event.preventDefault();
      }, true);
      return true;
    }.toString() + ")()";
  }

  return { handles, videoURL, open, pageScript, enabled, setEnabled };
})();
