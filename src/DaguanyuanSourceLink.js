var __DAGUANYUAN_SOURCE_LINK_GLOBAL__ = (function () {
  const KEY = 'daguanyuan-bridge', EVENT = 'AddonBroadcast';
  function value(object, key) {
    const item = object && object[key];
    return typeof item === 'function' ? item.call(object) : item;
  }
  function target(provider, questionId, url, year) {
    const id = Number(questionId), sourceYear = Number(year || 0);
    if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(sourceYear)
      || sourceYear !== 0 && (sourceYear < 2009 || sourceYear > 2100)) return null;
    const address = String(url || '');
    if (address.length > 8192 || /[\s<>]/.test(address)) return null;
    if (provider === 'math' ? !/^https:\/\/(?:www\.)?cxyonly\.fans\/math\/(?:practice\/(?:categories\/)?[1-9]\d*|questions\/[1-9]\d*)\/?(?:\?[^#]*)?$/.test(address)
      : provider !== '408' || !/^https:\/\/www\.408os\.cn\/exercise\?[^#]+$/.test(address)) return null;
    return { provider: provider, questionId: id, url: address, year: sourceYear, imported: true, questionNumber: 0 };
  }
  function link(provider, questionId, url, year) {
    const route = target(provider, questionId, url, year);
    if (!route) throw new Error('原题链接信息无效');
    return 'marginnote4app://addon/' + KEY + '?action=open&provider=' + route.provider
      + '&question=' + route.questionId + '&year=' + route.year + '&url=' + encodeURIComponent(route.url).replace(/[!'()*]/g, function (character) {
        return '%' + character.charCodeAt(0).toString(16).toUpperCase();
      });
  }
  function parse(message) {
    const match = /^daguanyuan-bridge\?action=open&provider=(math|408)&question=([1-9]\d*)&year=(0|\d{4})&url=([^&]+)$/.exec(String(message || ''));
    if (!match) return null;
    try { return target(match[1], match[2], decodeURIComponent(match[4]), match[3]); }
    catch (ignored) { return null; }
  }
  function fromComment(text) {
    const links = String(text || '').match(/^[ \t]*\[查看原题\]\(marginnote4app:\/\/addon\/daguanyuan-bridge\?[^\s)]+\)[ \t]*\r?$/gm) || [];
    if (links.length !== 1) return null;
    const address = links[0].trim().slice('[查看原题]('.length, -1);
    return parse(address.slice('marginnote4app://addon/'.length));
  }
  function notificationCenter() {
    if (typeof NSNotificationCenter === 'undefined' || !NSNotificationCenter || typeof NSNotificationCenter.defaultCenter !== 'function') return null;
    return NSNotificationCenter.defaultCenter();
  }
  function register(addon) {
    if (addon.__daguanyuanSourceLinkObserver) return true;
    if (typeof MNUtil !== 'undefined' && MNUtil && typeof MNUtil.addObserver === 'function' && typeof MNUtil.removeObserver === 'function') {
      MNUtil.addObserver(addon, 'onSourceLink:', EVENT);
      addon.__daguanyuanSourceLinkObserver = 'utils';
      return true;
    }
    const center = notificationCenter();
    if (!center || typeof center.addObserverSelectorName !== 'function' || typeof center.removeObserverName !== 'function') {
      console.log('[Daguanyuan Bridge] 当前 MarginNote 版本缺少插件链接通知接口');
      return false;
    }
    // MN Utils 未启用时，直接监听 MN 原生的插件链接广播。
    center.addObserverSelectorName(addon, 'onSourceLink:', EVENT);
    addon.__daguanyuanSourceLinkObserver = 'native';
    return true;
  }
  function unregister(addon) {
    const backend = addon.__daguanyuanSourceLinkObserver;
    if (!backend) return;
    if (backend === 'utils' && typeof MNUtil !== 'undefined' && MNUtil && typeof MNUtil.removeObserver === 'function') {
      MNUtil.removeObserver(addon, EVENT);
    } else {
      const center = notificationCenter();
      if (center && typeof center.removeObserverName === 'function') center.removeObserverName(addon, EVENT);
    }
    addon.__daguanyuanSourceLinkObserver = false;
  }
  function receive(addon, sender) {
    const route = parse(value(value(sender, 'userInfo'), 'message'));
    if (!route) return false;
    const application = Application.sharedInstance();
    const active = typeof MNUtil !== 'undefined' && value(MNUtil, 'currentWindow')
      || value(application, 'focusWindow') || value(application, 'window');
    // 通知会广播到所有插件窗口，只在当前操作的窗口处理。
    if (!active || active !== addon.window) return false;
    if (!addon.panelController) addon.panelController = __DAGUANYUAN_WEB_PANEL_GLOBAL__.createController(addon);
    __DAGUANYUAN_WEB_PANEL_GLOBAL__.openDaguanyuanQuestion(addon.panelController, route);
    return true;
  }
  return { link: link, parse: parse, fromComment: fromComment, register: register, unregister: unregister, receive: receive };
})();
