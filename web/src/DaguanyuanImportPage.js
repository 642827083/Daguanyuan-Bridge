import MNBridge from './lib/mnBridge.js';

(function () {
  if (window.__DAGUANYUAN_IMPORT_UI__) { window.__DAGUANYUAN_IMPORT_UI__.refresh(); return; }
  const state = { token: '', scope: 'all', questions: [], selected: new Set(), busy: false, route: location.href, locked: false };
  const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const el = id => document.getElementById('dgy-' + id);
  function status(message) { if (el('status')) { el('status').textContent = message; el('status').title = message; } }
  function command(name, payload) { return MNBridge.send(name, payload).catch(error => { status(error.message); throw error; }); }
  function viewport() {
    const host = el('dialog'); if (!host) return;
    const v = window.visualViewport, height = v ? v.height : window.innerHeight;
    host.style.height = height + 'px'; host.style.top = (v ? v.offsetTop : 0) + 'px';
    host.classList.toggle('is-short', height < 440);
  }
  function lock(on) {
    if (on && !state.locked) { state.overflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; state.locked = true; }
    if (!on && state.locked) { document.body.style.overflow = state.overflow || ''; state.locked = false; }
  }
  function hide() { el('dialog').hidden = true; lock(false); state.busy = false; }
  let sourceRequest = null;
  function sourceRelease(token) {
    if (sourceRequest && sourceRequest.token === token) {
      sourceRequest.abort.abort(); clearTimeout(sourceRequest.timer); sourceRequest = null;
    }
    return 'ok';
  }
  function sourceBegin(token, address) {
    if (token !== state.token || state.route !== location.href) throw Error('练题页面已切换，请重新打开选题导入');
    if (!/^https:\/\/www\.cxyonly\.fans\/api\/questions\?[\w.~=&%+-]+$/.test(address)) throw Error('练题接口地址无效');
    sourceRelease(token);
    const request = { token, status: 'loading', abort: new AbortController() };
    sourceRequest = request;
    request.timer = setTimeout(() => request.abort.abort(), 25000);
    // 网站登录信息仅在网页内使用，原生层只接收题目列表。
    const auth = () => { try { return window.localStorage.getItem('daguan_token') || window.localStorage.getItem('token') || ''; } catch (ignored) { return ''; } };
    const captured = auth(), headers = { Accept: 'application/json' };
    if (captured) headers.Authorization = 'Bearer ' + captured;
    window.fetch(address.replace('https://www.cxyonly.fans', ''), { headers, credentials: 'include', redirect: 'error', signal: request.abort.signal }).then(async response => {
      if (!response.ok) throw Error('题目列表读取失败（' + response.status + '）');
      const payload = await response.json();
      if (state.token !== token || state.route !== location.href || captured !== auth()) throw Error('页面或登录状态已变化，请重新打开选题导入');
      if (sourceRequest !== request) return;
      request.payload = payload; request.status = 'ready';
    }).catch(error => {
      request.status = 'error'; request.error = error.name === 'AbortError' ? '练题列表读取超时，请重试' : String(error.message || error);
    }).finally(() => clearTimeout(request.timer));
    return 'ok';
  }
  function sourceRead(token) {
    if (token !== state.token || state.route !== location.href || !sourceRequest || sourceRequest.token !== token) throw Error('题目列表读取已失效');
    return JSON.stringify({ status: sourceRequest.status, payload: sourceRequest.payload, error: sourceRequest.error });
  }
  function source() {
    const url = new URL(location.href), math = /^(www\.)?cxyonly\.fans$/.test(url.hostname)
      && /^\/math\/practice(?:\/(?:categories\/)?[1-9]\d*)?\/?$/.test(url.pathname);
    const os = url.hostname === 'www.408os.cn' && /^\/exercise\/?$/.test(url.pathname);
    const collection = os && url.searchParams.get('mode') === 'collection' && /^[1-9]\d*$/.test(url.searchParams.get('collectionId') || '');
    const category = math || os && !url.searchParams.has('mode') && !url.searchParams.has('collectionId')
      && (/^[1-9]\d*$/.test(url.searchParams.get('knowledgeId') || '') || /^\d{4}$/.test(url.searchParams.get('year') || ''));
    return { math, supported: category || collection, category, paper: os && !url.searchParams.has('knowledgeId') && !collection };
  }
  function currentPage() {
    const url = new URL(location.href);
    const provider = url.protocol === 'https:' && /^(www\.)?cxyonly\.fans$/.test(url.hostname) ? 'math'
      : url.protocol === 'https:' && url.hostname === 'www.408os.cn' ? '408' : '';
    const seen = new Set(), questions = [];
    function visible(row) {
      for (let node = row; node; node = node.parentElement) {
        if (node.hidden || node.hasAttribute('inert')) return false;
        if (typeof window.getComputedStyle === 'function') {
          const style = window.getComputedStyle(node);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
        }
      }
      return true;
    }
    const selector = provider === 'math' ? '[data-learning-question-id], article.question-document[data-question-id], [data-retest-question-id], [data-retest-schedule-question-id]' : '.question-card';
    if (provider) document.querySelectorAll(selector).forEach(row => {
      if (!visible(row) || row.closest('#dgy-dialog, #dgy-toolbar')) return;
      let id, title;
      if (provider === 'math') {
        id = Number(row.getAttribute('data-learning-question-id') || row.getAttribute('data-question-id') || row.getAttribute('data-retest-question-id') || row.getAttribute('data-retest-schedule-question-id'));
        title = row.querySelector('[data-question-source]')?.textContent.trim();
      } else {
        const year = Number((row.querySelector('.year-tag')?.textContent || '').match(/\d{4}/)?.[0]);
        const number = Number((row.querySelector('.index-tag')?.textContent || '').match(/\d+/)?.[0]);
        if (!Number.isSafeInteger(year) || year < 2009 || year > 2100 || !Number.isSafeInteger(number) || number < 1 || number > 47) return;
        id = (year - 2009) * 47 + number; title = year + '年 第' + number + '题';
      }
      if (!Number.isSafeInteger(id) || id <= 0 || seen.has(id)) return;
      seen.add(id);
      const excerpt = (row.querySelector('article.question-document') || row).cloneNode(true);
      excerpt.querySelectorAll('button, nav, script, style, [data-question-source], [data-note-workspace]').forEach(node => node.remove());
      questions.push({ id, title: (title || '题目 ' + id).slice(0, 200), summary: excerpt.textContent.replace(/\s+/g, ' ').trim().slice(0, 180) });
    });
    return { provider, url: location.href, source: provider === 'math' ? '大观园数学 / 当前页面' : '408 / 当前页面', questions };
  }
  function pageSnapshot() {
    if (!state.snapshot || state.snapshot.url !== location.href) throw Error('当前页面已切换，请重新打开选题导入');
    return JSON.stringify(state.snapshot);
  }
  function loading(token, scope) {
    state.token = token; state.scope = scope; state.content = 'question'; state.busy = false; state.done = false; state.selection = null; state.questions = []; state.selected.clear();
    el('dialog').innerHTML = '<div class="dgy-sheet dgy-state" role="dialog" aria-modal="true"><p role="status">正在读取题目…</p><button data-action="close">取消</button></div>';
    el('dialog').hidden = false; lock(true); viewport(); return 'ok';
  }
  function startPlan(plan) {
    if (plan.token !== state.token) return 'stale';
    state.plan = plan; state.questions = []; state.selected.clear(); return 'ok';
  }
  function appendQuestions(token, questions) {
    if (token !== state.token) return 'stale';
    state.questions.push.apply(state.questions, questions); return 'ok';
  }
  function render(token) {
    if (token !== state.token) return 'stale';
    const plan = state.plan;
    state.selected = new Set(state.questions.map(q => q.id));
    el('dialog').innerHTML = '<div class="dgy-sheet' + (state.scope === 'single' ? ' dgy-single' : '') + '" role="dialog" aria-modal="true" aria-labelledby="dgy-title">'
      + '<header class="dgy-header"><strong id="dgy-title">导入题目</strong><button data-action="close" aria-label="关闭导入">×</button></header>'
      + '<div class="dgy-meta"><div class="dgy-source"><span>来源</span><b title="' + escape(plan.source) + '">' + escape(plan.source) + '</b></div><div class="dgy-target"><span>目标学习集</span><b title="' + escape(plan.target) + '">' + escape(plan.target) + '</b></div>'
      + '<div class="dgy-select"><button data-action="select-all">全选</button><button data-action="select-none">清空</button></div></div>'
      + '<div class="dgy-scroll"><div class="dgy-list">' + state.questions.map((q, index) => '<div class="dgy-row"><label class="dgy-check"><input type="checkbox" id="dgy-check-' + q.id + '" data-id="' + q.id + '" aria-label="选择' + escape(q.title || '第 ' + (index + 1) + ' 题') + '"></label><div class="dgy-rowbody"><label for="dgy-check-' + q.id + '" class="dgy-rowtitle"><b>' + escape(q.title || '题目 ' + q.id) + '</b></label><div class="dgy-excerpt">' + escape(q.summary || '题干见原题') + '</div></div></div>').join('')
      + '</div><div class="dgy-result" id="dgy-result" hidden></div></div>'
      + '<footer><div class="dgy-footer-status"><span id="dgy-count" aria-live="polite"></span><span id="dgy-status" role="status" aria-live="polite"></span></div><div class="dgy-footer-actions"><div class="dgy-mode" title="已有题目跳过；题目＋答案会把网站可读取的答案与解析保存为子卡片，已有答案子卡保留。"><span>导入内容</span><div class="dgy-segments" role="group" aria-label="导入内容"><button data-action="content" data-content="question" aria-pressed="true">题目</button><button data-action="content" data-content="questionAnswer" aria-pressed="false">题目＋答案</button></div></div><button data-action="copy" id="dgy-copy" hidden>复制详情</button><button data-action="commit" id="dgy-commit" title="已有题目跳过，缺少答案子卡时补建答案">导入</button></div></footer></div>';
    count(); viewport(); return 'ok';
  }
  function count() {
    if (!el('count')) return;
    el('count').textContent = '已选 ' + state.selected.size + ' / ' + state.questions.length + ' 题';
    el('commit').disabled = state.busy || !state.selected.size;
    el('commit').textContent = state.busy ? '导入中…' : '导入 ' + state.selected.size + ' 题';
    el('dialog').querySelectorAll('input[data-id]').forEach(input => { input.checked = state.selected.has(Number(input.dataset.id)); input.closest('.dgy-row').classList.toggle('is-selected', input.checked); input.disabled = state.busy; });
    el('dialog').querySelectorAll('[data-action="select-all"],[data-action="select-none"],[data-action="content"]').forEach(button => { button.disabled = state.busy; });
    const close = el('dialog').querySelector('.dgy-header [data-action="close"]');
    if (close) close.setAttribute('aria-label', state.busy ? '停止导入' : '关闭导入');
  }
  function progress(token, value) {
    if (token !== state.token) return 'stale';
    if (state.done) return 'ok';
    state.busy = true; count();
    status((value.phase === 'fetching' ? '读取图文 ' : '已处理 ') + (value.processed || 0) + '/' + (value.total || state.selected.size) + ' 题');
    return 'ok';
  }
  function result(token, value) {
    if (token !== state.token) return 'stale';
    state.busy = false; state.done = true;
    if (!el('result')) {
      el('dialog').innerHTML = '<div class="dgy-sheet dgy-state" role="dialog"><strong>导入结果</strong><div id="dgy-result"></div><button data-action="copy">复制详情</button><button data-action="close">关闭</button></div>';
    } else { count(); el('commit').hidden = true; el('copy').hidden = false; }
    el('result').hidden = false; el('result').textContent = value.text;
    el('dialog').querySelectorAll('input,[data-action="select-all"],[data-action="select-none"],[data-action="content"]').forEach(input => { input.disabled = true; });
    el('result').scrollIntoView({ block: 'nearest' }); status(value.interrupted ? '导入已停止' : '导入完成');
    return 'ok';
  }
  function refresh() {
    const page = currentPage(), button = el('toolbar').querySelector('[data-scope="selected"]');
    el('toolbar').hidden = !page.provider;
    button.disabled = !page.questions.length;
    const bind = el('toolbar').querySelector('[data-bind-category]');
    bind.hidden = window.__DAGUANYUAN_BIND_CATEGORY_BUTTON__?.bindEnabled === false;
    bind.disabled = button.disabled;
    const hint = page.questions.length ? '导入当前页面已加载的 ' + page.questions.length + ' 道题目' : '当前页面暂无可导入题目';
    if (button.title !== hint) { button.title = hint; button.setAttribute('aria-label', '选题导入：' + hint); }
    if (state.route !== location.href) { if (state.token) MNBridge.send('cancelQuestionImport', { token: state.token, dismiss: true }).catch(() => {}); sourceRelease(state.token); hide(); state.snapshot = null; state.token = ''; state.route = location.href; }
    viewport();
  }
  const toolbar = document.createElement('div'); toolbar.id = 'dgy-toolbar'; toolbar.setAttribute('aria-label', '大观园题目导入');
  toolbar.innerHTML = '<button data-bind-category>绑定分类</button><button data-scope="selected">选题导入</button>';
  document.body.appendChild(toolbar);
  const dialog = document.createElement('div'); dialog.id = 'dgy-dialog'; dialog.hidden = true; document.body.appendChild(dialog);
  toolbar.addEventListener('click', async event => {
    const bind = event.target.closest('[data-bind-category]');
    if (bind) {
      refresh();
      if (bind.hidden || bind.disabled || state.busy || !dialog.hidden) return;
      try { await command('bindCurrentCategory'); }
      catch (error) { window.console?.log('[Daguanyuan Bridge] 绑定分类失败：' + error.message); }
      return;
    }
    const button = event.target.closest('[data-scope]'); if (!button || button.disabled || state.busy || !dialog.hidden) return;
    refresh();
    state.snapshot = currentPage();
    if (!state.snapshot.questions.length) { refresh(); return; }
    try { await command('openQuestionImport', { scope: 'selected' }); }
    catch (error) { if (dialog.hidden) { loading('error', 'single'); result('error', { text: error.message, interrupted: true }); dialog.querySelector('[data-action="copy"]').hidden = true; } }
  });
  dialog.addEventListener('change', event => { if (!state.busy && event.target.dataset.id) { const id = Number(event.target.dataset.id); if (event.target.checked) state.selected.add(id); else state.selected.delete(id); count(); } });
  dialog.addEventListener('click', async event => {
    const button = event.target.closest('[data-action]'); if (!button) return;
    const action = button.dataset.action;
    try {
      if (action === 'close') {
        if (state.token === 'error') { hide(); return; }
        if (!state.busy) { hide(); await command('cancelQuestionImport', { token: state.token, dismiss: true }); }
        else { await command('cancelQuestionImport', { token: state.token, dismiss: false }); status('正在停止导入…'); }
      }
      if (action === 'copy') { await command('copyImportResult', { token: state.token }); status('已复制导入详情'); }
      if (!state.busy && !state.done && action === 'content') {
        state.content = button.dataset.content;
        dialog.querySelectorAll('[data-action="content"]').forEach(option => option.setAttribute('aria-pressed', String(option.dataset.content === state.content)));
      }
      if (!state.busy && (action === 'select-all' || action === 'select-none')) { state.selected = new Set(action === 'select-all' ? state.questions.map(q => q.id) : []); count(); }
      if (!state.busy && action === 'commit' && state.selected.size) {
        state.selection = state.questions.filter(q => state.selected.has(q.id)).map(q => q.id);
        progress(state.token, { processed: 0, total: state.selection.length });
        try { await command('commitQuestionImport', { token: state.token, count: state.selection.length, content: state.content }); }
        catch (error) { state.busy = false; count(); }
      }
    } catch (error) { status(error.message); }
  });
  window.__DAGUANYUAN_IMPORT_UI__ = { loading, startPlan, appendQuestions, render, progress, result, refresh, pageSnapshot, sourceBegin, sourceRead, sourceRelease,
    hide: function (token) { if (token === state.token) hide(); return 'ok'; },
    selectionChunk: function (token, offset) { if (state.route !== location.href || token !== state.token || !state.selection) throw Error('选择已失效，请重新打开导入'); return JSON.stringify(state.selection.slice(offset, offset + 250)); } };
  let scheduled = false;
  new MutationObserver(function () { if (!scheduled) { scheduled = true; setTimeout(function () { scheduled = false; refresh(); }, 100); } }).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('popstate', refresh); window.addEventListener('resize', viewport);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', viewport);
  refresh();
})();
