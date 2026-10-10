(function () {
  if (window.__DAGUANYUAN_MASTERY_PAGE__) return;
  let task = null;
  function auth() {
    let user;
    try { user = JSON.parse(localStorage.getItem('daguan_user') || 'null'); } catch (_) {}
    return { token: localStorage.getItem('daguan_token') || localStorage.getItem('token') || '', user: String(user && user.id || '') };
  }
  function unwrap(value) {
    if (value && ['code', 'message', 'data'].every(key => Object.prototype.hasOwnProperty.call(value, key))) {
      if (Number(value.code) !== 0) throw Error('网站未保存掌握状态，请重试');
      return value.data;
    }
    return value;
  }
  function release(token) {
    if (!task || task.token !== token) return 'ok';
    task.abort.abort(); clearTimeout(task.timer); task = null; return 'ok';
  }
  function begin(token, id, mastery) {
    if (location.protocol !== 'https:' || !/^(www\.)?cxyonly\.fans$/.test(location.hostname)) throw Error('请先在插件数学面板登录大观园');
    if (!/^[\w-]{1,100}$/.test(token) || !Number.isSafeInteger(id) || id < 1
      || !['needs_practice', 'not_known', 'mastered'].includes(mastery)) throw Error('掌握标记参数无效');
    if (task) throw Error('正在同步掌握状态，请稍后再试');
    const identity = auth();
    if (!identity.token || !identity.user) throw Error('请先在插件数学面板登录大观园');
    const request = { token, id, mastery, route: location.href, status: 'loading', error: '', abort: new AbortController() };
    task = request;
    request.timer = setTimeout(() => request.abort.abort(), 25000);
    function check() {
      const current = auth();
      if (task !== request || current.token !== identity.token || current.user !== identity.user || location.href !== request.route) {
        throw Error('页面或登录账号已切换，请重新标记');
      }
      if (request.abort.signal.aborted) throw Error('同步超时或已取消，请检查网站状态后重试');
    }
    request.check = check;
    async function send(path, options) {
      check();
      const response = await fetch(path, { ...options, credentials: 'same-origin', redirect: 'error', cache: 'no-store', signal: request.abort.signal });
      check();
      if (!response.ok) {
        if (response.status === 401) throw Error('登录已过期，请在插件数学面板重新登录');
        throw Error('掌握状态保存失败（' + response.status + '），请重试');
      }
      return unwrap(await response.json());
    }
    async function save() {
      // 使用网站当前登录身份和 CSRF 接口，凭据只留在网站 WebView 中。
      const headers = { Accept: 'application/json', Authorization: 'Bearer ' + identity.token };
      const csrf = await send('/api/auth/csrf', { method: 'GET', headers });
      const csrfToken = csrf && (csrf.csrf_token || csrf.token);
      if (typeof csrfToken !== 'string' || !csrfToken) throw Error('无法验证登录状态，请重新登录后重试');
      check();
      const saved = await send('/api/questions/' + id + '/state', {
        method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ mastery })
      });
      check();
      if (!saved || saved.mastery !== mastery) throw Error('网站返回的掌握状态不一致，请查看原题确认后重试');
      request.status = 'ready';
    }
    // 与网站题目状态修改共用锁，避免同一道题同时写入。
    Promise.resolve().then(() => navigator.locks ? navigator.locks.request('daguan:question-state:' + identity.user + ':' + id, save) : save())
      .catch(error => { request.status = 'error'; request.error = error.name === 'AbortError' ? '同步超时，网站可能已保存，请查看原题确认后重试' : String(error.message || error); })
      .finally(() => clearTimeout(request.timer));
    return 'ok';
  }
  function read(token) {
    if (!task || task.token !== token) throw Error('掌握标记任务已失效');
    task.check();
    return JSON.stringify({ status: task.status, error: task.error, id: task.id, mastery: task.mastery });
  }
  window.__DAGUANYUAN_MASTERY_PAGE__ = { begin, read, release };
})();
