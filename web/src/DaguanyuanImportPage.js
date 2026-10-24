import MNBridge from './lib/mnBridge.js';

(function () {
  if (window.__DAGUANYUAN_IMPORT_UI__) { window.__DAGUANYUAN_IMPORT_UI__.refresh(); return; }
  const state = { token: '', scope: 'all', questions: [], selected: new Set(), busy: false, route: location.href, locked: false, toolsExpanded: false };
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
    const snapshot = window.__DAGUANYUAN_QUESTION_DOM__.read(), provider = snapshot.page.provider;
    const seen = new Set(), questions = [];
    snapshot.questions.forEach(({ row, id, title }) => {
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
    const category = window.__DAGUANYUAN_BIND_CATEGORY_BUTTON__, direct = el('toolbar').querySelector('[data-import-current]');
    button.hidden = category?.selectionEnabled === false;
    direct.hidden = category?.importEnabled === false;
    if (el('toolbar').hidden) state.toolsExpanded = false;
    el('toolbar').setAttribute('data-expanded', String(state.toolsExpanded));
    el('toolbar-actions').hidden = !state.toolsExpanded;
    el('toolbar').querySelector('[data-toggle-import-tools]').setAttribute('aria-expanded', String(state.toolsExpanded));
    el('toolbar').querySelectorAll('[data-navigate]').forEach(item => { item.hidden = !state.toolsExpanded; });
    const navigation = window.__DAGUANYUAN_WEBSITE_NAVIGATION__ || {};
    const navigationBusy = state.navigating || state.busy || state.directBusy || category?.importBusy || (!el('dialog').hidden && !state.done);
    el('toolbar').querySelector('[data-navigate="back"]').disabled = navigationBusy || !navigation.canGoBack;
    el('toolbar').querySelector('[data-navigate="reload"]').disabled = navigationBusy || !navigation.canReload;
    direct.disabled = button.disabled || !source().category || state.directBusy || Boolean(category?.importBusy);
    const directTitle = state.directBusy || category?.importBusy ? '导入中…' : '导入题目';
    const directLabel = direct.querySelector('.dgy-tool-label');
    if (directLabel.textContent !== directTitle) directLabel.textContent = directTitle;
    const hint = page.questions.length ? '导入当前页面已加载的 ' + page.questions.length + ' 道题目' : '当前页面暂无可导入题目';
    if (button.title !== hint) { button.title = hint; button.setAttribute('aria-label', '选题导入：' + hint); }
    if (state.route !== location.href) { if (state.token) MNBridge.send('cancelQuestionImport', { token: state.token, dismiss: true }).catch(() => {}); hide(); state.snapshot = null; state.token = ''; state.route = location.href;
      MNBridge.send('getWebsiteNavigation').then(value => { window.__DAGUANYUAN_WEBSITE_NAVIGATION__ = value; refresh(); }).catch(() => {});
    }
    viewport();
  }
  const toolbar = document.createElement('div'); toolbar.id = 'dgy-toolbar'; toolbar.setAttribute('aria-label', '大观园题目导入');
  // 图标使用 Lucide，展开后底栏分三格，收起时只保留省略号。
  const toolIcon = content => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + content + '</svg>';
  const bindIcon = toolIcon('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>');
  const importIcon = toolIcon('<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>');
  const selectionIcon = toolIcon('<path d="M13 5h8M13 12h8M13 19h8m-18-2 2 2 4-4M3 7l2 2 4-4"/>');
  const moreIcon = toolIcon('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>');
  const backIcon = toolIcon('<path d="m12 19-7-7 7-7M5 12h14"/>');
  const reloadIcon = toolIcon('<path d="M3 11a9 9 0 0 1 15.36-6.36L21 7M21 3v4h-4M21 13a9 9 0 0 1-15.36 6.36L3 17M3 21v-4h4"/>');
  toolbar.innerHTML = '<div id="dgy-toolbar-actions" hidden><button data-bind-category>' + bindIcon + '<span class="dgy-tool-label">绑定分类</span></button><button data-import-current title="导入当前分类的全部题目">' + importIcon + '<span class="dgy-tool-label">导入题目</span></button><button data-scope="selected">' + selectionIcon + '<span class="dgy-tool-label">选题导入</span></button></div><button data-toggle-import-tools aria-label="导入工具" title="展开或收起导入工具" aria-expanded="false" aria-controls="dgy-toolbar-actions">' + moreIcon + '</button>';
  const toggle = toolbar.querySelector('[data-toggle-import-tools]');
  const navigationBar = document.createElement('div'); navigationBar.id = 'dgy-toolbar-navigation'; navigationBar.setAttribute('role', 'group'); navigationBar.setAttribute('aria-label', '网页导航');
  navigationBar.innerHTML = '<button data-navigate="back" aria-label="返回上一页" title="返回上一页" disabled>' + backIcon + '</button><button data-navigate="reload" aria-label="刷新网页" title="刷新网页" disabled>' + reloadIcon + '</button>';
  navigationBar.appendChild(toggle); toolbar.appendChild(navigationBar);
  document.body.appendChild(toolbar);
  const dialog = document.createElement('div'); dialog.id = 'dgy-dialog'; dialog.hidden = true; document.body.appendChild(dialog);
  toolbar.addEventListener('click', async event => {
    const navigationButton = event.target.closest('[data-navigate]');
    if (navigationButton) {
      refresh(); if (navigationButton.hidden || navigationButton.disabled) return;
      state.navigating = true; refresh();
      try { window.__DAGUANYUAN_WEBSITE_NAVIGATION__ = await MNBridge.send('navigateWebsite', { action: navigationButton.dataset.navigate }); }
      catch (error) { window.console?.log('[Daguanyuan Bridge] 网页导航失败：' + error.message); }
      state.navigating = false; refresh(); return;
    }
    if (event.target.closest('[data-toggle-import-tools]')) {
      if (event.target.closest('[data-toggle-import-tools]').disabled) return;
      state.toolsExpanded = !state.toolsExpanded;
      refresh();
      return;
    }
    const direct = event.target.closest('[data-import-current]');
    if (direct) {
      refresh();
      if (direct.hidden || direct.disabled || state.busy || !dialog.hidden) return;
      const category = window.__DAGUANYUAN_BIND_CATEGORY_BUTTON__;
      state.directBusy = true;
      if (category) category.importBusy = true;
      direct.disabled = true; direct.querySelector('.dgy-tool-label').textContent = '导入中…';
      try { await command('importCurrentQuestions'); }
      catch (error) {
        state.directBusy = false;
        if (category) category.importBusy = false;
        refresh(); window.console?.log('[Daguanyuan Bridge] 导入题目失败：' + error.message);
      }
      return;
    }
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
    if (button.hidden || button.disabled) return;
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
  window.__DAGUANYUAN_IMPORT_UI__ = { loading, startPlan, appendQuestions, render, progress, result, refresh, pageSnapshot,
    finishDirectImport: function () { state.directBusy = false; refresh(); },
    hide: function (token) { if (token === state.token) hide(); return 'ok'; },
    selectionChunk: function (token, offset) { if (state.route !== location.href || token !== state.token || !state.selection) throw Error('选择已失效，请重新打开导入'); return JSON.stringify(state.selection.slice(offset, offset + 250)); } };
  let scheduled = false;
  new MutationObserver(function () { if (!scheduled) { scheduled = true; setTimeout(function () { scheduled = false; refresh(); }, 100); } }).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('popstate', refresh); window.addEventListener('resize', viewport);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', viewport);
  refresh();
})();
