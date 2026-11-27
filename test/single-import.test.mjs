import { withMathSite } from './helpers/math-site.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function runtime() {
  const notebook = { topicId: 'book-1', notes: [] };
  const controller = { notebookId: 'book-1', focusNote: null };
  const notes = new Map(), timers = [], requests = [], deleted = [], prepares = [], stored = new Map();
  const document = { md5: 'doc-1' };
  let serial = 0, complete, payload = '', imageFailure = false;
  const question = { id: 843, categoryId: 1, source: '2026年 第44题', stem: '题干 ![图](data:image/png;base64,AQID)', hasBase64Image: true, options: ['甲'] };
  function create(title) {
    const note = { noteId: `note-${++serial}`, notebookId: 'book-1', noteTitle: title, comments: [], childNotes: [],
      appendMarkdownComment(text) { this.comments.push({ text }); },
      removeCommentByIndex(index) { this.comments.splice(index, 1); },
      sortCommentsByNewIndices(indices) { const before = this.comments.slice(); indices.forEach((position, old) => { this.comments[position] = before[old]; }); },
      addChild(child) { child.parentNote = this; this.childNotes.push(child); notebook.notes = notebook.notes.filter(n => n !== child); },
      insertChildBefore(child, before) {
        const index = this.childNotes.indexOf(before);
        assert.ok(index >= 0);
        child.parentNote = this; this.childNotes.splice(index, 0, child);
        notebook.notes = notebook.notes.filter(n => n !== child);
      },
      processMarkdownBase64Images() {
        if (imageFailure) return false;
        this.comments.forEach(c => { c.text = c.text.replace(/data:image\/[^)]+/g, 'marginnote-media://image.png'); });
        this.mediaList = 'image.png'; return true;
      } };
    notes.set(note.noteId, note); notebook.notes.push(note); return note;
  }
  const database = {
    getNotebookById(id) { return id === 'book-1' ? notebook : null; }, getNoteById(id) { return notes.get(id); },
    getDocumentById(id) { assert.equal(id, 'doc-1'); return document; },
    createNoteWithTitleTopicid(title, topic) { assert.equal(topic, 'book-1'); return create(title); },
    deleteBookNoteTree(id) {
      const note = notes.get(id); if (note.parentNote) note.parentNote.childNotes = note.parentNote.childNotes.filter(n => n !== note);
      notebook.notes = notebook.notes.filter(n => n !== note); notes.delete(id); deleted.push(id);
    },
  };
  const study = { notebookController: controller, readerController: { currentDocumentController: { document } } };
  const context = { console, MNNote: { new(id) { return notes.get(id); } }, Application: { sharedInstance() { return { studyController() { return study; }, refreshAfterDBChanged() {} }; } },
    NSUserDefaults: { standardUserDefaults() { return {
      objectForKey(key) { return stored.get(key); }, setObjectForKey(value, key) { stored.set(key, value); },
    }; } },
    Database: { sharedInstance() { return database; } },
    Note: { createWithTitleNotebookDocument(title, book, doc) { assert.equal(book, notebook); assert.equal(doc, document); return create(title); } },
    UndoManager: { sharedInstance() { return { undoGrouping(label, topic, fn) { assert.equal(topic, 'book-1'); fn(); } }; } },
    NSTimer: { scheduledTimerWithTimeInterval(seconds, repeat, action) { const timer = { seconds, active: true, invalidate() { this.active = false; }, fire() { if (this.active) action(); } }; timers.push(timer); return timer; } },
    __DAGUANYUAN_MATH_API_GLOBAL__: {
      positiveInteger(value) { const id = Number(value); if (!Number.isSafeInteger(id) || id < 1) throw Error('ID 无效'); return id; },
      questionDetail(id) { requests.push(id); return new Promise(resolve => { complete = resolve; }); },
    },
    __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__: { resultForCategoryId() { return {}; }, urlFor() { return 'https://www.cxyonly.fans/math/practice/1'; } },
  };
  const category = { title: '2026年真题', url: 'https://www.408os.cn/exercise?year=2026' };
  const page = {
    read() { return JSON.stringify({ ready: true, length: payload.length }); },
    chunk(key, offset) { return payload.slice(offset, offset + 65536); },
    prepare(key, index) { prepares.push(index); payload = JSON.stringify({ question }); return true; }, cancel() { return true; },
  };
  context.window = { __DAGUANYUAN_408_IMPORT_PAGE__: page };
  vm.createContext(context);
  for (const file of ['DaguanyuanSourceLink', 'DaguanyuanCardComments', 'DaguanyuanMathImport', 'Daguanyuan408Page', 'Daguanyuan408Import', 'DaguanyuanSingleImport']) {
    vm.runInContext(withMathSite(readFileSync(new URL(`../src/${file}.js`, import.meta.url), 'utf8')), context);
  }
  const panel = { addon: { window: {} }, webView: { evaluateJavaScript(script, callback) {
    if (script.startsWith('String((function pageReceiver')) {
      const target = JSON.parse(script.match(/,(\{[^{}]+\}|null)\)\)$/)[1]);
      assert.equal(target.year, 2026); assert.equal(target.number, 44);
      payload = JSON.stringify({ category, ids: [843] }); callback('true');
    } else callback(vm.runInContext(script, context));
  } } };
  const parent = create('父卡片'); controller.focusNote = parent;
  return { context, controller, study, database, notes, notebook, parent, panel, create, question, timers, requests, deleted, prepares, stored,
    importer: context.__DAGUANYUAN_SINGLE_IMPORT_GLOBAL__, writer: context.__DAGUANYUAN_MATH_IMPORT_GLOBAL__,
    complete() { complete(question); }, failImages(value) { imageFailure = value; } };
}
const math = { provider: 'math', id: 843, url: 'https://www.cxyonly.fans/math/practice/1' };
const os408 = { provider: '408', year: 2026, number: 44, url: 'https://www.408os.cn/exercise?year=2026' };

