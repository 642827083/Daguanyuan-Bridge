import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function runtime() {
  const notebook = { topicId: 'book-1', notes: [] };
  const controller = { notebookId: 'book-1', focusNote: null };
  const notes = new Map(), timers = [], requests = [], deleted = [], prepares = [];
  const document = { md5: 'doc-1' };
  let serial = 0, complete, payload = '', imageFailure = false;
  const question = { id: 843, categoryId: 1, source: '2026年 第44题', stem: '题干 ![图](data:image/png;base64,AQID)', hasBase64Image: true, options: ['甲'] };
  function create(title) {
    const note = { noteId: `note-${++serial}`, notebookId: 'book-1', noteTitle: title, comments: [], childNotes: [],
      appendMarkdownComment(text) { this.comments.push({ text }); },
      removeCommentByIndex(index) { this.comments.splice(index, 1); },
      sortCommentsByNewIndices(indices) { this.comments = indices.map(index => this.comments[index]); },
      addChild(child) { child.parentNote = this; this.childNotes.push(child); notebook.notes = notebook.notes.filter(n => n !== child); },
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
  for (const file of ['DaguanyuanMathImport', 'Daguanyuan408Page', 'Daguanyuan408Import', 'DaguanyuanSingleImport']) {
    vm.runInContext(readFileSync(new URL(`../src/${file}.js`, import.meta.url), 'utf8'), context);
  }
  const panel = { addon: { window: {} }, webView: { evaluateJavaScript(script, callback) {
    if (script.startsWith('String((function pageReceiver')) {
      const target = JSON.parse(script.match(/,(\{[^{}]+\}|null)\)\)$/)[1]);
      assert.equal(target.year, 2026); assert.equal(target.number, 44);
      payload = JSON.stringify({ category, ids: [843] }); callback('true');
    } else callback(vm.runInContext(script, context));
  } } };
  const parent = create('父卡片'); controller.focusNote = parent;
  return { context, controller, study, database, notes, notebook, parent, panel, create, question, timers, requests, deleted, prepares,
    importer: context.__DAGUANYUAN_SINGLE_IMPORT_GLOBAL__, writer: context.__DAGUANYUAN_MATH_IMPORT_GLOBAL__,
    complete() { complete(question); }, failImages(value) { imageFailure = value; } };
}
const math = { provider: 'math', id: 843, url: 'https://www.cxyonly.fans/math/practice/1' };
const os408 = { provider: '408', year: 2026, number: 44, url: 'https://www.408os.cn/exercise?year=2026' };

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
  assert.match(run.parent.childNotes[0].comments[0].text, /DAGUANYUAN_408_QUESTION_ID:843/);
  assert.match(run.parent.childNotes[0].comments[0].text, /marginnote-media/);
  assert.equal(run.notebook.notes.length, 2);
});

test('同一父节点重复题目跳过，其他父节点、孙节点和其他来源独立', async () => {
  const run = runtime();
  const first = run.importer.importQuestion(run.panel, math); run.complete(); await first;
  const repeated = run.importer.importQuestion(run.panel, math); run.complete();
  assert.equal((await repeated).skippedCount, 1);
  assert.equal(run.requests.length, 2);
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

test('数学与408单题再次导入更新原卡，保持父节点、独立笔记和子卡片', async () => {
  for (const target of [math, os408]) {
    const run = runtime();
    async function importOnce() {
      const promise = run.importer.importQuestion(run.panel, target); if (target === math) run.complete(); return promise;
    }
    await importOnce(); const card = run.parent.childNotes[0];
    const personal = { text: '我的笔记' }; card.comments.push(personal); const child = run.create('子节点'); card.addChild(child);
    run.question.stem = '新题干 $x$'; run.question.hasBase64Image = false;
    assert.equal((await importOnce()).updatedCount, 1);
    assert.equal(run.parent.childNotes[0], card); assert.equal(card.childNotes[0], child); assert.equal(card.comments[1], personal);
    assert.match(card.comments[0].text, /新题干/); assert.match(card.comments[0].text, /DAGUANYUAN_SINGLE_IMPORT:1/);
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

test('所选卡片没有来源文档时使用笔记本工厂创建子节点', async () => {
  const run = runtime(); run.study.readerController = null;
  const operation = run.importer.importQuestion(run.panel, math); run.complete();
  assert.equal((await operation).createdCount, 1); assert.equal(run.parent.childNotes.length, 1);
});

test('单题卡片保留点击页面来源，不用所选父节点的分类改写定位地址', async () => {
  const run = runtime();
  run.question.categoryId = 999;
  run.context.__DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.resolve = () => ({ status: 'resolved', matchedSegments: 1, categoryId: 999 });
  const operation = run.importer.importQuestion(run.panel, { ...math, url: 'https://www.cxyonly.fans/math/practice/2?questionId=1' });
  run.complete(); assert.equal((await operation).createdCount, 1);
  const link = run.writer.questionForNote(run.parent.childNotes[0]);
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
  const originalApp = run.context.Application.sharedInstance();
  run.context.Application.sharedInstance = () => ({ ...originalApp, showHUD(message) { messages.push(message); } });
  run.context.__DAGUANYUAN_IMPORT_REPORT_GLOBAL__ = { textFor() { return '失败详情'; }, show() { throw Error('报告控件失败'); } };
  vm.runInContext(readFileSync(new URL('../src/DaguanyuanWebsiteBridge.js', import.meta.url), 'utf8'), run.context);
  vm.runInContext(readFileSync(new URL('../src/WebPanelController.js', import.meta.url), 'utf8'), run.context);
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
  assert.equal(run.send(math), false); assert.equal(run.requests.length, 0);
  assert.match(run.messages.at(-1), /开启显示导入单题/);
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
