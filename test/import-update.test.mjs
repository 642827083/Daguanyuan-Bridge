import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function runtime(provider = '408') {
  const notes = new Map(), deleted = [];
  const notebook = { topicId: 'book', notes: [] };
  const selection = { notebookId: 'book' };
  const failures = {};
  let serial = 0;
  function create(title) {
    const note = { noteId: 'n' + ++serial, notebookId: 'book', noteTitle: title, comments: [], childNotes: [],
      appendMarkdownComment(text) { if (failures.append) throw Error('追加失败'); this.comments.push({ type: 'TextNote', markdown: true, text }); },
      removeCommentByIndex(index) {
        if (failures.removeOld && this.comments[index]?.text.includes('旧题干')) {
          failures.removeOld = false; this.comments.splice(index, 1); throw Error('移除旧评论后发生异常');
        }
        this.comments.splice(index, 1);
      },
      sortCommentsByNewIndices(indices) { if (failures.sort) throw Error('排序失败'); this.comments = Array.from(indices, index => this.comments[index]); if (failures.sorted) { failures.sorted = false; throw Error('排序后发生异常'); } },
      addChild(child) { child.parentNote = this; this.childNotes.push(child); notebook.notes = notebook.notes.filter(item => item !== child); },
      processMarkdownBase64Images() { if (failures.image) return false; this.comments.forEach(c => { if (c.text) c.text = c.text.replace(/data:image\/[^)]+/g, 'marginnote4app://markdownimg/png/123456'); }); this.mediaList = '123456'; return true; },
    };
    notes.set(note.noteId, note); notebook.notes.push(note); return note;
  }
  const question = { id: 123, categoryId: 1, categoryIds: [1], source: '2026年 第1题', stem: '旧题干', options: ['甲'] };
  const context = { console,
    MNUtil: { getNoteById(id) { return notes.get(id); } }, MNNote: { new(id) { return notes.get(id); } },
    Application: { sharedInstance() { return { studyController() { return { notebookController: selection, readerController: { currentDocumentController: { document: {} } } }; }, refreshAfterDBChanged() {} }; } },
    Database: { sharedInstance() { return { getNotebookById() { return notebook; }, getNoteById(id) { return notes.get(id); },
      deleteBookNoteTree(id) { notes.delete(id); notebook.notes = notebook.notes.filter(n => n.noteId !== id); deleted.push(id); } }; } },
    Note: { createWithTitleNotebookDocument: create }, UndoManager: { sharedInstance() { return { undoGrouping(label, book, fn) { fn(); } }; } },
    __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__: { resultForCategoryId() { return { status: 'resolved', path: ['数学', '分类'], categoryId: 1 }; }, urlFor() { return 'https://www.cxyonly.fans/math/practice/1'; } },
    __DAGUANYUAN_MATH_API_GLOBAL__: { positiveInteger: Number, questionScope() { return 'complete'; },
      async questionPage() { return { total: 1, pageSize: 20, questions: [question] }; }, async questionDetail() { return { ...question }; } },
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL('../src/DaguanyuanMathImport.js', import.meta.url), 'utf8'), context);
  const writer = context.__DAGUANYUAN_MATH_IMPORT_GLOBAL__;
  const addon = { window: {} };
  const category = { title: '2026年真题', url: 'https://www.408os.cn/exercise?year=2026' };
  const importOnce = provider === '408' ? () => writer.prepared408Session(addon).write(question, category) : () => writer.importCategory(addon, 1, 'complete');
  return { context, writer, addon, selection, category, question, notes, deleted, failures, create, importOnce,
    imported() { return [...notes.values()].find(n => writer.linkedQuestion(n)?.provider === '408' || writer.linkedQuestion(n)?.id === question.id); } };
}