test('数学和408单题确认前不写入，取消不留题卡；确认后仍使用原父节点', async () => {
  for (const target of [math, os408]) for (const accepted of [true, false]) {
    const run = runtime(); run.notebook.name = '复习学习集'; let confirm;
    const operation = run.importer.importQuestion(run.panel, target, 'child', plan => {
      assert.equal(plan.questions.length, 1);
      assert.equal(plan.target, '复习学习集');
      return new Promise(resolve => { confirm = resolve; });
    });
    if (target === math) run.complete();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(run.parent.childNotes.length, 0);
    const next = run.create('另一张卡'); run.controller.focusNote = next;
    confirm(accepted);
    const result = await operation;
    assert.equal(result.createdCount, accepted ? 1 : 0);
    assert.equal(run.parent.childNotes.length, accepted ? 1 : 0);
    assert.equal(next.childNotes.length, 0);
    if (!accepted) { assert.equal(result.cancelled, true); assert.equal(run.prepares.length, 0); }
  }
});

test('数学和408单题在确认时切换学习集后不写入', async () => {
  for (const target of [math, os408]) {
    const run = runtime();
    const operation = run.importer.importQuestion(run.panel, target, 'child', () => {
      run.controller.notebookId = 'other'; return true;
    });
    if (target === math) run.complete();
    const result = await operation;
    assert.equal(result.createdCount, 0);
    assert.match(result.failed[0].reason, /笔记本已切换/);
    assert.equal(run.parent.childNotes.length, 0);
  }
});

test('单题导入位置默认子节点，设置持久化并拒绝无效选项', () => {
  const run = runtime();
  assert.equal(run.importer.position(), 'child');
  run.importer.setPosition('sibling');
  assert.equal(run.importer.position(), 'sibling');
  assert.equal(run.stored.get('cn.marginnote.daguanyuan-bridge.question-tools.single-import-position'), 'sibling');
  assert.throws(() => run.importer.setPosition('invalid'), /导入本题位置无效/);
  assert.equal(run.importer.position(), 'sibling');
});

