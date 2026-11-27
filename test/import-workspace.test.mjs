import { withMathSite } from './helpers/math-site.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';
import build from '../scripts/build-web.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
const source = name => withMathSite(readFileSync(new URL('../src/' + name + '.js', import.meta.url), 'utf8'));
function runtime(size = 3) {
  const { document, Event } = parseHTML('<html><body><div id="root"></div></body></html>');
  const browser = { document, console, window: {}, setTimeout() { return 1; }, clearTimeout() {} };
  vm.createContext(browser);
  const notebook = { notebookId: 'study', topicId: 'study', title: '考研数学', notes: [] };
  const selection = { notebookId: 'study' }, notes = new Map(), stored = new Map(), requests = [], details = [], copied = {};
  const records = [[1, 0, '高等数学'], [2, 1, '极限'], [3, 2, '函数极限'], [4, 1, '连续'], [5, 4, '连续性判断']];
  let serial = 0;
  function create(title, topic) {
    assert.equal(topic, 'study');
    const note = { noteId: 'n' + ++serial, notebookId: topic, noteTitle: title, comments: [], childNotes: [],
      appendMarkdownComment(text) { this.comments.push({ text }); },
      addChild(child) { if (child.parentNote) child.parentNote.childNotes = child.parentNote.childNotes.filter(n => n !== child); child.parentNote = this; this.childNotes.push(child); notebook.notes = notebook.notes.filter(n => n !== child); },
      insertChildBefore(child, before) { this.addChild(child); this.childNotes.pop(); this.childNotes.splice(this.childNotes.indexOf(before), 0, child); } };
    notes.set(note.noteId, note); notebook.notes.push(note); return note;
  }
  const questions = Array.from({ length: size }, (_, i) => ({ id: i + 100, categoryId: 3, importCategoryId: 3,
    source: (i % 2 ? '2025' : '2026') + '年真题', serialNumber: i + 1, questionType: i % 2 ? 'choice' : 'subjective',
    categoryPath: '高等数学 / 极限 / 函数极限', stem: '题干 $x$ <img src="bad" onerror="bad()">', options: ['甲', '乙'] }));
  const native = { console, NSUserDefaults: { standardUserDefaults() { return { objectForKey: k => stored.get(k), setObjectForKey: (v, k) => stored.set(k, v) }; } },
    NSTimer: { scheduledTimerWithTimeInterval() { return { invalidate() {} }; } },
    Application: { sharedInstance() { return { studyController() { return { notebookController: selection }; }, refreshAfterDBChanged() {} }; } },
    Database: { sharedInstance() { return { getNotebookById: id => id === 'study' ? notebook : null, createNoteWithTitleTopicid: create }; } },
    MNUtil: { getNoteById: id => notes.get(id) },
    MNNote: { new(id) { const note = notes.get(id); return { appendMarkdownComment: text => note.appendMarkdownComment(text), removeCommentByIndex: i => note.comments.splice(i, 1), sortCommentsByNewIndices: indices => { const before = note.comments.slice(); indices.forEach((position, old) => { note.comments[position] = before[old]; }); } }; } },
    UndoManager: { sharedInstance() { return { undoGrouping(label, topic, fn) { fn(); } }; } },
    UIPasteboard: { generalPasteboard() { return copied; } },
    __DAGUANYUAN_CATEGORY_CATALOG_STORE_GLOBAL__: { currentCatalog() { return { records }; } },
    __DAGUANYUAN_408_CATALOG_DATA__: { records: [[10, 0, '数据结构'], [11, 10, '线性表']], years: [2026, 2025] },
    __DAGUANYUAN_408_WORKSPACE_GLOBAL__: { async load(controller, url) { requests.push({ url }); return { url }; }, release() {} },
    __DAGUANYUAN_408_IMPORT_GLOBAL__: { async prepareWorkspace(adapter, previews) {
      const category = { title: '线性表', path: ['数据结构', '线性表'], url: adapter.url };
      return { listing: { ids: questions.map(q => q.id), category,
        sources: Object.fromEntries(questions.map(q => [q.id, q.source])),
        summaries: Object.fromEntries(questions.map(q => [q.id, q.stem])),
        metadata: Object.fromEntries(questions.map(q => [q.id, { number: q.serialNumber, questionType: q.questionType }])) },
        async readQuestion(id, content) { details.push(id); return { ...questions.find(q => q.id === id), stem: '408 题干', ...(content === 'questionAnswer' ? { answer: '408 答案' } : {}) }; },
        async close() {} };
    } },
    __DAGUANYUAN_MATH_API_GLOBAL__: {
      positiveInteger: Number, questionScope(value) { if (!['complete', 'core', 'exam'].includes(value)) throw Error('题库范围无效'); return value; },
      examSubject(value = 'all') { if (!['all', 'math_1', 'math_2', 'math_3'].includes(value)) throw Error('备考科目无效'); return value; },
      async categoryRecords() { return records; },
      async questionPage(category, page, scope, examSubject) {
        requests.push({ category, page, scope, examSubject });
        const items = category === 3 ? questions : [];
        return { total: items.length, pageSize: 20, questions: items.slice((page - 1) * 20, page * 20) };
      },
      async questionDetail(id, content, readImage) { assert.equal(typeof readImage, 'function'); details.push(id); const q = questions.find(q => q.id === id); return { ...q, ...(content === 'questionAnswer' ? { answer: 'C', explanation: '解题过程' } : {}) }; },
    },
  };
  vm.createContext(native);
  native.__DAGUANYUAN_CATEGORY_CATALOG_STORE_GLOBAL__.currentCatalog = () => ({ records: [] });
  for (const name of ['DaguanyuanCategoryRoutes', 'DaguanyuanSourceLink', 'DaguanyuanMathImages', 'DaguanyuanCardComments', 'DaguanyuanMathImport', 'DaguanyuanImportReport', 'DaguanyuanImportSelection', 'DaguanyuanImportWorkspace', 'WebBridgeCommands']) vm.runInContext(source(name), native);
  const controller = { addon: { window: {} }, activePage: 'import', importWebView: { evaluateJavaScript(script, cb) {
    try { cb(vm.runInContext(script, browser), null); } catch (e) { cb(null, e); }
  } }, webView: { evaluateJavaScript() { throw Error('回执不得发送到题库网页'); } } };
  const bridgeContext = { controller, webView: controller.importWebView, isImportWorkspace: true };
  controller.addon.panelController = controller;
  const commands = native.__DAGUANYUAN_WEB_BRIDGE_COMMANDS_GLOBAL__;
  const append = document.body.appendChild.bind(document.body);
  document.body.appendChild = node => {
    const result = append(node);
    if (node.tagName === 'IFRAME') queueMicrotask(() => commands.handle(bridgeContext, node.src));
    return result;
  };
  vm.runInContext(build.workspaceScript(), browser);
  function click(selector) { const node = document.querySelector(selector); assert.ok(node, selector); assert.equal(node.disabled, false, selector); node.dispatchEvent(new Event('click', { bubbles: true })); }
  function select(selector, value) { const node = document.querySelector(selector); assert.ok(node, selector); node.checked = value; node.dispatchEvent(new Event('change', { bubbles: true })); }
  async function load(category = 2) { await tick(); select('[data-category="' + category + '"]', true); await tick(); await controller.importWorkspaceTask?.done; await tick(); }
  return { browser, native, document, controller, questions, notes, requests, details, stored, copied, selection, click, select, load,
    workspace: native.__DAGUANYUAN_IMPORT_WORKSPACE_GLOBAL__, commands, bridgeContext };
}

