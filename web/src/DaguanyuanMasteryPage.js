(function () {
  if (window.__DAGUANYUAN_MASTERY_PAGE__) return;
  let task = null;
  let session408 = null;
  function auth(provider) {
    if (provider === '408') {
      const token = localStorage.getItem('token') || '';
      const expires = Number(localStorage.getItem('token_expire') || 0);
      return { token: token === 'mock-token' || expires && expires <= Date.now() ? '' : token, user: '' };
    }
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
  function begin(token, id, mastery, provider = 'math') {
    const loginMessage = provider === '408' ? '请先在插件 408 面板登录 408 网站' : '请先在插件数学面板登录大观园';
    if (location.protocol !== 'https:' || (provider === '408' ? location.hostname !== 'www.408os.cn'
      : provider !== 'math' || !/^(www\.)?cxyonly\.fans$/.test(location.hostname))) throw Error(loginMessage);
    if (!/^[\w-]{1,100}$/.test(token) || !Number.isSafeInteger(id) || id < 1
      || !['needs_practice', 'not_known', 'mastered'].includes(mastery)) throw Error('掌握标记参数无效');
    if (task) throw Error('正在同步掌握状态，请稍后再试');
    const identity = auth(provider);
    if (!identity.token || provider === 'math' && !identity.user) throw Error(loginMessage);
    const request = { token, id, mastery, provider, route: location.href, status: 'loading', stage: 'check_session', error: '', abort: new AbortController() };
    task = request;
    request.timer = setTimeout(() => request.abort.abort(), 25000);
    function check() {
      const current = auth(provider);
      if (task !== request || current.token !== identity.token || current.user !== identity.user || location.href !== request.route) {
        throw Error('页面或登录账号已切换，请重新标记');
      }
      if (request.abort.signal.aborted) throw Error('同步超时或已取消，请检查网站状态后重试');
    }
    request.check = check;
    async function save408() {
      check();
      // 复用网站请求模块的登录凭据、clientId 与业务错误处理，不向原生层传递凭据。
      const entry = document.querySelector('script[type="module"][src*="/assets/index-"]');
      if (!entry) throw Error('未找到 408 网站请求模块，请刷新后重试');
      const url = new URL(entry.src, location.href);
      if (url.origin !== location.origin || !/^\/assets\/index-[\w-]+\.js$/.test(url.pathname) || url.search || url.hash) throw Error('408 网站模块地址无效');
      const module = await Function('url', 'return import(url)')(url.href);
      check();
      const api = module.r, user = typeof module.u === 'function' && module.u();
      if (!api || typeof api.get !== 'function' || typeof api.post !== 'function' || !user) throw Error('408 网站请求模块已变化，请刷新后重试');
      function checkUser() {
        check();
        if (user.token !== identity.token) throw Error('408 登录账号已切换，请重新标记');
      }
      checkUser();
      if (!session408 || session408.route !== request.route || session408.identity !== identity.token) {
        session408 = { route: request.route, identity: identity.token, marked: new Set() };
      }
      const score = { mastered: 1, needs_practice: 2, not_known: 3 }[mastery];
      const options = { signal: request.abort.signal, silentError: true };
      // 与网站相同：本页面首次标记新增记录，再次标记更新本次记录。
      request.stage = 'save_408_mastery';
      const saved = await api.post('/api/zt/question-mastery/mark', { questionId: id, score, isUpdate: session408.marked.has(id) }, options);
      checkUser();
      session408.marked.add(id);
      if (!saved || !saved.id || saved.questionId !== undefined && String(saved.questionId) !== String(id)
        || saved.score !== undefined && Number(saved.score) !== score) throw Error('408 标记回执不一致，网站可能已保存，请查看原题确认');
      // 成功回执还需与重新读取的题目状态一致，避免仅凭请求完成就报告成功。
      request.stage = 'verify_408_mastery';
      const detail = await api.get('/api/zt/question/detail/' + id, options);
      checkUser();
      if (!detail || !detail.question || String(detail.question.id) !== String(id)
        || !detail.currentMastery || Number(detail.currentMastery.score) !== score) throw Error('408 掌握状态核验失败，网站可能已保存，请查看原题确认');
      request.mode = 'mastery';
      request.status = 'ready';
    }
    async function send(path, options) {
      check();
      const response = await fetch(path, { ...options, credentials: 'same-origin', redirect: 'error', cache: 'no-store', signal: request.abort.signal });
      check();
      if (!response.ok) {
        if (response.status === 401) throw Error('登录已过期，请在插件数学面板重新登录');
        if (response.status === 409) throw Error('复测计划已在其他页面更新，请查看原题后重新标记');
        throw Error('掌握状态保存失败（' + response.status + '），请重试');
      }
      const value = unwrap(await response.json());
      check();
      return value;
    }
    async function save() {
      // 使用网站当前登录身份和 CSRF 接口，凭据只留在网站 WebView 中。
      const headers = { Accept: 'application/json', Authorization: 'Bearer ' + identity.token };
      // 按题号精确查询有效复测队列，包含尚未到期的计划，不受当前页面筛选影响。
      const query = new URLSearchParams({ page: '1', per_page: '2', scope: 'complete', include_upcoming: 'true',
        filters: JSON.stringify({ match: 'all', conditions: [{ field: 'question_id', operator: 'between', value: [id, id] }] }) });
      request.stage = 'read_retest_plan';
      const queue = await send('/api/retest/queue?' + query, { method: 'GET', headers });
      if (!queue || !Array.isArray(queue.items) || queue.items.length > 1 || queue.total !== queue.items.length
        || queue.items.some(item => !item || !item.question || item.question.id !== id)) throw Error('无法确认当前题目的复测计划，请查看原题后重试');
      const schedule = queue.items.length ? queue.items[0].schedule : null;
      if (queue.items.length && (!schedule || typeof schedule.active !== 'boolean')) throw Error('复测计划格式无效，请查看原题后重试');
      const review = schedule && schedule.active;
      if (review && (!Number.isSafeInteger(schedule.revision) || schedule.revision < 0
        || !['due_today', 'overdue', 'upcoming'].includes(schedule.due_status))) throw Error('复测计划格式无效，请查看原题后重试');
      request.stage = 'read_csrf';
      const csrf = await send('/api/auth/csrf', { method: 'GET', headers });
      const csrfToken = csrf && (csrf.csrf_token || csrf.token);
      if (typeof csrfToken !== 'string' || !csrfToken) throw Error('无法验证登录状态，请重新登录后重试');
      check();
      const writeHeaders = { ...headers, 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken };
      let saved;
      if (review) {
        request.stage = 'save_retest';
        // 沿用网站复测的版本校验与幂等键；失败不再降级为普通标记，避免重复写入。
        writeHeaders['Idempotency-Key'] = 'retest-review:' + id + ':' + mastery + ':' + token;
        saved = await send('/api/retest/questions/' + id + '/review', {
          method: 'POST', headers: writeHeaders,
          body: JSON.stringify({ early: schedule.due_status === 'upcoming', mastery, expected_revision: schedule.revision })
        });
        if (!saved || !saved.review || saved.review.outcome !== mastery || !saved.user_state || saved.user_state.mastery !== mastery
          || !saved.schedule || !Number.isSafeInteger(saved.schedule.revision) || saved.schedule.revision <= schedule.revision) {
          throw Error('复测回执不一致，网站可能已保存，请查看原题确认后重试');
        }
        request.mode = 'retest';
      } else {
        request.stage = 'save_mastery';
        saved = await send('/api/questions/' + id + '/state', {
          method: 'PATCH', headers: writeHeaders, body: JSON.stringify({ mastery })
        });
        if (!saved || saved.mastery !== mastery) throw Error('网站返回的掌握状态不一致，请查看原题确认后重试');
        request.mode = 'mastery';
      }
      check();
      request.status = 'ready';
    }
    // 与网站题目状态修改共用锁，避免同一道题同时写入。
    const saveTask = provider === '408' ? save408 : save;
    const lockKey = provider === '408' ? 'daguanyuan:408:question-state:' + id : 'daguan:question-state:' + identity.user + ':' + id;
    Promise.resolve().then(() => navigator.locks ? navigator.locks.request(lockKey, saveTask) : saveTask())
      .catch(error => { request.status = 'error'; request.errorName = error && error.name || 'Error'; request.error = error && error.name === 'AbortError' ? '同步超时，网站可能已保存，请查看原题确认后重试' : String(error && error.message || error); })
      .finally(() => clearTimeout(request.timer));
    return 'ok';
  }
  function read(token) {
    if (!task || task.token !== token) throw Error('掌握标记任务已失效');
    task.check();
    return JSON.stringify({ status: task.status, error: task.error, errorName: task.errorName, stage: task.stage, id: task.id, mastery: task.mastery, mode: task.mode, provider: task.provider });
  }
  window.__DAGUANYUAN_MASTERY_PAGE__ = { begin, read, release };
})();