test('数学和408单题插入所选卡片之后，原有同级顺序及子节点保持', async () => {
  for (const target of [math, os408]) {
    const run = runtime();
    const group = run.create('题型'), before = run.create('前一题'), after = run.create('后一题');
    group.addChild(before); group.addChild(run.parent); group.addChild(after);
    run.importer.setPosition('sibling');
    const operation = run.importer.importQuestion(run.panel, target);
    if (target === math) run.complete();
    assert.equal((await operation).createdCount, 1);
    assert.equal(group.childNotes.length, 4);
    assert.equal(group.childNotes[0], before); assert.equal(group.childNotes[1], run.parent);
    assert.equal(group.childNotes[3], after);
    assert.equal(run.writer.linkedQuestion(group.childNotes[2]).id, 843);
    assert.equal(group.childNotes[2].parentNote, group);
    assert.equal(run.parent.childNotes.length, 0);
  }
});

test('选择最后一个同级节点时，单题追加到同一父节点末尾', async () => {
  const run = runtime(), group = run.create('题型');
  group.addChild(run.parent); run.importer.setPosition('sibling');
  const operation = run.importer.importQuestion(run.panel, math); run.complete();
  assert.equal((await operation).createdCount, 1);
  assert.equal(group.childNotes[0], run.parent);
  assert.equal(run.writer.linkedQuestion(group.childNotes[1]).id, 843);
});

test('兄弟节点导入在异步读取前固定所选卡片及位置，之后切换选择和设置不影响本次', async () => {
  const run = runtime(), group = run.create('题型');
  group.addChild(run.parent); run.importer.setPosition('sibling');
  const operation = run.importer.importQuestion(run.panel, math);
  run.controller.focusNote = run.create('另一张'); run.importer.setPosition('child');
  run.complete(); assert.equal((await operation).createdCount, 1);
  assert.equal(group.childNotes.length, 2);
  assert.equal(run.parent.childNotes.length, 0);
  assert.equal(run.controller.focusNote.childNotes.length, 0);
});

test('兄弟节点按同一父节点查重，跳过已有题卡不移动，其他来源独立', async () => {
  const run = runtime(), group = run.create('题型');
  group.addChild(run.parent); run.importer.setPosition('sibling');
  async function importMath() { const operation = run.importer.importQuestion(run.panel, math); run.complete(); return operation; }
  await importMath(); const card = group.childNotes[1], other = run.create('中间题');
  group.insertChildBefore(other, card);
  assert.equal((await importMath()).skippedCount, 1);
  run.question.stem = '更新题干'; run.question.hasBase64Image = false;
  assert.equal((await importMath()).skippedCount, 1);
  assert.equal(group.childNotes[2], card);
  assert.equal((await run.importer.importQuestion(run.panel, os408)).createdCount, 1);
  assert.equal(group.childNotes.length, 4);
  assert.equal(run.writer.linkedQuestion(group.childNotes[1]).provider, '408');
});

test('兄弟节点导入期间原卡片改换父节点时停止，不导入到新的位置', async () => {
  const run = runtime(), group = run.create('题型'), movedTo = run.create('新题型');
  group.addChild(run.parent); run.importer.setPosition('sibling');
  const operation = run.importer.importQuestion(run.panel, math);
  group.childNotes = []; movedTo.addChild(run.parent);
  run.complete(); const result = await operation;
  assert.equal(result.createdCount, 0); assert.match(result.failed[0].reason, /父节点.*变化/);
  assert.equal(group.childNotes.length, 0); assert.equal(movedTo.childNotes.length, 1);
});

test('兄弟节点模式遇到顶层卡片或缺少插入接口时先提示，不读取题目', () => {
  for (const missing of ['parent', 'method']) {
    const run = runtime();
    if (missing === 'method') {
      const group = run.create('题型'), next = run.create('下一题');
      group.addChild(run.parent); group.addChild(next); group.insertChildBefore = undefined;
    }
    run.importer.setPosition('sibling');
    assert.throws(() => run.importer.importQuestion(run.panel, math), missing === 'parent' ? /没有父节点/ : /不支持.*插入/);
    assert.equal(run.requests.length, 0);
  }
});