for (const provider of ['math', '408']) test(provider + ' 再次导入更新原卡，保留独立笔记、手写、子卡片与父节点', async () => {
  const run = runtime(provider); await run.importOnce();
  const card = run.imported(), parent = card.parentNote;
  const personal = { type: 'TextNote', text: '我的笔记' }, drawing = { type: 'PaintNote', paint: '手写媒体' };
  card.comments.push(personal, drawing); const child = run.create('子卡片'); card.addChild(child);
  card.noteTitle = '我的标题'; card.colorIndex = 8;
  run.question.stem = '新题干 $x^{2}$';
  const result = await run.importOnce();
  assert.equal(provider === '408' ? result : result.updatedCount, provider === '408' ? 'updated' : 1);
  assert.equal(run.imported(), card); assert.equal(card.parentNote, parent); assert.equal(card.childNotes[0], child);
  assert.equal(card.noteTitle, '我的标题'); assert.equal(card.colorIndex, 8);
  assert.equal(card.comments[1], personal); assert.equal(card.comments[2], drawing);
  assert.match(card.comments[0].text, /新题干/); assert.doesNotMatch(card.comments[0].text, /旧题干/);
  const same = await run.importOnce(); assert.equal(provider === '408' ? same : same.skippedCount, provider === '408' ? false : 1);
  assert.equal(run.deleted.length, 0);
});

test('带图更新成功后相同内容跳过；图片保存或排序失败保持旧内容且不删除原卡', async () => {
  for (const failure of ['image', 'sort', 'append', 'sorted', 'removeOld']) {
    const run = runtime(); await run.importOnce(); const card = run.imported();
    card.comments.push({ type: 'PaintNote', paint: '我的手写' });
    const previous = structuredClone(card.comments);
    run.question.stem = '新版 ![题图](data:image/png;base64,AQID)'; run.question.hasBase64Image = true;
    run.failures[failure] = true;
    assert.throws(run.importOnce, /失败|保存|异常/);
    assert.deepEqual(card.comments, previous); assert.equal(run.notes.has(card.noteId), true); assert.equal(run.deleted.length, 0);
    run.failures[failure] = false; assert.equal(await run.importOnce(), 'updated');
    assert.match(card.comments[0].text, /markdownimg/); assert.equal(await run.importOnce(), false);
  }
});

test('旧版评论按题目来源标记更新，并保留标记后追加的个人文字', async () => {
  const run = runtime(); await run.importOnce(); const card = run.imported();
  card.comments[0].text = run.writer.questionMarkdown(run.question, run.category.url + '&questionId=123', '408') + '\n\n这是追加的个人笔记';
  run.question.stem = '更新旧版题目'; assert.equal(await run.importOnce(), 'updated');
  assert.match(card.comments[0].text, /更新旧版题目/); assert.match(card.comments[0].text, /这是追加的个人笔记$/);
});

test('题干评论位于独立笔记中间时只替换题干，手动修改题干会在重导时更新', async () => {
  const run = runtime(); await run.importOnce(); const card = run.imported();
  const first = { text: '前面的笔记' }, last = { type: 'PaintNote', paint: '后面的手写' };
  card.comments.unshift(first); card.comments.push(last);
  card.comments[1].text = card.comments[1].text.replace('旧题干', '手动编辑题干');
  assert.equal(await run.importOnce(), 'updated'); assert.match(card.comments[1].text, /旧题干/);
  assert.equal(card.comments[0], first); assert.equal(card.comments[2], last);
  assert.equal(await run.importOnce(), false);
});

test('缺少 MN Utils 评论接口或来源标记损坏时保留原卡；同目录重复题卡不任意覆盖', async () => {
  for (const kind of ['utils', 'marker', 'duplicate']) {
    const run = runtime(); await run.importOnce(); const card = run.imported();
    if (kind === 'utils') delete run.context.MNNote;
    if (kind === 'marker') card.comments[0].text = card.comments[0].text.replace('DAGUANYUAN_408_URL:', '损坏的来源:');
    if (kind === 'duplicate') { const duplicate = run.create('重复题目'); duplicate.comments = structuredClone(card.comments); card.parentNote.addChild(duplicate); }
    const before = structuredClone(card.comments); run.question.stem = '新的题干';
    assert.throws(run.importOnce, /MN Utils|来源标记|多张相同题卡/);
    assert.deepEqual(card.comments, before); assert.equal(run.deleted.length, 0);
  }
});
