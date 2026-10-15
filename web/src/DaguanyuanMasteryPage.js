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
      const queue = await send('/api/retest/queue?' + query, { method: 'GET', headers });
      if (!queue || !Array.isArray(queue.items) || queue.items.length > 1 || queue.total !== queue.items.length
        || queue.items.some(item => !item || !item.question || item.question.id !== id)) throw Error('无法确认当前题目的复测计划，请查看原题后重试');
      const schedule = queue.items.length ? queue.items[0].schedule : null;
      if (queue.items.length && (!schedule || typeof schedule.active !== 'boolean')) throw Error('复测计划格式无效，请查看原题后重试');
      const review = schedule && schedule.active;
      if (review && (!Number.isSafeInteger(schedule.revision) || schedule.revision < 0
        || !['due_today', 'overdue', 'upcoming'].includes(schedule.due_status))) throw Error('复测计划格式无效，请查看原题后重试');
      const csrf = await send('/api/auth/csrf', { method: 'GET', headers });
      const csrfToken = csrf && (csrf.csrf_token || csrf.token);
      if (typeof csrfToken !== 'string' || !csrfToken) throw Error('无法验证登录状态，请重新登录后重试');
      check();
      const writeHeaders = { ...headers, 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken };
      let saved;
      if (review) {
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
    Promise.resolve().then(() => navigator.locks ? navigator.locks.request('daguan:question-state:' + identity.user + ':' + id, save) : save())
      .catch(error => { request.status = 'error'; request.error = error.name === 'AbortError' ? '同步超时，网站可能已保存，请查看原题确认后重试' : String(error.message || error); })
      .finally(() => clearTimeout(request.timer));
    return 'ok';
  }
  function read(token) {
    if (!task || task.token !== token) throw Error('掌握标记任务已失效');
    task.check();
    return JSON.stringify({ status: task.status, error: task.error, id: task.id, mastery: task.mastery, mode: task.mode });
  }
  window.__DAGUANYUAN_MASTERY_PAGE__ = { begin, read, release };
})();