test('兄弟节点插入接口抛错或未完成插入时清理新卡片，保留原有同级顺序', async () => {
  for (const failure of ['throw', 'no-op']) {
    const run = runtime(), group = run.create('题型'), next = run.create('下一题');
    group.addChild(run.parent); group.addChild(next); run.importer.setPosition('sibling');
    const insert = group.insertChildBefore;
    group.insertChildBefore = function (card, before) {
      if (failure === 'throw') { insert.call(this, card, before); throw Error('插入失败'); }
    };
    const operation = run.importer.importQuestion(run.panel, math); run.complete();
    const result = await operation;
    assert.equal(result.createdCount, 0); assert.equal(result.failed.length, 1);
    assert.deepEqual(group.childNotes, [run.parent, next]);
    assert.equal(run.notes.size, 3); assert.equal(run.deleted.length, 1);
    assert.equal(run.notebook.notes.length, 1);
  }
});

test('兄弟节点导入期间删除所选卡片或父节点时停止建卡', async () => {
  for (const removed of ['selected', 'parent']) {
    const run = runtime(), group = run.create('题型');
    group.addChild(run.parent); run.importer.setPosition('sibling');
    const operation = run.importer.importQuestion(run.panel, math);
    run.notes.delete(removed === 'selected' ? run.parent.noteId : group.noteId);
    run.complete(); const result = await operation;
    assert.equal(result.createdCount, 0); assert.match(result.failed[0].reason, /已删除/);
    assert.equal(run.deleted.length, 0);
  }
});

test('数学只导入所点击题，图片保存为固定父卡片的直接子节点', async () => {
  const run = runtime();
  const promise = run.importer.importQuestion(run.panel, math);
  run.controller.focusNote = run.create('另一张卡片'); run.complete();
  const result = await promise;
  assert.equal(result.createdCount, 1); assert.deepEqual(run.requests, [843]);
  assert.equal(run.parent.childNotes.length, 1); assert.equal(run.controller.focusNote.childNotes.length, 0);
  assert.match(run.parent.childNotes[0].comments[0].text, /marginnote-media:\/\/image.png/);
  assert.equal(run.notebook.notes.some(n => n.noteTitle === 'Daguanyuan Bridge'), false);
});

test('408 只转换并建卡一道带图题，不创建分类路径', async () => {
  const run = runtime();
  const operation = run.importer.importQuestion(run.panel, os408);
  run.controller.focusNote = run.create('另一张卡片');
  const result = await operation;
  assert.equal(result.total, 1); assert.equal(result.createdCount, 1); assert.deepEqual(run.prepares, [0]);
  assert.equal(run.parent.childNotes.length, 1); assert.equal(run.controller.focusNote.childNotes.length, 0);
  assert.match(run.parent.childNotes[0].comments[1].text, /DAGUANYUAN_408_QUESTION_ID:843/);
  assert.match(run.parent.childNotes[0].comments[0].text, /marginnote-media/);
  assert.equal(run.notebook.notes.length, 2);
});

test('同一父节点重复题目跳过，其他父节点、孙节点和其他来源独立', async () => {
  const run = runtime();
  const first = run.importer.importQuestion(run.panel, math); run.complete(); await first;
  const repeated = run.importer.importQuestion(run.panel, math); run.complete();
  assert.equal((await repeated).skippedCount, 1);
  assert.equal(run.requests.length, 1);
  assert.equal((await run.importer.importQuestion(run.panel, os408)).createdCount, 1);
  run.controller.focusNote = run.create('另一张父卡片');
  const grandparent = run.controller.focusNote;
  grandparent.addChild(run.parent);
  const second = run.importer.importQuestion(run.panel, math); run.complete();
  assert.equal((await second).createdCount, 1);
  assert.equal(grandparent.childNotes.length, 2);
});

test('未选父卡片时不发请求、不创建卡片', () => {
  for (const target of [math, os408]) {
    const run = runtime(); run.controller.focusNote = null;
    assert.throws(() => run.importer.importQuestion(run.panel, target), /选中一张父卡片/);
    assert.equal(run.requests.length, 0); assert.equal(run.notes.size, 1);
  }
});