test('真实导入流程生成可关联的诊断记录，读取失败被记录且不写入题干或学习集名称', async () => {
  const run = runtime(2);
  vm.runInContext(source('DaguanyuanDiagnostics'), run.native);
  await run.load(); run.click('#commit'); await tick(); await run.controller.importWorkspaceTask.done;
  const logs = run.native.__DAGUANYUAN_DIAGNOSTICS_GLOBAL__;
  const snapshot = () => { const text = logs.text(); return JSON.parse(text.slice(text.indexOf('{'))); };
  let entries = snapshot().entries;
  const start = entries.find(row => row.event === 'workspace.import.start'), result = entries.find(row => row.event === 'workspace.import.result');
  assert.ok(start); assert.equal(result.details.taskId, start.details.taskId); assert.equal(result.details.createdCount, 2); assert.equal(result.details.status, 'complete');
  assert.ok(entries.some(row => row.event === 'bridge.command.start' && row.details.command === 'commitImportWorkspace'));
  run.native.__DAGUANYUAN_MATH_API_GLOBAL__.questionPage = async () => { throw Error('题目接口请求失败：503'); };
  run.select('[data-category="2"]', false); run.select('[data-category="2"]', true); await tick(); await run.controller.importWorkspaceTask.done;
  entries = snapshot().entries;
  assert.ok(entries.some(row => row.event === 'workspace.read' && row.error.message.includes('503')));
  const text = JSON.stringify(entries); assert.equal(text.includes('题干 $x$'), false); assert.equal(text.includes('考研数学'), false);
});

