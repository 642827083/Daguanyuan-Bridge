import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function runtime(options = {}) {
  const notebook = { topicId: 'study', notebookId: 'study', notes: [] };
  const selection = { notebookId: 'study' };
  const notes = new Map(), creations = [], refreshes = [], foldWrites = [], stored = new Map();
  let inUndo = false;
  let serial = 0, requests = 0;
  const question = { id: 123, source: '2026年 第1题', categoryId: 1, stem: '题干', options: ['甲'] };
  function create(title, topic) {
    assert.equal(topic, 'study');
    creations.push({ title, topic });
    const note = { noteId: `n${++serial}`, notebookId: topic, noteTitle: title, comments: [], childNotes: [],
      appendMarkdownComment(text) { this.comments.push({ text }); },
      commentState() { return { ok: true, revision: 'revision-' + this.noteId, comments: this.comments.map((c, i) => ({ ...c, index: i + 1, collapsed: Boolean(c.collapsed) })) }; },
      setCommentsCollapsed(targets, collapsed, revision) {
        assert.equal(inUndo, false, '折叠接口应在导入撤销组外执行');
        assert.ok(refreshes.length, '题卡必须先保存刷新');
        foldWrites.push({ noteId: this.noteId, targets: JSON.parse(JSON.stringify(targets)), collapsed, revision });
        if (options.foldError) return { ok: false, error: { code: 'SAVE_FAILED', message: '折叠保存失败' } };
        this.comments[targets[0].index - 1].collapsed = collapsed; return { ok: true, persisted: true };
      },
      addChild(child) { child.parentNote = this; this.childNotes.push(child); notebook.notes = notebook.notes.filter(n => n !== child); },
    };
    notes.set(note.noteId, note); notebook.notes.push(note); return note;
  }
  const study = { notebookController: selection };
  if (options.reader) Object.defineProperty(study, 'readerController', { get() { throw new Error('导入不应读取当前文档'); } });
  const database = { getNotebookById(id) { return id === 'study' ? notebook : undefined; }, getNoteById(id) { return notes.get(id); }, createNoteWithTitleTopicid: create };
  const context = { console,
    Application: { sharedInstance() { return { studyController() { return study; }, refreshAfterDBChanged(id) { refreshes.push(id); } }; } },
    Database: { sharedInstance() { return database; } },
    Note: { createWithTitleNotebookDocument() { throw new Error('导入不应使用文档工厂'); } },
    MNUtil: { getNoteById(id) { return notes.get(id); } },
    UndoManager: { sharedInstance() { return { undoGrouping(label, topic, fn) { assert.equal(topic, 'study'); inUndo = true; try { fn(); } finally { inUndo = false; } } }; } },
    NSUserDefaults: { standardUserDefaults() { return { objectForKey: key => stored.get(key), setObjectForKey: (v, k) => stored.set(k, v) }; } },
    __DAGUANYUAN_MATH_API_GLOBAL__: { positiveInteger: Number, questionScope: String,
      async questionPage() { requests++; return { total: 1, pageSize: 20, questions: [question] }; },
      async questionDetail() { return question; },
    },
    __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__: { resultForCategoryId() { return { status: 'resolved', categoryId: 1, path: ['数学', '分类'] }; }, urlFor() { return 'https://www.cxyonly.fans/math/practice/1'; } },
  };
  vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../src/DaguanyuanSourceLink.js', import.meta.url), 'utf8'), context);
  vm.runInContext(readFileSync(new URL('../src/DaguanyuanCardComments.js', import.meta.url), 'utf8'), context);
  vm.runInContext(readFileSync(new URL('../src/DaguanyuanCommentFold.js', import.meta.url), 'utf8'), context);
  context.__DAGUANYUAN_COMMENT_FOLD_GLOBAL__.setEnabled(Boolean(options.fold));
  vm.runInContext(readFileSync(new URL('../src/DaguanyuanMathImport.js', import.meta.url), 'utf8'), context);
  return { context, notebook, selection, notes, creations, refreshes, question, database, foldWrites,
    writer: context.__DAGUANYUAN_MATH_IMPORT_GLOBAL__, addon: { window: {} }, get requests() { return requests; } };
}

test('数学、408、导入本题均在建卡保存后折叠原题评论，关闭时不调用折叠接口', async () => {
  for (const provider of ['math', '408', 'single']) for (const enabled of [false, true]) {
    const r = runtime({ fold: enabled });
    if (provider === 'single') {
      const parent = r.database.createNoteWithTitleTopicid('父卡', 'study'); r.selection.focusNote = parent;
      r.writer.preparedSingleSession(r.addon, 'math').write(r.question);
    } else await importOnce(r, provider);
    assert.equal(r.foldWrites.length, enabled ? 1 : 0);
    if (enabled) assert.deepEqual(r.foldWrites[0].targets, [{ index: 2 }]);
  }
});

