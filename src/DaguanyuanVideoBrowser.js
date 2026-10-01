var __DAGUANYUAN_VIDEO_BROWSER_GLOBAL__ = (function () {
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

  function open(address, reportError) {
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
      MNUtil.postNotification("openInBrowser", payload);
      return true;
    } catch (error) {
      reportError("打开 MN Browser 失败：" + String(error && error.message || error));
      return false;
    }
  }

  function pageScript() {
    return "(" + function () {
      if (window.__DAGUANYUAN_VIDEO_BROWSER_READY__) return true;
      window.__DAGUANYUAN_VIDEO_BROWSER_READY__ = true;
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
        if (!node || String(node.getAttribute("target") || "").toLowerCase() !== "_blank") return;
        var url = node.href || node.getAttribute("href");
        if (isBilibiliVideo(url) && sendVideo(url)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
        if (openHere(url)) event.preventDefault();
      }, true);
      return true;
    }.toString() + ")()";
  }

  return { handles, videoURL, open, pageScript };
})();