test('数学与408单题再次导入跳过原卡，保持父节点、独立笔记和子卡片', async () => {
  for (const target of [math, os408]) {
    const run = runtime();
    async function importOnce() {
      const promise = run.importer.importQuestion(run.panel, target); if (target === math) run.complete(); return promise;
    }
    await importOnce(); const card = run.parent.childNotes[0];
    const personal = { text: '我的笔记' }; card.comments.push(personal); const child = run.create('子节点'); card.addChild(child);
    run.question.stem = '新题干 $x$'; run.question.hasBase64Image = false;
    assert.equal((await importOnce()).skippedCount, 1);
    assert.equal(run.parent.childNotes[0], card); assert.equal(card.childNotes[0], child); assert.equal(card.comments[2], personal);
    assert.doesNotMatch(card.comments[0].text, /新题干/); assert.match(card.comments[1].text, /DAGUANYUAN_SINGLE_IMPORT:1/);
    assert.equal((await importOnce()).skippedCount, 1);
    run.database.deleteBookNoteTree(card.noteId);
    assert.equal((await importOnce()).createdCount, 1);
  }
});

test('父卡片删除、移出笔记本或切换笔记本后停止建卡', async () => {
  for (const change of [r => r.notes.delete(r.parent.noteId), r => { r.parent.notebookId = 'other'; }, r => { r.controller.notebookId = 'other'; }]) {
    const run = runtime(); const operation = run.importer.importQuestion(run.panel, math);
    change(run); run.complete(); const result = await operation;
    assert.equal(result.createdCount, 0); assert.match(result.failed[0].reason, /父卡片已删除或笔记本已切换/);
    assert.equal(run.parent.childNotes.length, 0);
  }
});

test('带图题保存失败时删除新卡片，父节点不残留失败子卡片，重试可成功', async () => {
  for (const target of [math, os408]) {
    const run = runtime(); run.failImages(true);
    const operation = run.importer.importQuestion(run.panel, target); if (target === math) run.complete();
    const failed = await operation;
    assert.equal(failed.createdCount, 0); assert.equal(failed.failed.length, 1);
    assert.equal(failed.failed[0].stage, 'MarginNote 保存图片'); assert.equal(run.deleted.length, 1);
    assert.equal(run.parent.childNotes.length, 0);
    run.failImages(false);
    const retry = run.importer.importQuestion(run.panel, target); if (target === math) run.complete();
    assert.equal((await retry).createdCount, 1);
  }
});

test('数学单题取题超时后返回失败，迟到的网络回调不再建卡', async () => {
  const run = runtime(); const operation = run.importer.importQuestion(run.panel, math);
  run.timers.find(t => t.seconds === 75).fire();
  assert.match((await operation).failed[0].reason, /读取超时/);
  run.complete(); await Promise.resolve(); assert.equal(run.parent.childNotes.length, 0);
});

test('数学和408单题在纯学习集中创建子节点或同级节点，不依赖来源文档', async () => {
  for (const target of [math, os408]) for (const position of ['child', 'sibling']) {
    const run = runtime(); run.study.readerController = null;
    run.parent.docMd5 = '不存在的文档';
    run.database.getDocumentById = () => { throw new Error('不应查询来源文档'); };
    run.context.Note.createWithTitleNotebookDocument = () => { throw new Error('不应使用文档工厂'); };
    const group = position === 'sibling' ? run.create('父节点') : run.parent;
    if (position === 'sibling') group.addChild(run.parent);
    const operation = run.importer.importQuestion(run.panel, target, position);
    if (target === math) run.complete();
    assert.equal((await operation).createdCount, 1);
    assert.equal(group.childNotes.length, position === 'child' ? 1 : 2);
    assert.equal(group.childNotes[group.childNotes.length - 1].parentNote, group);
  }
});

test('单题卡片保留点击页面来源，不用所选父节点的分类改写定位地址', async () => {
  const run = runtime();
  run.question.categoryId = 999;
  run.context.__DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.resolve = () => ({ status: 'resolved', matchedSegments: 1, categoryId: 999 });
  const operation = run.importer.importQuestion(run.panel, { ...math, url: 'https://www.cxyonly.fans/math/practice/2?questionId=1' });
  run.complete(); assert.equal((await operation).createdCount, 1);
  const link = run.writer.linkedQuestion(run.parent.childNotes[0]);
  assert.equal(link.id, 843); assert.equal(link.url, 'https://www.cxyonly.fans/math/practice/2?questionId=843');
});