test('仅折叠新建题卡原题评论，答案子卡正文保持展开，折叠失败返回独立警告', async () => {
  const r = runtime({ fold: true }); r.question.answer = '答案'; r.question.explanation = '解析';
  const result = await r.writer.preparedMathSession(r.addon).importQuestions([123], { 123: 1 }, 'questionAnswer');
  assert.equal(result.createdCount, 1); assert.equal(r.foldWrites.length, 1);
  const card = [...r.notes.values()].find(n => r.writer.linkedQuestion(n)?.id === 123);
  assert.equal(r.foldWrites[0].noteId, card.noteId);
  assert.ok(card.childNotes[0].comments.every(c => !c.collapsed));
  const failed = runtime({ fold: true, foldError: true });
  const outcome = await importOnce(failed, 'math');
  assert.equal(outcome.createdCount, 1); assert.equal(outcome.failed.length, 0); assert.equal(outcome.commentFoldWarnings.length, 1);
  assert.ok([...failed.notes.values()].some(n => failed.writer.linkedQuestion(n)?.id === 123));
});

async function importOnce(run, provider) {
  return provider === 'math' ? run.writer.importCategory(run.addon, 1, 'complete')
    : run.writer.prepared408Session(run.addon).write(run.question, { title: '2026年真题', url: 'https://www.408os.cn/exercise?year=2026' });
}

for (const provider of ['math', '408']) {
  for (const reader of [false, true]) test(`${provider} 分类导入在纯学习集建卡，${reader ? '不读取打开的文档' : '没有阅读器也可导入'}，重导查重`, async () => {
    const run = runtime({ reader });
    const result = await importOnce(run, provider);
    assert.equal(provider === 'math' ? result.createdCount : result, provider === 'math' ? 1 : true);
    const card = [...run.notes.values()].find(n => run.writer.linkedQuestion(n)?.id === 123);
    assert.equal(card.parentNote.noteTitle, provider === 'math' ? '分类' : '2026年真题');
    assert.ok(run.creations.length > 1);
    assert.ok(run.creations.every(item => item.topic === 'study'));
    assert.ok(run.refreshes.every(id => id === 'study'));
    const before = run.creations.length;
    const again = await importOnce(run, provider);
    assert.equal(provider === 'math' ? again.skippedCount : again, provider === 'math' ? 1 : false);
    assert.equal(run.creations.length, before);
  });
}

test('学习集缺少 topicId 时依次使用自身 notebookId 与当前学习集 ID', async () => {
  for (const removeNotebookId of [false, true]) {
    const run = runtime(); delete run.notebook.topicId;
    if (removeNotebookId) delete run.notebook.notebookId;
    const result = await importOnce(run, 'math');
    assert.equal(result.createdCount, 1); assert.equal(result.failed.length, 0);
  }
});

test('学习集建卡兼容 Database 全局工厂', async () => {
  const run = runtime();
  run.context.Database.createNoteWithTitleTopicid = run.database.createNoteWithTitleTopicid;
  delete run.database.createNoteWithTitleTopicid;
  assert.equal(await importOnce(run, '408'), true);
  assert.ok(run.creations.length > 1);
});

test('缺少学习集建卡接口时给出明确原因，不创建卡片', async () => {
  const run = runtime(); delete run.database.createNoteWithTitleTopicid;
  await assert.rejects(importOnce(run, '408'), /当前 MarginNote 版本无法在学习集中创建卡片/);
  assert.equal(run.creations.length, 0);
});

test('未打开学习集时提示打开学习集，不提示需要文档，也不读取题目', () => {
  const run = runtime(); run.selection.notebookId = '';
  assert.throws(() => run.writer.importCategory(run.addon, 1, 'complete'), /请先打开要导入题目的 MarginNote 学习集/);
  assert.equal(run.requests, 0); assert.equal(run.creations.length, 0);
});

test('导入确认仅显示学习集名称，兼容 title/name，不附加目录或内部 ID', async () => {
  for (const [names, expected] of [
    [{ title: '考研数学', name: '备用名称' }, '考研数学'],
    [{ title: () => '函数返回的名称' }, '函数返回的名称'],
    [{ title: ' ', name: '复习学习集' }, '复习学习集'],
    [{}, '当前学习集'],
  ]) {
    const run = runtime(); Object.assign(run.notebook, names);
    let target;
    await run.writer.importCategory(run.addon, 1, 'core', null, plan => { target = plan.target; return false; });
    assert.equal(target, expected);
    assert.equal(run.writer.prepared408Session(run.addon).targetTitle, expected);
    assert.equal(run.creations.length, 0);
  }
});

