(function () {
  if (window.__DAGUANYUAN_MATH_CATALOG_PAGE__ && window.__DAGUANYUAN_MATH_CATALOG_PAGE__.version === 2) return;
  const entries = new Map();
  const login = '请先打开插件“数学”页并登录大观园，再返回导入页重试';
  function identity() {
    if (!/^https:\/\/(?:www\.)?cxyonly\.fans$/.test(window.location.origin)) throw Error(login);
    return String(window.localStorage.getItem('daguan_token') || window.localStorage.getItem('token') || '');
  }
  function release(token) {
    const item = entries.get(token);
    if (item) { item.abort.abort(); clearTimeout(item.timer); entries.delete(token); }
    return 'accepted';
  }
  function begin(token, scope, subject) {
    if (!/^[a-z0-9-]{1,100}$/i.test(token) || !['complete', 'core', 'exam'].includes(scope)
      || !['all', 'math_1', 'math_2', 'math_3'].includes(subject)) throw Error('分类读取参数无效');
    return beginRead(token, '/api/categories?scope=' + scope + '&exam_subject=' + subject);
  }
  function beginRead(token, path) {
    if (!/^[a-z0-9-]{1,100}$/i.test(token) || !(/^\/api\/categories\?scope=(complete|core|exam)&exam_subject=(all|math_1|math_2|math_3)$/.test(path)
      || /^\/api\/questions(?:\/[1-9]\d*|\?category_id=[1-9]\d*&include_children=false&page=[1-9]\d*&per_page=20&scope=(?:complete|core|exam)(?:&exam_subject=(?:all|math_1|math_2|math_3))?)$/.test(path))) throw Error('数学读取地址无效');
    const category = path.indexOf('/api/categories?') === 0;
    const captured = identity(), route = window.location.href;
    if (!captured) throw Error(login);
    // 新筛选代替旧筛选，旧请求的回执不能覆盖当前目录。
    if (category) Array.from(entries.keys()).forEach(key => { if (entries.get(key).category) release(key); });
    if (entries.size >= 8) throw Error('数学读取任务过多，请稍后重试');
    const item = { status: 'loading', category, data: '', error: '', abort: new AbortController() };
    entries.set(token, item);
    item.check = function () {
      if (identity() !== captured || window.location.href !== route) throw Error('数学网页或登录账号已变化，请返回导入页重新选择筛选');
    };
    item.timer = setTimeout(() => item.abort.abort(), 20000);
    (async function () {
      try {
        const response = await window.fetch(path,
          { method: 'GET', credentials: 'same-origin', redirect: 'error', cache: 'no-store', signal: item.abort.signal,
            headers: { Accept: 'application/json', Authorization: 'Bearer ' + captured } });
        item.check();
        item.httpStatus = response.status;
        if (response.status === 429 && response.headers && typeof response.headers.get === 'function') item.retryAfter = String(response.headers.get('Retry-After') || '').slice(0, 100);
        if (response.status === 401) throw Error('大观园登录已过期，请在插件“数学”页重新登录后重试');
        if (response.status === 403) throw Error('当前账号没有读取此数学数据的权限');
        if (response.status === 429) throw Error('网站访问过于频繁，请稍后再读取分类');
        if (response.status === 428) throw Error('请先在插件“数学”页完成网站访问验证');
        if (!response.ok) throw Error('数学数据读取失败（' + response.status + '）');
        const tree = await response.json();
        item.check();
        if (category && !Array.isArray(tree) || !tree || typeof tree !== 'object') throw Error('数学数据格式无效，请刷新数学网页后重试');
        const data = JSON.stringify(tree);
        if (data.length > 4 * 1024 * 1024) throw Error('数学数据超过传输上限');
        if (entries.get(token) !== item) return;
        item.data = data; item.status = 'ready';
      } catch (error) {
        if (entries.get(token) !== item) return;
        item.error = error && error.name === 'AbortError' ? '数学数据读取超时，请重试' : String(error && error.message || error);
        item.status = 'error';
      } finally { clearTimeout(item.timer); }
    })();
    return 'accepted';
  }
  function read(token) {
    const item = entries.get(token);
    if (!item) throw Error('分类读取已失效，请重试');
    item.check();
    return JSON.stringify({ status: item.status, length: item.data.length, error: item.error, httpStatus: item.httpStatus, retryAfter: item.retryAfter });
  }
  function chunk(token, offset) {
    const item = entries.get(token);
    if (!item || item.status !== 'ready' || !Number.isSafeInteger(offset) || offset < 0) throw Error('分类传输已失效');
    item.check(); return item.data.slice(offset, offset + 65536);
  }
  window.__DAGUANYUAN_MATH_CATALOG_PAGE__ = { version: 2, begin, beginRead, read, chunk, release };
})();
