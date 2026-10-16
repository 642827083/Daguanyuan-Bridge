import MNBridge from './lib/mnBridge.js';

(function () {
  const state = { source: 'math', organization: 'knowledge', records: [], recordsBySource: {}, years408: [], paperYears: new Set(), categories: new Set(), questions: [], selected: new Set(), imported: new Set(),
    years: new Set(), types: new Set(), scope: 'complete', examSubject: 'all', catalogReady: false, content: 'question', token: '', busy: true, ready: false,
    selection: [], result: null, stopping: false };
  const root = document.getElementById('root');
  root.innerHTML = '<div class="app-shell"><main class="workspace"><aside class="filters" aria-label="题目筛选">'
    + '<div class="filter-heading"><h2>筛选</h2><button id="reset" type="button">重置筛选</button></div>'
    + '<fieldset><legend>题库</legend><div class="catalog-tabs" role="group" aria-label="题库"><button type="button" data-source="math">数学</button><button type="button" data-source="408">408</button></div></fieldset>'
    + '<fieldset id="scope-field"><legend>题库范围</legend><div class="scope-tabs" role="group" aria-label="题库范围">'
    + '<button type="button" data-scope="complete">完整</button><button type="button" data-scope="core">严选</button><button type="button" data-scope="exam">真题</button></div></fieldset>'
    + '<fieldset id="exam-subject-field"><legend>备考科目</legend><div class="exam-subject-tabs" role="group" aria-label="备考科目">'
    + '<button type="button" data-exam-subject="all">全部</button><button type="button" data-exam-subject="math_1">数一</button><button type="button" data-exam-subject="math_2">数二</button><button type="button" data-exam-subject="math_3">数三</button></div></fieldset>'
    + '<div id="organization408" class="import-content-segments" role="group" aria-label="408 导入方式" hidden><button type="button" data-organization="knowledge">考点汇总</button><button type="button" data-organization="year">年份汇总</button></div>'
    + '<p id="organization-hint" class="organization-hint">按网站分类整理题目，选择分支会包含其下级分类。</p>'
    + '<fieldset id="tree-field"><legend>分类与考点</legend><div id="tree" class="knowledge-tree"></div></fieldset>'
    + '<fieldset><legend>年份</legend><div id="years" class="chip-list"></div></fieldset>'
    + '<fieldset><legend>题型</legend><div id="types" class="chip-list"></div></fieldset></aside>'
    + '<section class="results" aria-label="匹配题目"><div class="result-toolbar"><div><h2>具体题目</h2><p id="count"></p></div>'
    + '<div class="toolbar-actions"><button id="refresh" type="button">刷新</button><button id="all" type="button">全选</button><button id="none" type="button">全不选</button></div></div>'
    + '<p id="target" class="muted">导入到当前学习集</p><div id="empty" class="empty-state" role="status">请选择左侧分类或考点</div>'
    + '<div id="questions" class="question-list"></div><div id="error" class="error-banner" role="alert" hidden></div>'
    + '<section id="result" class="result-summary" aria-live="polite" hidden><div class="result-heading"><h2>导入结果</h2><div class="result-actions"><button id="copy" type="button">复制详情</button><button id="close-result" type="button">收起</button></div></div><pre id="result-text"></pre></section></section>'
    + '<footer class="action-bar"><div class="import-row"><div class="progress-wrap" aria-live="polite"><span id="status">等待选题</span>'
    + '<progress id="progress" max="100" value="0" hidden></progress></div><button id="stop" type="button" hidden>停止</button>'
    + '<div class="import-content-control" role="group" aria-label="导入内容"><span>导入内容：</span><div class="import-content-segments">'
    + '<button type="button" data-content="question">仅题目</button><button type="button" data-content="questionAnswer" title="答案与解析保存为题目的子卡片">题目＋答案</button></div></div>'
    + '<button id="commit" class="primary-button" type="button" title="已有题目跳过；选择题目＋答案时，只为缺少答案子卡的题目补建答案。">导入 0 道题</button></div></footer></main></div>';
  function el(id) { return document.getElementById(id); }
  el('result').parentNode.insertBefore(el('result'), el('empty'));
  function text(id, value) { el(id).textContent = value; }
  function error(value) { text('error', value || ''); el('error').hidden = !value; }
  function matches() {
    return state.questions.filter(function (q) {
      return (!state.years.size || state.years.has(year(q))) && (!state.types.size || state.types.has(q.questionType || 'unknown'));
    });
  }
  function year(q) { const match = String(q.source || '').match(/(?:19|20)\d{2}/); return match ? match[0] : '其他来源'; }
  function typeName(type) { return { choice: '选择题', fill: '填空题', blank: '填空题', subjective: '解答题', answer: '解答题', proof: '证明题', unknown: '其他题型' }[type] || type; }
  function paperMode() { return state.source === '408' && state.organization === 'year'; }
  function hasSourceSelection() { return paperMode() ? state.paperYears.size > 0 : state.categories.size > 0; }
  function sync() {
    const count = matches().length;
    text('count', '匹配 ' + count + ' 道，已选 ' + state.selected.size + ' 道');
    text('commit', state.busy ? '正在处理…' : '导入 ' + state.selected.size + ' 道题');
    el('commit').disabled = state.busy || !state.ready || !state.selected.size;
    el('stop').hidden = !state.busy; el('stop').disabled = state.stopping;
    el('refresh').disabled = state.busy || !hasSourceSelection();
    ['reset', 'all', 'none'].forEach(function (id) { el(id).disabled = state.busy; });
    root.querySelectorAll('[data-source], [data-organization], [data-scope], [data-exam-subject], [data-content], #tree input, #years input, #types input').forEach(function (node) { node.disabled = state.busy; });
    el('tree').querySelectorAll('[data-category]').forEach(function (input) {
      const selected = state.categories.has(Number(input.dataset.category));
      input.checked = selected;
      const row = input.closest('.knowledge-row');
      row.classList.toggle('is-selected', selected);
    });
    root.querySelectorAll('[data-source]').forEach(function (node) { node.setAttribute('aria-pressed', String(node.dataset.source === state.source)); });
    root.querySelectorAll('[data-organization]').forEach(function (node) { node.setAttribute('aria-pressed', String(node.dataset.organization === state.organization)); });
    el('scope-field').hidden = state.source !== 'math';
    el('exam-subject-field').hidden = state.source !== 'math';
    el('organization408').hidden = state.source !== '408';
    el('tree-field').hidden = paperMode();
    text('organization-hint', paperMode() ? '选择年份，按真题卷整理题目。' : '按网站分类整理题目，选择分支会包含其下级分类。');
    root.querySelectorAll('[data-scope]').forEach(function (node) { node.setAttribute('aria-pressed', String(node.dataset.scope === state.scope)); });
    root.querySelectorAll('[data-exam-subject]').forEach(function (node) { node.setAttribute('aria-pressed', String(node.dataset.examSubject === state.examSubject)); });
    root.querySelectorAll('[data-content]').forEach(function (node) { node.setAttribute('aria-pressed', String(node.dataset.content === state.content)); });
    root.querySelectorAll('[data-question]').forEach(function (node) {
      node.checked = state.selected.has(Number(node.dataset.question)); node.disabled = state.busy || !state.ready;
    });
  }
  function renderTree() {
    const children = new Map();
    state.records.forEach(function (r) {
      if (!children.has(r[1])) children.set(r[1], []);
      children.get(r[1]).push(r);
    });
    function branch(parentId) {
      const box = document.createElement('div'); box.className = 'knowledge-tree';
      (children.get(parentId) || []).forEach(function (r) {
        const hasChildren = children.has(r[0]);
        const node = document.createElement('div'); node.className = 'knowledge-node';
        const row = document.createElement('div'); row.className = 'knowledge-row';
        const toggle = document.createElement(hasChildren ? 'button' : 'span');
        toggle.className = hasChildren ? 'knowledge-toggle' : 'knowledge-toggle-placeholder';
        if (hasChildren) {
          toggle.type = 'button'; toggle.dataset.toggleCategory = String(r[0]);
          toggle.setAttribute('aria-label', '展开分类：' + r[2]); toggle.setAttribute('aria-expanded', 'false');
          toggle.setAttribute('aria-controls', 'category-children-' + r[0]);
          const chevron = document.createElement('span'); chevron.className = 'knowledge-chevron';
          chevron.setAttribute('aria-hidden', 'true'); chevron.textContent = '›'; toggle.appendChild(chevron);
        } else toggle.setAttribute('aria-hidden', 'true');
        const name = document.createElement(hasChildren ? 'button' : 'span'); name.textContent = r[2]; name.className = 'knowledge-name';
        if (hasChildren) {
          name.type = 'button'; name.dataset.toggleCategory = String(r[0]);
          name.setAttribute('aria-label', '展开分类：' + r[2]); name.setAttribute('aria-expanded', 'false');
          name.setAttribute('aria-controls', 'category-children-' + r[0]);
        }
        const label = document.createElement('label'); label.className = 'knowledge-check';
        const input = document.createElement('input'); input.type = 'checkbox'; input.dataset.category = String(r[0]);
        input.setAttribute('aria-label', '选择分类：' + r[2]); input.checked = state.categories.has(r[0]);
        label.appendChild(input); row.appendChild(toggle); row.appendChild(name); row.appendChild(label); node.appendChild(row);
        if (hasChildren) {
          const childTree = branch(r[0]); childTree.id = 'category-children-' + r[0]; childTree.hidden = true;
          node.appendChild(childTree);
        }
        box.appendChild(node);
      });
      return box;
    }
    el('tree').replaceChildren(branch(0));
  }
  function chips(id, values, selected, labelFor) {
    const box = el(id); box.replaceChildren();
    if (!values.length) { box.textContent = '选择分类后显示'; return; }
    values.forEach(function (value) {
      const label = document.createElement('label'); label.className = 'filter-chip';
      const input = document.createElement('input'); input.type = 'checkbox'; input.dataset.filter = id; input.value = value; input.checked = selected.has(value);
      const span = document.createElement('span'); span.textContent = labelFor(value);
      label.appendChild(input); label.appendChild(span); box.appendChild(label);
    });
  }
  function renderFilters() {
    const years = paperMode() ? state.years408.map(String) : Array.from(new Set(state.questions.map(year))).sort().reverse();
    const types = Array.from(new Set(state.questions.map(function (q) { return q.questionType || 'unknown'; })));
    state.years = new Set(Array.from(state.years).filter(function (v) { return years.indexOf(v) >= 0; }));
    state.types = new Set(Array.from(state.types).filter(function (v) { return types.indexOf(v) >= 0; }));
    chips('years', years, paperMode() ? state.paperYears : state.years, function (v) { return v; }); chips('types', types, state.types, typeName);
  }
  function preview(card, q) {
    const pre = document.createElement('pre'); pre.className = 'markdown-preview';
    pre.textContent = String(q.stem || '').replace(/asset:\/\/sha256\/[a-f0-9]{64}/g, '[图片]')
      + (q.options || []).map(function (value, i) { return value ? '\n' + 'ABCD'[i] + '. ' + value.replace(/asset:\/\/sha256\/[a-f0-9]{64}/g, '[图片]') : ''; }).join('');
    card.appendChild(pre);
    // 图片地址仅允许题库自身的素材与 HTTPS 图片，不执行题干中的 HTML。
    const refs = ((String(q.stem || '') + '\n' + (q.options || []).join('\n')).match(/asset:\/\/sha256\/[a-f0-9]{64}|!\[[^\]]*\]\(https:\/\/[^\s)]+\)/g) || [])
      .concat((q.previewImages || []).filter(function (url) { return /^https:\/\//.test(url); }));
    Array.from(new Set(refs)).forEach(function (ref) {
      const img = document.createElement('img'); img.className = 'question-image'; img.loading = 'lazy'; img.alt = '题目图片';
      img.src = ref.indexOf('asset://') === 0 ? 'https://www.cxyonly.fans/api/v1/question-assets/' + ref.split('/').pop()
        : ref.indexOf('https://') === 0 ? ref : ref.slice(ref.indexOf('](') + 2, -1);
      card.appendChild(img);
    });
  }
  function renderQuestions(selectAll) {
    const questions = matches();
    const allowed = new Set(questions.map(function (q) { return q.id; }));
    state.selected = selectAll ? allowed : new Set(Array.from(state.selected).filter(function (id) { return allowed.has(id); }));
    const list = el('questions'); list.replaceChildren();
    questions.forEach(function (q) {
      const card = document.createElement('article'); card.className = 'question-card';
      const row = document.createElement('label'); row.className = 'question-select';
      const input = document.createElement('input'); input.type = 'checkbox'; input.dataset.question = String(q.id);
      const info = document.createElement('span'), title = document.createElement('strong'), meta = document.createElement('small');
      title.textContent = (q.source || '题目 ' + q.id) + (state.source === 'math' && q.serialNumber ? ' · 第 ' + q.serialNumber + ' 题' : '');
      meta.textContent = (q.categoryPath || '') + ' · ' + typeName(q.questionType || 'unknown');
      info.appendChild(title); info.appendChild(meta); row.appendChild(input); row.appendChild(info);
      if (state.imported.has(q.id)) { const badge = document.createElement('span'); badge.className = 'status-badge'; badge.textContent = '已导入'; row.appendChild(badge); }
      card.appendChild(row); preview(card, q); list.appendChild(card);
    });
    el('empty').hidden = Boolean(questions.length);
    text('empty', state.busy ? '正在读取题目…' : hasSourceSelection() ? '当前筛选下没有题目' : paperMode() ? '请选择左侧试卷年份' : '请选择左侧分类或考点');
    sync();
  }
  function finish() { state.busy = false; state.stopping = false; el('progress').hidden = true; sync(); }
  async function refreshCatalog() {
    state.busy = true; state.ready = false; state.catalogReady = false;
    state.token = ''; state.questions = []; state.selected.clear(); state.years.clear(); state.types.clear();
    el('result').hidden = true; error(''); text('status', '正在读取适用分类…'); renderFilters(); renderQuestions(false);
    try {
      const data = await MNBridge.send('getImportWorkspaceCatalog', { scope: state.scope, examSubject: state.examSubject });
      state.records = data.records; state.recordsBySource.math = data.records; state.catalogReady = true;
      const allowed = new Set(data.records.map(function (r) { return r[0]; }));
      state.categories = new Set(Array.from(state.categories).filter(function (id) { return allowed.has(id); }));
      state.busy = false; renderTree(); await prepare();
    } catch (e) {
      state.records = []; state.categories.clear(); renderTree(); finish(); renderQuestions(false);
      error(e.message); text('empty', '分类读取失败，请重新选择科目或范围重试'); text('status', '分类读取失败，请重新选择科目或范围重试');
    }
  }
  async function prepare() {
    if (state.busy) return;
    state.ready = false; state.questions = []; state.selected.clear(); state.result = null;
    state.token = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    el('result').hidden = true; error(''); renderFilters(); renderQuestions(false);
    if (!hasSourceSelection()) { text('status', '等待选题'); return; }
    if (state.source === 'math' && !state.catalogReady) { error('请先重新读取适用分类'); return; }
    state.busy = true; text('status', '正在读取题目…'); sync();
    try { await MNBridge.send('prepareImportWorkspace', { token: state.token, source: state.source, organization: state.organization,
      paperYears: Array.from(state.paperYears).map(Number), scope: state.scope, examSubject: state.examSubject, categoryIds: Array.from(state.categories) }); }
    catch (e) { state.ready = false; finish(); error(e.message); }
  }
  root.addEventListener('click', async function (event) {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    try {
      if (button.dataset.source || button.dataset.organization) {
        await MNBridge.send('stopImportWorkspace', {});
        if (button.dataset.source) { state.source = button.dataset.source; state.records = state.recordsBySource[state.source]; }
        else state.organization = button.dataset.organization;
        state.categories.clear(); state.paperYears.clear(); state.years.clear(); state.types.clear(); state.imported.clear();
        text('target', '导入到当前学习集'); renderTree();
        if (state.source === 'math') await refreshCatalog(); else await prepare(); sync();
      }
      else if (button.dataset.scope || button.dataset.examSubject) {
        if (button.dataset.scope) state.scope = button.dataset.scope; else state.examSubject = button.dataset.examSubject;
        await refreshCatalog(); sync();
      }
      else if (button.dataset.content) { state.content = button.dataset.content; sync(); }
      else if (button.id === 'all') { state.selected = new Set(matches().map(function (q) { return q.id; })); sync(); }
      else if (button.id === 'none') { state.selected.clear(); sync(); }
      else if (button.id === 'refresh') await prepare();
      else if (button.id === 'reset') { state.categories.clear(); state.paperYears.clear(); state.years.clear(); state.types.clear(); renderTree(); await prepare(); }
      else if (button.id === 'stop') { state.stopping = true; text('status', '正在停止，已完成的题卡保留…'); sync(); await MNBridge.send('stopImportWorkspace', {}); }
      else if (button.id === 'copy') { await MNBridge.send('copyImportWorkspaceResult', {}); text('status', '已复制导入详情'); }
      else if (button.id === 'close-result') el('result').hidden = true;
      else if (button.id === 'commit') {
        state.selection = matches().filter(function (q) { return state.selected.has(q.id); }).map(function (q) { return q.id; });
        state.busy = true; el('result').hidden = true; error(''); text('status', '正在准备导入…'); sync();
        try { await MNBridge.send('commitImportWorkspace', { token: state.token, count: state.selection.length, content: state.content }); }
        catch (e) { finish(); throw e; }
      }
    } catch (e) { error(e.message); }
  });
  root.addEventListener('change', function (event) {
    const input = event.target;
    if (state.busy) return;
    if (input.dataset.question) { const id = Number(input.dataset.question); if (input.checked) state.selected.add(id); else state.selected.delete(id); sync(); }
    else if (input.dataset.category) {
      const id = Number(input.dataset.category); if (input.checked) state.categories.add(id); else state.categories.delete(id); prepare();
    } else if (input.dataset.filter) {
      if (input.dataset.filter === 'years' && paperMode()) {
        if (input.checked) state.paperYears.add(input.value); else state.paperYears.delete(input.value); prepare(); return;
      }
      const selected = state[input.dataset.filter]; if (input.checked) selected.add(input.value); else selected.delete(input.value); renderQuestions(true);
    }
  });
  el('tree').addEventListener('click', function (event) {
    if (event.target.closest('label')) { event.stopPropagation(); return; }
    const toggle = event.target.closest('[data-toggle-category]');
    if (toggle) {
      event.preventDefault(); event.stopPropagation();
      const expanded = toggle.getAttribute('aria-expanded') !== 'true';
      el(toggle.getAttribute('aria-controls')).hidden = !expanded;
      const row = toggle.closest('.knowledge-row'), name = row.querySelector('.knowledge-name').textContent;
      row.querySelectorAll('[data-toggle-category]').forEach(function (control) {
        control.setAttribute('aria-expanded', String(expanded));
        control.setAttribute('aria-label', (expanded ? '收起分类：' : '展开分类：') + name);
      });
      return;
    }
  });
  window.__DAGUANYUAN_IMPORT_WORKSPACE__ = {
    start: function (token, data) { if (token !== state.token) return; text('target', '目标学习集：' + data.target); },
    append: function (token, data) { if (token !== state.token) return; state.questions.push.apply(state.questions, data.questions); text('status', '已读取 ' + state.questions.length + ' 道 · 分类 ' + data.categoryIndex + '/' + data.categoryCount); },
    ready: function (token, data) { if (token !== state.token) return; state.ready = true; state.imported = new Set(data.importedIds); finish(); renderFilters(); renderQuestions(true); text('status', '共读取 ' + data.count + ' 道题'); },
    failure: function (token, data) { if (token !== state.token) return; state.ready = false; state.questions = []; finish(); renderQuestions(false); error(data.error); text('status', '读取已停止，请刷新后重试'); },
    progress: function (token, data) {
      if (token !== state.token) return;
      if (!state.stopping) text('status', (data.phase === 'fetching' ? '准备题目 ' : '写入题卡 ') + data.processed + '/' + data.total);
      el('progress').hidden = false; el('progress').value = Math.min(100, Math.round(data.processed / Math.max(1, data.total) * 100));
    },
    result: function (token, data) {
      if (token !== state.token) return;
      state.result = data.result; state.ready = !data.result.interrupted; state.imported = new Set(data.importedIds || []);
      finish(); renderQuestions(false); text('result-text', data.text); el('result').hidden = false;
      root.querySelector('.results').scrollTop = 0;
      text('status', data.result.interrupted ? '导入已停止，已完成的题卡保留' : '导入完成');
    },
    selectionChunk: function (token, offset) { if (token !== state.token) throw new Error('选择已失效'); return JSON.stringify(state.selection.slice(offset, offset + 250)); },
    resume: function () { if (!state.busy) prepare(); },
  };
  async function initialize() {
    try { const data = await MNBridge.send('getImportWorkspace', {}); state.recordsBySource = { math: data.records, '408': data.records408 };
      state.source = data.source || 'math'; state.records = state.recordsBySource[state.source]; state.years408 = data.years408 || [];
      state.scope = data.scope; state.examSubject = data.examSubject || 'all';
      state.content = data.content;
      if (state.source === 'math') await refreshCatalog();
      else { state.busy = false; renderTree(); renderFilters(); sync(); } }
    catch (e) { finish(); error(e.message); }
  }
  sync(); initialize();
})();