test('数学分类先收集全部分页，再确认实际数量；取消不下载题图和写卡', async () => {
  const run = runtime(); let confirm, details = 0; const pages = [];
  const api = run.context.__DAGUANYUAN_MATH_API_GLOBAL__;
  api.questionPage = async (category, page) => {
    pages.push(page);
    return { total: 3, pageSize: 2, questions: page === 1 ? [{ id: 123 }, { id: 124 }] : [{ id: 125 }] };
  };
  api.questionDetail = async () => { details++; return run.question; };
  const pending = run.writer.importCategory(run.addon, 1, 'core', null, plan => {
    assert.deepEqual(pages, [1, 2]);
    assert.equal(plan.questions.length, 3);
    assert.match(plan.source, /严选/); assert.equal(plan.target, '当前学习集');
    return new Promise(resolve => { confirm = resolve; });
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(run.creations.length, 0); assert.equal(details, 0);
  confirm(false);
  const result = await pending;
  assert.equal(result.cancelled, true); assert.equal(result.total, 3);
  assert.equal(details, 0); assert.equal(run.creations.length, 0);
});

test('数学分类确认后沿用已读取的列表，不重新选范围；切换学习集则停止', async () => {
  for (const switched of [false, true]) {
    const run = runtime();
    const pending = run.writer.importCategory(run.addon, 1, 'core', null, () => {
      run.context.__DAGUANYUAN_MATH_API_GLOBAL__.questionPage = () => { throw Error('不应重新读取列表'); };
      if (switched) run.selection.notebookId = 'other';
      return true;
    });
    if (switched) {
      await assert.rejects(pending, /目标学习集已切换/);
      assert.equal(run.creations.length, 0);
    } else assert.equal((await pending).createdCount, 1);
  }
});

test('数学分类分页数量不一致时不确认、不写卡，错误保留计数', async () => {
  const run = runtime();
  run.context.__DAGUANYUAN_MATH_API_GLOBAL__.questionPage = async () => ({ total: 3, pageSize: 20, questions: [run.question] });
  await assert.rejects(run.writer.importCategory(run.addon, 1, 'complete', null, () => { throw Error('不能确认'); }), error => {
    assert.match(error.message, /数量已变化/);
    assert.equal(error.importResult.createdCount, 0); return true;
  });
  assert.equal(run.creations.length, 0);
});

test('408 分类写入在目标学习集切换时停止，不向旧学习集继续写卡', () => {
  const run = runtime(); const session = run.writer.prepared408Session(run.addon);
  run.selection.notebookId = 'other';
  assert.throws(() => session.write(run.question, { title: '分类', url: 'https://www.408os.cn/exercise?year=2026' }), /目标学习集已切换/);
  assert.equal(run.creations.length, 0);
});

test('数学跨页选题仅下载和写入所选题，保持题库原顺序', async () => {
  const run = runtime(), requested = [];
  const questions = [123, 124, 125].map(id => ({ ...run.question, id }));
  const api = run.context.__DAGUANYUAN_MATH_API_GLOBAL__;
  api.questionPage = async (id, page) => ({ total: 3, pageSize: 2, questions: questions.slice((page - 1) * 2, page * 2) });
  api.questionDetail = async id => { requested.push(id); return questions.find(q => q.id === id); };
  const result = await run.writer.importCategory(run.addon, 1, 'core', null, () => [125, 123]);
  assert.equal(result.total, 2); assert.equal(result.createdCount, 2);
  assert.deepEqual(requested, [123, 125]);
  const cards = [...run.notes.values()].map(n => run.writer.linkedQuestion(n)?.id).filter(Boolean);
  assert.deepEqual(cards, [123, 125]);
});

test('数学拒绝不属于列表或重复的选题，取消检查阻止题图下载后的写入', async () => {
  for (const selected of [[999], [123, 123], []]) {
    const run = runtime();
    await assert.rejects(run.writer.importCategory(run.addon, 1, 'core', null, () => selected), /至少选择|不属于|重复/);
    assert.equal(run.creations.length, 0);
  }
  const run = runtime(); let cancelled = false;
  const confirm = () => [123]; confirm.check = () => { if (cancelled) throw Error('停止测试'); };
  run.context.__DAGUANYUAN_MATH_API_GLOBAL__.questionDetail = async () => { cancelled = true; return run.question; };
  await assert.rejects(run.writer.importCategory(run.addon, 1, 'core', null, confirm), /停止测试/);
  assert.equal(run.creations.length, 0);
});
