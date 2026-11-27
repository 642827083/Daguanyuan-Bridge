// 纯网址规则同时在 JavaScriptCore 和网站 WebView 运行，不读取登录凭据或页面内容。
var __DAGUANYUAN_MATH_SITE_GLOBAL__ = (function createMathSite() {
  var origin = 'https://math.cxyonly.fans';
  function page(value) {
    if (value && typeof value === 'object') {
      value = (value.protocol || 'https:') + '//' + value.hostname + (value.pathname || '/') + (value.search || '') + (value.hash || '');
    }
    var address = String(value || '');
    if (address.length > 20000 || /[\s<>\\]/.test(address)) return null;
    var match = /^https:\/\/((?:www\.|math\.)?cxyonly\.fans)(\/[^?#]*)?(?:\?([^#]*))?(?:#(.*))?$/i.exec(address);
    if (!match) return null;
    var host = match[1].toLowerCase(), path = match[2] || '/';
    return { origin: 'https://' + host, hostname: host, pathname: path,
      path: !/^\/math(?:\/|$)/.test(path) ? '/math' + path : path,
      query: match[3] || '', search: match[3] === undefined ? '' : '?' + match[3],
      hash: match[4] === undefined ? '' : '#' + match[4] };
  }
  function supports(value, operation) {
    var address = page(value);
    if (!address) return false;
    var path = address.path;
    var practice = /^\/math\/practice(?:\/(?:(?:categories|concepts)\/)?[1-9]\d*|\/[^/\s?#]+\/(?:all|[1-9]\d*)\/[1-9]\d*)?\/?$/;
    var question = practice.test(path) || /^\/math\/(?:questions\/[1-9]\d*|paper)\/?$/.test(path);
    if (operation === 'question') return question;
    if (operation === 'note') return question || /^\/math\/retest(?:\/(?:practice|plans))?\/?$/.test(path);
    if (operation === 'tools') return question || /^\/math\/retest(?:\/[^?#]*)?\/?$/.test(path);
    if (operation === 'binding') return /^\/math\/practice(?:\/(?:categories\/)?[1-9]\d*|\/[^/\s?#]+\/(?:all|[1-9]\d*)\/[1-9]\d*)?\/?$/.test(path);
    if (operation === 'source') return !address.hash && /^\/math\/(?:practice\/(?:categories\/)?[1-9]\d*|questions\/[1-9]\d*)\/?$/.test(path);
    if (operation === 'category') return !address.search && !address.hash && /^\/math\/practice\/(?:categories\/)?[1-9]\d*\/?$/.test(path);
    return false;
  }
  function url(path) { return origin + String(path || '/'); }
  function navigationURL(value) {
    var address = page(value);
    return address && address.hostname !== 'math.cxyonly.fans' && /^\/math(?:\/|$)/.test(address.pathname)
      ? origin + address.pathname.slice(5) + address.search + address.hash : String(value || '');
  }
  function questionURL(id, value) {
    var number = Number(id), address = value === undefined ? page(origin) : page(value);
    if (!Number.isSafeInteger(number) || number < 1 || !address) return '';
    return address.origin + (address.hostname === 'math.cxyonly.fans' ? '/questions/' : '/math/questions/') + number;
  }
  function pageScript() {
    return 'var __DAGUANYUAN_MATH_SITE_GLOBAL__ = (' + createMathSite.toString() + ')();';
  }
  return { origin: origin, page: page, supports: supports, url: url, navigationURL: navigationURL, questionURL: questionURL, pageScript: pageScript };
})();