test('单题命令验证来源、题号和页面地址', () => {
  const run = runtime();
  const address = target => `daguanyuanbridge://import-single?payload=${encodeURIComponent(JSON.stringify(target))}`;
  assert.equal(run.importer.targetFromAddress(address(math)).id, 843);
  assert.equal(run.importer.targetFromAddress(address(os408)).number, 44);
  for (const target of [{ ...math, id: 0 }, { ...os408, number: -1 }, { ...math, provider: 'bad' }, { ...math, url: 'https://evil.test/math/practice/1' }]) {
    assert.throws(() => run.importer.targetFromAddress(address(target)));
  }
});

function panelRuntime() {
  const run = runtime(), stored = new Map(), messages = [], finishes = [];
  let methods;
  run.context.JSB = { defineClass(name, value) { methods = value; return {}; } };
  run.context.NSUserDefaults = { standardUserDefaults() { return { objectForKey(key) { return stored.get(key); }, setObjectForKey(value, key) { stored.set(key, value); } }; } };
  run.context.__DAGUANYUAN_IMPORT_SELECTION_GLOBAL__ = { begin() {}, confirmation() { return () => Promise.resolve(true); }, progress() {}, inject() { return Promise.resolve(); }, show() { return Promise.reject(Error('网页结果不可用')); } };
  const originalApp = run.context.Application.sharedInstance();
  run.context.Application.sharedInstance = () => ({ ...originalApp, showHUD(message) { messages.push(message); } });
  run.context.__DAGUANYUAN_IMPORT_REPORT_GLOBAL__ = {
    begin() {}, confirm() { return Promise.resolve(true); }, progress() {},
    textFor(result) { return `新建 ${result.createdCount || 0} 道 ${result.interrupted || ""} ${(result.failed || []).map(f => f.reason).join("；")}`; }, show() { throw Error('报告控件失败'); },
  };
  vm.runInContext(withMathSite(readFileSync(new URL('../src/DaguanyuanWebsiteBridge.js', import.meta.url), 'utf8')), run.context);
  vm.runInContext(withMathSite(readFileSync(new URL('../src/WebPanelController.js', import.meta.url), 'utf8')), run.context);
  const evaluate = run.panel.webView.evaluateJavaScript;
  run.panel.webView.evaluateJavaScript = (script, callback) => {
    if (script.includes('.finishImport()')) { finishes.push(script); callback(true); }
    else if (script.includes('singleImportPageScript')) callback(true);
    else evaluate(script, callback);
  };
  run.panel.singleImportSwitch = {}; run.panel.currentContentPage = 'math'; run.context.self = run.panel;
  const send = target => methods.webViewShouldStartLoadWithRequestNavigationType(run.panel.webView, {
    URL: { absoluteString: `daguanyuanbridge://import-single?payload=${encodeURIComponent(JSON.stringify(target))}` },
  });
  return { ...run, stored, messages, finishes, methods, send };
}

test('原生单题开关默认关闭，持久化开启后导入成功并恢复按钮', async () => {
  const run = panelRuntime();
  run.context.__DAGUANYUAN_IMPORT_SELECTION_GLOBAL__.begin = () => { throw Error('原单题入口不得打开选题界面'); };
  assert.equal(run.send(math), false); assert.equal(run.requests.length, 0);
  assert.match(run.messages.at(-1), /开启显示导入本题/);
  run.methods.toggleSingleImportDisplay({ on: true });
  assert.equal(run.stored.get('cn.marginnote.daguanyuan-bridge.question-tools.import-single-visible'), true);
  run.send(math); assert.equal(run.panel.singleImportBusy, true); run.complete();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(run.panel.singleImportBusy, false); assert.equal(run.parent.childNotes.length, 1);
  assert.match(run.messages.at(-1), /新建 1 道/);
  run.methods.toggleSingleImportDisplay({ on: false }); run.send(math);
  assert.equal(run.requests.length, 1);
});