test('独立导入页通过真实 bridge 展开分类并读取分页，筛选、选题只写所选题', async () => {
  const run = runtime(25); await run.load();
  assert.deepEqual(run.requests.map(r => [r.category, r.page]), [[2, 1], [3, 1], [3, 2]]);
  assert.equal(run.document.querySelectorAll('.question-card').length, 25);
  assert.equal(run.document.querySelectorAll('.question-card img').length, 0);
  assert.match(run.document.getElementById('target').textContent, /考研数学/);
  run.select('#years input[value="2025"]', true);
  assert.equal(run.document.querySelectorAll('.question-card').length, 12);
  run.click('#none'); assert.equal(run.document.getElementById('commit').disabled, true);
  run.select('[data-question="123"]', true); run.select('[data-question="101"]', true);
  run.click('[data-content="questionAnswer"]'); run.click('#commit'); await tick(); await run.controller.importWorkspaceTask.done;
  assert.deepEqual(run.details, [101, 123]);
  const cards = [...run.notes.values()].filter(n => /DAGUANYUAN_QUESTION_ID:/.test(n.comments[1]?.text || ''));
  assert.equal(cards.length, 2); assert.ok(cards.every(n => /### 答案\n\nC/.test(n.childNotes[0].comments[0].text)));
  assert.ok(cards.every(n => !/### 答案/.test(n.comments[0].text)));
  assert.ok(cards.every(n => n.parentNote.noteTitle === '函数极限'));
  assert.match(run.document.getElementById('result-text').textContent, /新建 2/);
  run.click('#copy'); await tick(); assert.match(run.copied.string, /考研数学/);
  run.click('#commit'); await tick(); await run.controller.importWorkspaceTask.done;
  assert.match(run.document.getElementById('result-text').textContent, /跳过 2/);
});

test('完整、严选、真题分别传递到取题接口，不依赖题库网页的当前范围', async () => {
  const run = runtime(); await run.load();
  for (const scope of ['core', 'exam', 'complete']) {
    run.requests.length = 0; run.click('[data-scope="' + scope + '"]'); await tick(); await run.controller.importWorkspaceTask.done;
    assert.ok(run.requests.every(r => r.scope === scope));
    assert.equal(run.document.querySelector('[data-scope="' + scope + '"]').getAttribute('aria-pressed'), 'true');
  }
  assert.equal(run.stored.get('cn.marginnote.daguanyuan-bridge.import-workspace.scope'), 'complete');
});

test('408 按知识点读取，只导入所选题及答案，同号数学题不互相覆盖', async () => {
  const run = runtime(); await run.load();
  run.select('[data-question="101"]', false); run.select('[data-question="102"]', false);
  run.click('#commit'); await tick(); await run.controller.importWorkspaceTask.done;
  await tick(); run.click('[data-source="408"]'); await tick();
  assert.equal(run.document.getElementById('scope-field').hidden, true);
  assert.equal(run.document.getElementById('organization408').hidden, false);
  run.select('[data-category="10"]', true); await tick(); await run.controller.importWorkspaceTask.done;
  assert.ok(run.requests.some(r => /knowledgeId=11.*sourcePage=overview/.test(r.url)));
  assert.equal(run.document.querySelectorAll('.question-card').length, 3);
  assert.equal(run.document.getElementById('commit').textContent, '导入 3 道题');
  run.click('#none'); run.select('[data-question="100"]', true);
  run.click('[data-content="questionAnswer"]'); run.details.length = 0;
  run.click('#commit'); await tick(); await run.controller.importWorkspaceTask.done;
  assert.deepEqual(run.details, [100]);
  const bodies = [...run.notes.values()].map(n => n.comments.map(c => c.text || '').join('\n'));
  assert.equal(bodies.filter(text => text.includes('DAGUANYUAN_QUESTION_ID:100')).length, 1);
  assert.equal(bodies.filter(text => text.includes('DAGUANYUAN_408_QUESTION_ID:100')).length, 1);
  assert.ok(bodies.some(text => text.includes('408 答案')));
  assert.match(run.document.getElementById('result-text').textContent, /来源：408[\s\S]*新建 1/);
});

function instructionRuntime() {
  const run = runtime(5);
  const names = ['指令格式与操作码扩展', '寻址方式', '程序的机器级代码表示', 'RISC与CISC'];
  run.native.__DAGUANYUAN_408_CATALOG_DATA__.records = [[46, 0, '计算机组成原理'], [60, 46, '指令系统'], ...names.map((name, i) => [61 + i, 60, name])];
  run.native.__DAGUANYUAN_408_IMPORT_GLOBAL__.prepareWorkspace = async adapter => {
    const id = Number(new URL(adapter.url).searchParams.get('knowledgeId'));
    const path = ['计算机组成原理', '指令系统'].concat(id === 60 ? [] : [names[id - 61]]);
    const category = { title: path.at(-1), path, url: adapter.url };
    const ids = id === 60 ? [100, 101, 102, 103, 104] : [100 + id - 61];
    return { listing: { category, ids, sources: Object.fromEntries(ids.map(id => [id, '2026年 第' + id + '题'])), summaries: {} },
      async readQuestion(id) { run.details.push(id); return { id, source: '题目 ' + id, stem: '题干' }; }, async close() {} };
  };
  return { run, names };
}

test('408 勾选指令系统父分类保留四个子分类，父子汇总题目去重，重复导入不重复建卡', async () => {
  const { run, names } = instructionRuntime();
  await tick(); run.click('[data-source="408"]'); await tick();
  run.select('[data-category="60"]', true); await tick(); await run.controller.importWorkspaceTask.done;
  assert.equal(run.controller.importWorkspaceTask.questions.length, 5);
  assert.deepEqual(Array.from(run.controller.importWorkspaceTask.questions.filter(q => q.id < 104), q => q.category.path.at(-1)), names);
  run.click('#commit'); await tick(); await run.controller.importWorkspaceTask.done;
  const cards = [...run.notes.values()].filter(n => n.comments[1]?.text.includes('DAGUANYUAN_408_QUESTION_ID:'));
  assert.equal(cards.length, 5);
  assert.deepEqual(cards.filter(n => !n.comments[1].text.includes('QUESTION_ID:104')).map(n => n.parentNote.noteTitle), names);
  assert.equal(cards.find(n => n.comments[1].text.includes('QUESTION_ID:104')).parentNote.noteTitle, '指令系统');
  run.details.length = 0;
  run.click('#commit'); await tick(); await run.controller.importWorkspaceTask.done;
  assert.equal([...run.notes.values()].filter(n => n.comments[1]?.text.includes('DAGUANYUAN_408_QUESTION_ID:')).length, 5);
  assert.match(run.document.getElementById('result-text').textContent, /跳过 5/);
  assert.deepEqual(run.details, []);
  assert.equal(run.document.querySelectorAll('.status-badge').length, 5);
  for (const badge of run.document.querySelectorAll('.status-badge')) assert.equal(badge.textContent, '已导入');
});

test('408 重新导入复用旧父层题卡并归入子分类，保留原卡 ID、独立笔记和子节点', async () => {
  const { run } = instructionRuntime();
  const writer = run.native.__DAGUANYUAN_MATH_IMPORT_GLOBAL__;
  writer.prepared408Session(run.controller.addon).write({ id: 100, source: '旧题目', stem: '题干' },
    { title: '指令系统', path: ['计算机组成原理', '指令系统'], url: 'https://www.408os.cn/exercise?knowledgeId=60&sourcePage=overview' }, 'question');
  const old = [...run.notes.values()].find(n => n.comments[1]?.text.includes('DAGUANYUAN_408_QUESTION_ID:100'));
  old.comments.push({ text: '我的独立笔记' }); const child = { noteId: 'personal-child', noteTitle: '解题思路', childNotes: [] }; old.addChild(child);
  const oldId = old.noteId, oldParent = old.parentNote;
  await tick(); run.click('[data-source="408"]'); await tick(); run.select('[data-category="60"]', true); await tick(); await run.controller.importWorkspaceTask.done;
  run.click('#commit'); await tick(); await run.controller.importWorkspaceTask.done;
  const cards = [...run.notes.values()].filter(n => n.comments[1]?.text.includes('DAGUANYUAN_408_QUESTION_ID:'));
  assert.equal(cards.length, 5);
  assert.equal(old.noteId, oldId); assert.equal(old.parentNote.noteTitle, '指令格式与操作码扩展');
  assert.equal(oldParent.childNotes.includes(old), false); assert.ok(old.comments.some(c => c.text === '我的独立笔记'));
  assert.equal(old.childNotes[0], child); assert.equal(child.parentNote, old);
  assert.match(run.document.getElementById('result-text').textContent, /新建 4[\s\S]*补答案 0[\s\S]*跳过 1/);
});

test('408 旧题卡归类过程中出错时恢复原父节点和内容，不复制或删除旧卡', async () => {
  const { run } = instructionRuntime();
  run.native.__DAGUANYUAN_MATH_IMPORT_GLOBAL__.prepared408Session(run.controller.addon).write({ id: 100, source: '旧题目', stem: '原题干' },
    { title: '指令系统', path: ['计算机组成原理', '指令系统'], url: 'https://www.408os.cn/exercise?knowledgeId=60' }, 'question');
  const old = [...run.notes.values()].find(n => n.comments[1]?.text.includes('DAGUANYUAN_408_QUESTION_ID:100'));
  const originalParent = old.parentNote, originalText = old.comments[0].text;
  const editor = run.native.MNNote.new;
  run.native.MNNote.new = id => {
    const wrapped = editor(id), note = run.notes.get(id);
    if (note.noteTitle === '指令格式与操作码扩展') wrapped.addChild = child => { note.addChild(child); throw Error('模拟移动失败'); };
    return wrapped;
  };
  await tick(); run.click('[data-source="408"]'); await tick(); run.select('[data-category="60"]', true); await tick(); await run.controller.importWorkspaceTask.done;
  run.click('#commit'); await tick(); await run.controller.importWorkspaceTask.done;
  assert.equal(old.parentNote, originalParent); assert.equal(old.comments[0].text, originalText);
  assert.equal([...run.notes.values()].filter(n => n.comments[1]?.text.includes('DAGUANYUAN_408_QUESTION_ID:100')).length, 1);
  assert.match(run.document.getElementById('result-text').textContent, /模拟移动失败/);
});

test('408 归类复用只处理对应父分类的旧卡，年份题卡和单题卡保留', async () => {
  for (const variant of ['year', 'single']) {
    const { run } = instructionRuntime();
    run.native.__DAGUANYUAN_MATH_IMPORT_GLOBAL__.prepared408Session(run.controller.addon).write({ id: 100, source: '旧题目', stem: '原题干' },
      { title: '指令系统', path: ['计算机组成原理', '指令系统'], url: variant === 'year' ? 'https://www.408os.cn/exercise?year=2026' : 'https://www.408os.cn/exercise?knowledgeId=60' }, 'question');
    const old = [...run.notes.values()].find(n => n.comments[1]?.text.includes('DAGUANYUAN_408_QUESTION_ID:100')), parent = old.parentNote;
    if (variant === 'single') old.comments.push({ text: '<!-- DAGUANYUAN_SINGLE_IMPORT:1 -->' });
    await tick(); run.click('[data-source="408"]'); await tick(); run.select('[data-category="60"]', true); await tick(); await run.controller.importWorkspaceTask.done;
    run.click('#commit'); await tick(); await run.controller.importWorkspaceTask.done;
    assert.equal(old.parentNote, parent);
    assert.equal([...run.notes.values()].filter(n => n.comments[1]?.text.includes('DAGUANYUAN_408_QUESTION_ID:100')).length, 2);
  }
});

test('408 年份选择读取对应真题页，知识点与年份模式可切换', async () => {
  const run = runtime(); await tick(); run.click('[data-source="408"]'); await tick();
  run.click('[data-organization="year"]'); await tick();
  assert.equal(run.document.getElementById('tree-field').hidden, true);
  assert.equal(run.document.querySelectorAll('#years input').length, 2);
  run.select('#years input[value="2026"]', true); await tick(); await run.controller.importWorkspaceTask.done;
  assert.equal(run.requests.at(-1).url, 'https://www.408os.cn/exercise?year=2026');
  run.click('#none'); run.select('[data-question="101"]', true); run.click('#commit'); await tick(); await run.controller.importWorkspaceTask.done;
  assert.deepEqual(run.details, [101]);
  run.click('[data-organization="knowledge"]'); await tick();
  assert.equal(run.document.getElementById('tree-field').hidden, false);
  assert.equal(run.document.querySelectorAll('.question-card').length, 0);
});

test('408 年份为单选，切换年份仅加载新年份，原生拒绝多年份请求', async () => {
  const run = runtime(); await tick();
  assert.throws(() => run.workspace.prepare(run.controller, { source: '408', token: 'multi-year', organization: 'year', paperYears: [2026, 2025] }), /一次只能选择一个/);
  assert.equal(run.requests.length, 0);
  run.click('[data-source="408"]'); await tick(); run.click('[data-organization="year"]'); await tick();
  assert.ok([...run.document.querySelectorAll('#years input')].every(input => input.type === 'radio' && input.name === 'daguanyuan-408-paper-year'));
  run.select('#years input[value="2026"]', true); await tick(); await run.controller.importWorkspaceTask.done;
  run.requests.length = 0;
  run.select('#years input[value="2025"]', true); await tick(); await run.controller.importWorkspaceTask.done;
  assert.deepEqual([...run.document.querySelectorAll('#years input')].filter(input => input.checked).map(input => input.value), ['2025']);
  assert.deepEqual(run.requests.map(r => r.url), ['https://www.408os.cn/exercise?year=2025']);
  assert.ok(run.controller.importWorkspaceTask.questions.every(q => q.url.endsWith('year=2025')));
  run.click('#reset'); await tick();
  assert.equal([...run.document.querySelectorAll('#years input')].filter(input => input.checked).length, 0);
});

test('408 分类和年份校验、学习集切换和目录成员变化都在写卡前停止', async () => {
  const run = runtime(); await tick();
  for (const values of [{ organization: 'year', paperYears: [2027] }, { organization: 'year', paperYears: [2026, 2026] }, { organization: 'knowledge', categoryIds: [999] }]) {
    assert.throws(() => run.workspace.prepare(run.controller, { source: '408', token: 'valid', ...values }), /无效|重复|一次只能选择一个/);
  }
  assert.equal(run.requests.length, 0);
  run.click('[data-source="408"]'); await tick(); run.select('[data-category="10"]', true); await tick(); await run.controller.importWorkspaceTask.done;
  assert.equal(run.requests.length, 2);
  const original = run.native.__DAGUANYUAN_408_IMPORT_GLOBAL__.prepareWorkspace;
  run.native.__DAGUANYUAN_408_IMPORT_GLOBAL__.prepareWorkspace = async (...args) => { const prepared = await original(...args); prepared.listing.ids = []; return prepared; };
  run.click('#commit'); await tick(); await run.controller.importWorkspaceTask.done;
  assert.equal(run.notes.size, 0); assert.equal(run.details.length, 0);
  assert.match(run.document.getElementById('result-text').textContent, /已不在原分类/);
  run.selection.notebookId = 'other';
  assert.throws(() => run.workspace.commit(run.controller, { token: run.controller.importWorkspaceTask.token, count: 1, content: 'question' }), /学习集已切换/);
});

test('408 下载期间停止或切换学习集，保留已完成题卡，余下题目不写入', async () => {
  for (const action of ['stop', 'switch']) {
    const run = runtime(); await tick(); run.click('[data-source="408"]'); await tick();
    run.select('[data-category="10"]', true); await tick(); await run.controller.importWorkspaceTask.done;
    const original = run.native.__DAGUANYUAN_408_IMPORT_GLOBAL__.prepareWorkspace;
    run.native.__DAGUANYUAN_408_IMPORT_GLOBAL__.prepareWorkspace = async (...args) => {
      const prepared = await original(...args), read = prepared.readQuestion;
      prepared.readQuestion = async (...values) => {
        const question = await read(...values);
        if (values[0] === 101) {
          if (action === 'stop') run.workspace.close(run.controller);
          else run.selection.notebookId = 'other';
        }
        return question;
      };
      return prepared;
    };
    run.click('#commit'); await tick(); await run.controller.importWorkspaceTask.done;
    assert.deepEqual(run.details, [100, 101]);
    assert.equal([...run.notes.values()].filter(n => n.comments[1]?.text.includes('DAGUANYUAN_408_QUESTION_ID:')).length, 1);
    assert.match(run.document.getElementById('result-text').textContent, /新建 1/);
    assert.equal(run.document.getElementById('commit').disabled, true);
  }
});

test('501 题选题分块提交，原生校验全体成员后才建卡', async () => {
  const run = runtime(501); await run.load(2);
  run.click('#commit'); await tick(); await run.controller.importWorkspaceTask.done;
  assert.equal(run.details.length, 501); assert.match(run.document.getElementById('result-text').textContent, /新建 501/);
});

test('篡改成员、重复选择及缺失分块都不会写卡，可刷新后重试', async () => {
  for (const ids of [[999], [100, 100], []]) {
    const run = runtime(); await run.load(2);
    run.browser.window.__DAGUANYUAN_IMPORT_WORKSPACE__.selectionChunk = () => JSON.stringify(ids);
    run.workspace.commit(run.controller, { token: run.controller.importWorkspaceTask.token, count: ids.length || 1, content: 'question' });
    await run.controller.importWorkspaceTask.done;
    assert.equal(run.details.length, 0); assert.equal(run.notes.size, 0);
    assert.match(run.document.getElementById('result-text').textContent, /不属于|重复|不完整/);
  }
});

test('切换学习集后拒绝旧列表导入，不向旧目标或新目标写入', async () => {
  const run = runtime(); await run.load(); run.selection.notebookId = 'other';
  assert.throws(() => run.workspace.commit(run.controller, { token: run.controller.importWorkspaceTask.token, count: 1, content: 'question' }), /学习集已切换/);
  assert.equal(run.details.length, 0); assert.equal(run.notes.size, 0);
});

test('下载期间切换学习集仍显示停止结果，不因读取新学习集状态而丢失回执', async () => {
  const run = runtime(); await run.load();
  const detail = run.native.__DAGUANYUAN_MATH_API_GLOBAL__.questionDetail;
  run.native.__DAGUANYUAN_MATH_API_GLOBAL__.questionDetail = async (...args) => { run.selection.notebookId = 'other'; return detail(...args); };
  run.click('#commit'); await tick(); await run.controller.importWorkspaceTask.done;
  assert.equal(run.notes.size, 0);
  assert.match(run.document.getElementById('result-text').textContent, /学习集已切换/);
  assert.equal(run.document.getElementById('stop').hidden, true);
});

test('MN Utils 缺失时提示安装并启用，不读取题目或建卡', async () => {
  const run = runtime(); delete run.native.MNUtil; await run.load();
  assert.equal(run.requests.length, 0); assert.equal(run.notes.size, 0);
  assert.match(run.document.getElementById('error').textContent, /请安装并启用 MN Utils/);
});

test('运行中停止保留已建题卡，取消剩余下载；新的读取不会混入迟到的列表', async () => {
  const run = runtime(25); await run.load(2);
  let secondWave;
  const detail = run.native.__DAGUANYUAN_MATH_API_GLOBAL__.questionDetail;
  run.native.__DAGUANYUAN_MATH_API_GLOBAL__.questionDetail = async (...args) => {
    if (args[0] === 120) await new Promise(resolve => { secondWave = resolve; });
    return detail(...args);
  };
  run.click('#commit'); await tick(); assert.equal(typeof secondWave, 'function');
  run.click('#stop'); await tick(); secondWave(); await run.controller.importWorkspaceTask.done;
  assert.match(run.document.getElementById('result-text').textContent, /新建 20/);
  assert.equal(run.notes.size, 24);
  assert.equal(run.document.getElementById('commit').disabled, true);
  run.click('#refresh'); await tick(); await run.controller.importWorkspaceTask.done;
  assert.equal(run.document.getElementById('commit').disabled, false);
});

test('读取中切换页面或分页重复都会废弃列表，不授权部分题目', async () => {
  for (const routeChange of [false, true]) {
    const run = runtime(25); await tick();
    const page = run.native.__DAGUANYUAN_MATH_API_GLOBAL__.questionPage;
    run.native.__DAGUANYUAN_MATH_API_GLOBAL__.questionPage = async (category, number, scope) => {
      if (number === 2) {
        if (routeChange) run.controller.activePage = 'math';
        else return page(category, 1, scope);
      }
      return page(category, number, scope);
    };
    await run.load(2);
    assert.equal(run.document.getElementById('commit').disabled, true);
    assert.match(run.document.getElementById('error').textContent, /停止|重复/);
    assert.equal(run.notes.size, 0);
  }
});

test('题库网页不能调用独立导入页命令，非法分类及范围被拒绝', async () => {
  const run = runtime(); await tick();
  assert.throws(() => run.commands.commands.getImportWorkspace({ controller: run.controller }), /导入页/);
  assert.throws(() => run.workspace.prepare(run.controller, { token: 'test', scope: 'bad', categoryIds: [3] }), /范围/);
  assert.throws(() => run.workspace.prepare(run.controller, { token: 'test', scope: 'complete', categoryIds: [999] }), /分类无效/);
  assert.throws(() => run.workspace.prepare(run.controller, { token: 'test', scope: 'complete', categoryIds: [3, 3] }), /分类无效或重复/);
});

test('没有本地数学分类时，导入页仍可独立在线加载和选题', async () => {
  const run = runtime();
  run.native.__DAGUANYUAN_CATEGORY_CATALOG_STORE_GLOBAL__.currentCatalog = () => { throw Error('不应读取本地分类'); };
  assert.equal(run.workspace.initialize().records.length, 0);
  await run.load(2);
  assert.ok(run.document.querySelector('[data-category="2"]'));
  assert.ok(run.document.querySelectorAll('.question-card').length > 0);
  run.click('#commit'); await tick(); await run.controller.importWorkspaceTask.done;
  assert.match(run.document.getElementById('result-text').textContent, /新建 3/);
  assert.equal(run.native.__DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.size, 0);
});

test('数学与408各级分类均可勾选，父分类递归包含后代且父子重选不重复', async () => {
  const run = runtime(); await tick();
  assert.deepEqual([...run.document.querySelectorAll('[data-category]')].map(n => Number(n.dataset.category)), [1, 2, 3, 4, 5]);
  const records = await run.native.__DAGUANYUAN_MATH_API_GLOBAL__.categoryRecords('complete', 'all');
  assert.deepEqual(Array.from(run.workspace.categoriesFor(records, [1, 2, 3])), [1, 2, 3, 4, 5]);
  assert.deepEqual(Array.from(run.workspace.categoriesFor(records, [3])), [3]);
  assert.deepEqual(Array.from(run.workspace.categoriesFor(records, [4, 2])), [2, 3, 4, 5]);
  await run.load(1);
  assert.deepEqual(run.requests.map(r => r.category), [1, 2, 3, 4, 5]);
  assert.equal(run.controller.importWorkspaceTask.questions.length, 3);
  run.click('[data-source="408"]'); await tick();
  assert.deepEqual([...run.document.querySelectorAll('[data-category]')].map(n => Number(n.dataset.category)), [10, 11]);
  run.select('[data-category="11"]', true); await tick(); await run.controller.importWorkspaceTask.done;
  assert.equal(run.controller.importWorkspaceTask.questions.length, 3);
});

test('408 先导入后面的分类再补前面分类，按目录插入并保留原卡和个人笔记', async () => {
  const { run, names } = instructionRuntime(); await tick(); run.click('[data-source="408"]'); await tick();
  run.select('[data-category="60"]', true); await tick(); await run.controller.importWorkspaceTask.done;
  run.click('#none'); run.select('[data-question="102"]', true); run.click('#commit'); await tick(); await run.controller.importWorkspaceTask.done;
  const chapter = [...run.notes.values()].find(n => n.noteTitle === '指令系统');
  const original = chapter.childNotes[0];
  const personal = run.native.Database.sharedInstance().createNoteWithTitleTopicid('个人笔记', 'study'); chapter.addChild(personal);
  run.click('#none'); run.select('[data-question="100"]', true); run.click('#commit'); await tick(); await run.controller.importWorkspaceTask.done;
  assert.deepEqual(chapter.childNotes.map(n => n.noteTitle), [names[0], names[2], '个人笔记']);
  assert.equal(chapter.childNotes[1], original);
  run.click('#commit'); await tick(); await run.controller.importWorkspaceTask.done;
  assert.deepEqual(chapter.childNotes.map(n => n.noteTitle), [names[0], names[2], '个人笔记']);
  assert.equal(chapter.childNotes[2], personal);
});

test('数学通过真实导入流程先导连续再补极限，章节按在线目录顺序插入', async () => {
  const run = runtime(2), api = run.native.__DAGUANYUAN_MATH_API_GLOBAL__;
  run.questions[0].categoryId = 5; run.questions[0].importCategoryId = 5;
  api.questionPage = async category => {
    const questions = run.questions.filter(q => q.categoryId === category);
    return { total: questions.length, pageSize: 20, questions };
  };
  await run.load(4); run.click('#commit'); await tick(); await run.controller.importWorkspaceTask.done;
  const subject = [...run.notes.values()].find(n => n.noteTitle === '高等数学');
  const original = subject.childNotes[0]; assert.equal(original.noteTitle, '连续');
  run.select('[data-category="4"]', false); await tick();
  run.select('[data-category="2"]', true); await tick(); await run.controller.importWorkspaceTask.done;
  run.click('#commit'); await tick(); await run.controller.importWorkspaceTask.done;
  assert.deepEqual(subject.childNotes.map(n => n.noteTitle), ['极限', '连续']);
  assert.equal(subject.childNotes[1], original);
  assert.equal([...run.notes.values()].filter(n => n.comments[1]?.text.includes('DAGUANYUAN_QUESTION_ID:')).length, 2);
});

test('备考科目同步筛选目录和所有分页，公共题来源混合仍保留，父分类不展开排除的分支', async () => {
  const run=runtime(25); await tick();
  const api=run.native.__DAGUANYUAN_MATH_API_GLOBAL__;
  const records=await api.categoryRecords('complete','all');
  api.categoryRecords=async (scope,subject)=>records.filter(r=>subject!=='math_2'||r[0]!==4);
  await run.load(2); run.requests.length=0;
  run.click('[data-exam-subject="math_2"]'); await tick(); await run.controller.importWorkspaceTask.done;
  assert.equal(run.document.querySelector('[data-category="4"]'),null);
  assert.deepEqual(run.requests.map(r=>[r.category,r.page]),[[2,1],[3,1],[3,2]]);
  assert.ok(run.requests.every(r=>r.examSubject==='math_2'));
  assert.equal(run.document.querySelectorAll('.question-card').length,25);
  assert.equal(run.stored.get('cn.marginnote.daguanyuan-bridge.import-workspace.exam-subject'),'math_2');
  run.click('[data-scope="core"]'); await tick(); await run.controller.importWorkspaceTask.done;
  assert.equal(run.document.querySelector('[data-exam-subject="math_2"]').getAttribute('aria-pressed'),'true');
  assert.equal(run.requests.at(-1).scope,'core');
});

test('切换科目移除不适用的已选分类和题目，旧列表不能继续导入；无选题也保存选择', async () => {
  const run=runtime(); await run.load(2); const old=run.controller.importWorkspaceTask;
  run.native.__DAGUANYUAN_MATH_API_GLOBAL__.categoryRecords=async()=>[[1,0,'高等数学'],[4,1,'其他适用分类']];
  run.requests.length=0; run.click('[data-exam-subject="math_3"]'); await tick();
  assert.equal(run.document.querySelector('[data-category="3"]'),null);
  assert.equal(run.document.querySelectorAll('.question-card').length,0); assert.equal(run.document.getElementById('commit').disabled,true);
  assert.equal(run.requests.length,0); assert.equal(run.stored.get('cn.marginnote.daguanyuan-bridge.import-workspace.exam-subject'),'math_3');
  assert.throws(()=>run.workspace.commit(run.controller,{token:old.token,count:1,content:'question'}),/已停止/);
});

test('旧偏好默认全部，数二偏好恢复，非法旧值回退全部，数学目录失败仍可使用408', async () => {
  for(const stored of ['math_2','bad']) {
    const run=runtime(); run.stored.set('cn.marginnote.daguanyuan-bridge.import-workspace.exam-subject',stored); await tick();
    assert.equal(run.document.querySelector('[data-exam-subject="'+(stored==='bad'?'all':stored)+'"]').getAttribute('aria-pressed'),'true');
  }
  const run=runtime(); await run.load();
  run.native.__DAGUANYUAN_MATH_API_GLOBAL__.categoryRecords=async()=>{throw Error('分类网络错误');};
  run.click('[data-exam-subject="math_1"]'); await tick();
  assert.match(run.document.getElementById('error').textContent,/分类网络错误/);
  assert.doesNotMatch(run.document.getElementById('empty').textContent,/正在读取/);
  assert.match(run.document.getElementById('empty').textContent,/分类读取失败/);
  assert.equal(run.document.getElementById('commit').disabled,true); assert.equal(run.document.querySelectorAll('#tree input').length,0);
  run.click('[data-source="408"]'); await tick();
  assert.equal(run.document.getElementById('exam-subject-field').hidden,true); assert.ok(run.document.querySelector('[data-category="10"]'));
});

test('导入结果保持右侧文档流，左侧筛选可继续使用并可收起详情', async () => {
  const run=runtime(); await run.load(); run.click('#commit'); await tick(); await run.controller.importWorkspaceTask.done;
  const result=run.document.getElementById('result');
  assert.ok(result.closest('.results')); assert.equal(result.closest('.filters'),null);
  assert.equal(run.document.querySelector('[data-exam-subject="math_1"]').disabled,false);
  run.click('#close-result'); assert.equal(result.hidden,true);
  run.click('[data-exam-subject="math_1"]'); await tick(); await run.controller.importWorkspaceTask.done;
  assert.equal(run.document.querySelector('[data-exam-subject="math_1"]').getAttribute('aria-pressed'),'true');
});

test('持续限流中止剩余批次，保留已经完成的题卡，并显示中断原因', async () => {
  const run = runtime(25); await run.load(2);
  const api = run.native.__DAGUANYUAN_MATH_API_GLOBAL__, original = api.questionDetail;
  api.questionDetail = async (...args) => {
    if (args[0] === 120) { const error = new Error('网站限流，请稍后重试'); error.rateLimited = true; error.stopImport = true; throw error; }
    return original(...args);
  };
  run.click('#commit'); await tick(); await run.controller.importWorkspaceTask.done;
  assert.equal(run.notes.size, 24);
  assert.match(run.document.getElementById('result-text').textContent, /新建 20[\s\S]*导入中断：网站限流/);
  assert.equal(run.document.getElementById('commit').disabled, true);
});


test('点击分类文字只展开收起，箭头状态同步，不勾选也不读取题目', async () => {
  const run = runtime(); await tick();
  run.requests.length = 0;
  run.document.querySelector('#tree .knowledge-name').dispatchEvent(new run.document.defaultView.Event('click', { bubbles: true }));
  await tick(); await run.controller.importWorkspaceTask?.done; await tick();
  assert.equal(run.requests.length, 0);
  assert.equal(run.document.querySelectorAll('.question-card').length, 0);
  assert.equal(run.document.querySelector('[data-category="1"]').checked, false);
  const toggle=run.document.querySelector('[data-toggle-category="1"]');
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(toggle.closest('.knowledge-node').querySelector('.knowledge-tree').hidden, false);
  const name = toggle.closest('.knowledge-row').querySelector('.knowledge-name');
  assert.equal(name.getAttribute('aria-expanded'), 'true');
  run.click('#tree .knowledge-name');
  assert.equal(toggle.getAttribute('aria-expanded'), 'false'); assert.equal(name.getAttribute('aria-expanded'), 'false');
  assert.equal(toggle.closest('.knowledge-node').querySelector('.knowledge-tree').hidden, true);
  assert.equal(run.document.querySelectorAll('#tree input:checked').length, 0);
});

test('只有方框更改分类选择，勾选不触发展开，点击末级文字保持原有勾选与题目', async () => {
  const run = runtime(); await tick();
  run.requests.length=0;
  run.click('[data-toggle-category="1"]');
  const toggle=run.document.querySelector('[data-toggle-category="1"]');
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(toggle.closest('.knowledge-node').querySelector('.knowledge-tree').hidden, false);
  assert.equal(run.requests.length, 0);
  run.select('[data-category="2"]', true); await tick(); await run.controller.importWorkspaceTask.done; await tick();
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  run.requests.length=0;
  run.document.querySelector('[data-category-row="5"]').querySelector('.knowledge-name').dispatchEvent(new run.document.defaultView.Event('click', { bubbles: true }));
  await tick();
  assert.equal(run.document.querySelector('[data-category="2"]').checked, true);
  assert.equal(run.document.querySelector('[data-category="5"]').checked, false);
  assert.equal(run.requests.length, 0);
  assert.equal(run.document.querySelectorAll('.question-card').length, 3);
  run.requests.length=0; run.click('[data-toggle-category="1"]');
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(run.requests.length, 0);
});

test('同层级名称对齐，分支名称为展开按钮，末级名称是普通文字', async () => {
  const run=runtime(); await tick();
  const branch=run.document.querySelector('[data-category="2"]').closest('.knowledge-row');
  const leaf=run.document.querySelector('[data-category-row="5"]');
  assert.equal(branch.firstElementChild.className, 'knowledge-toggle');
  assert.equal(leaf.firstElementChild.className, 'knowledge-toggle-placeholder');
  assert.equal(branch.querySelector('.knowledge-name').tagName, 'BUTTON');
  assert.equal(leaf.querySelector('.knowledge-name').tagName, 'SPAN');
  assert.equal(run.document.querySelectorAll('summary.knowledge-row').length, 0);
});