test('单题入口未选卡片、报告控件异常及并发导入均恢复按钮', async () => {
  const run = panelRuntime(); run.methods.toggleSingleImportDisplay({ on: true });
  run.controller.focusNote = null; run.send(math);
  assert.equal(run.panel.singleImportBusy, false); assert.match(run.messages.at(-1), /选中一张父卡片/);
  run.controller.focusNote = run.parent; run.panel.categoryImportBusy = true; run.send(math);
  assert.match(run.messages.at(-1), /正在导入整类题目/); assert.equal(run.requests.length, 0);
  run.panel.categoryImportBusy = false; run.failImages(true); run.send(math); run.complete();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(run.panel.singleImportBusy, false); assert.match(run.messages.at(-1), /完整保存题目图片/);
  assert.equal(run.finishes.length, 3);
});

test('数学和408单题在第二条评论保存原题链接与标记，重导不重复建卡', async () => {
  for (const target of [math, os408]) {
    const run = runtime();
    async function write() { const pending = run.importer.importQuestion(run.panel, target); if (target === math) run.complete(); return pending; }
    await write(); const card = run.parent.childNotes[0];
    const source = run.context.__DAGUANYUAN_SOURCE_LINK_GLOBAL__;
    const message = card.comments[1].text.match(/\[查看原题\]\(([^)]+)\)/)[1].replace('marginnote4app://addon/', '');
    assert.equal(source.parse(message).questionId, 843); assert.equal(source.parse(message).provider, target.provider);
    const personal = { text: '个人笔记' }; card.comments.push(personal);
    assert.doesNotMatch(card.comments[0].text, /DAGUANYUAN_/);
    assert.equal((await write()).skippedCount, 1); assert.equal(run.parent.childNotes.length, 1);
    assert.match(card.comments[1].text, /查看原题/); assert.equal(card.comments[2], personal);
    assert.equal((await write()).skippedCount, 1); assert.equal(card.comments.length, 3);
  }
});

test('单题来源变化时保留原题入口与标记，并保留个人评论', () => {
  const run = runtime(); run.question.hasBase64Image = false; run.question.stem = '题干';
  const session = run.writer.preparedSingleSession(run.panel.addon, '408');
  const original = { url: 'https://www.408os.cn/exercise?year=2026' };
  session.write(run.question, original); const card = run.parent.childNotes[0];
  const personal = { text: '个人笔记' }; card.comments.push(personal);
  const category = { url: 'https://www.408os.cn/exercise?knowledgeId=7&knowledgeName=测试' };
  assert.equal(session.write(run.question, category), false);
  assert.match(card.comments[0].text, /题干/); assert.match(card.comments[1].text, /查看原题/); assert.equal(card.comments[2], personal);
  const message = card.comments[1].text.match(/\[查看原题\]\(([^)]+)\)/)[1].replace('marginnote4app://addon/', '');
  assert.equal(run.context.__DAGUANYUAN_SOURCE_LINK_GLOBAL__.parse(message).url, original.url + '&questionId=843');
  assert.equal(session.write(run.question, category), false); assert.equal(card.comments.length, 3);
});

for (const page of ['paper?view=practice', 'practice/concepts/345', 'practice/exam-by-year-math_1/all/345']) test(page + ' 单题可解析、建卡，查看原题保存题目分类地址', async () => {
  const run = runtime();
  const payload = { provider: 'math', id: 843, url: 'https://www.cxyonly.fans/math/' + page };
  const target = run.importer.targetFromAddress('daguanyuanbridge://import-single?payload=' + encodeURIComponent(JSON.stringify(payload)));
  const pending = run.importer.importQuestion(run.panel, target); run.complete();
  assert.equal((await pending).createdCount, 1);
  const card = run.parent.childNotes[0];
  const route = run.context.__DAGUANYUAN_SOURCE_LINK_GLOBAL__.fromComment(card.comments[1].text);
  assert.equal(route.questionId, 843); assert.match(route.url, /\/math\/practice\/1\?questionId=843$/);
  assert.doesNotMatch(route.url, /paper|retest/);
  for (const url of ['https://evil.example/math/paper', 'https://www.cxyonly.fans/math/paper-export', 'https://www.cxyonly.fans/math/retest-export', 'https://www.cxyonly.fans/math/retest/practice', 'https://www.cxyonly.fans/math/retest?view=plans']) {
    assert.throws(() => run.importer.targetFromAddress('daguanyuanbridge://import-single?payload=' + encodeURIComponent(JSON.stringify({ ...payload, url }))), /数学题目页/);
  }
});
