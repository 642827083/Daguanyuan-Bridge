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
      sortCommentsByNewIndices(indices) { if (failures.sort) throw Error('排序失败'); const before = this.comments.slice(); indices.forEach((position, old) => { this.comments[position] = before[old]; }); if (failures.sorted) { failures.sorted = false; throw Error('排序后发生异常'); } },
      addChild(child) { child.parentNote = this; this.childNotes.push(child); notebook.notes = notebook.notes.filter(item => item !== child); },
      processMarkdownBase64Images() { if (failures.image) return false; this.comments.forEach(c => { if (c.text) c.text = c.text.replace(/data:image\/[^)]+/g, 'marginnote4app://markdownimg/png/123456'); }); this.mediaList = '123456'; return true; },
    };
    notes.set(note.noteId, note); notebook.notes.push(note); return note;
  }
  const question = { id: 123, categoryId: 1, categoryIds: [1], source: '2026年 第1题', stem: '旧题干', options: ['甲'] };
  const context = { console,
    MNUtil: { getNoteById(id) { return notes.get(id); }, undoGrouping(fn) { fn(); } }, MNNote: { new(id) { return notes.get(id); } },
    Application: { sharedInstance() { return { studyController() { return { notebookController: selection, readerController: { currentDocumentController: { document: {} } } }; }, refreshAfterDBChanged() {} }; } },
    Database: { sharedInstance() { return { getNotebookById() { return notebook; }, getNoteById(id) { return notes.get(id); },
      createNoteWithTitleTopicid(title, topic) { assert.equal(topic, 'book'); return create(title); },
      deleteBookNoteTree(id) { notes.delete(id); notebook.notes = notebook.notes.filter(n => n.noteId !== id); deleted.push(id); } }; } },
    Note: { createWithTitleNotebookDocument: create }, UndoManager: { sharedInstance() { return { undoGrouping(label, book, fn) { fn(); } }; } },
    __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__: { resultForCategoryId() { return { status: 'resolved', path: ['数学', '分类'], categoryId: 1 }; }, urlFor() { return 'https://www.cxyonly.fans/math/practice/1'; } },
    __DAGUANYUAN_MATH_API_GLOBAL__: { positiveInteger: Number, questionScope() { return 'complete'; },
      async questionPage() { return { total: 1, pageSize: 20, questions: [question] }; }, async questionDetail() { return { ...question }; } },
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL('../src/DaguanyuanSourceLink.js', import.meta.url), 'utf8'), context);
  vm.runInContext(fs.readFileSync(new URL('../src/DaguanyuanCardComments.js', import.meta.url), 'utf8'), context);
  vm.runInContext(fs.readFileSync(new URL('../src/DaguanyuanMathImport.js', import.meta.url), 'utf8'), context);
  vm.runInContext(fs.readFileSync(new URL('../src/DaguanyuanCardRepair.js', import.meta.url), 'utf8'), context);
  const writer = context.__DAGUANYUAN_MATH_IMPORT_GLOBAL__;
  const addon = { window: {} };
  const category = { title: '2026年真题', url: 'https://www.408os.cn/exercise?year=2026' };
  const importOnce = provider === '408' ? () => writer.prepared408Session(addon).write(question, category) : () => writer.importCategory(addon, 1, 'complete');
  return { context, writer, addon, selection, category, question, notes, deleted, failures, create, importOnce,
    repair() { const repair = context.__DAGUANYUAN_CARD_REPAIR_GLOBAL__; return repair.apply(addon, repair.preview(addon)); },
    imported() { return [...notes.values()].find(n => writer.linkedQuestion(n)?.provider === '408' || writer.linkedQuestion(n)?.id === question.id); } };
}

function makeLegacy(note, missingLink = false, suffix = '') {
  const metadata = note.comments[1].text;
  const prefix = metadata.includes('DAGUANYUAN_408_') ? 'DAGUANYUAN_408_' : 'DAGUANYUAN_';
  const answer = /ANSWER_ID:/.test(metadata), identity = metadata.match(/<!-- DAGUANYUAN_(?:408_)?(?:QUESTION|ANSWER)_ID:\d+ -->/)[0];
  const id = identity.match(/_ID:(\d+)/)[1], url = decodeURIComponent(metadata.split('\n')[0].match(/&url=([^)]*)/)[1]);
  let body = note.comments[0].text;
  if (answer) {
    body = body.replace(/(### (答案|解析)\n\n[\s\S]*?)(?=\n\n### (?:答案|解析)\n\n|$)/g,
      (_, part, title) => part + '\n\n<!-- ' + prefix + 'ANSWER_PART:' + (title === '答案' ? 'answer' : 'explanation') + ' -->');
  }
  note.comments[0].text = [body, identity, '<!-- ' + prefix + (answer ? 'ANSWER_URL:' : 'URL:') + url + ' -->',
    ...metadata.split('\n\n').filter(line => /_(?:SOURCE_STAMP|RENDERED_STAMP|SINGLE_IMPORT):/.test(line))].join('\n\n') + suffix;
  if (missingLink) note.comments.splice(1, 1);
  else note.comments[1].text = metadata.split('\n')[0] + '\n\n<!-- DAGUANYUAN_SOURCE_LINK:' + (prefix.includes('408') ? '408' : 'math') + ':' + id + ' -->';
}


function withContent(run, provider, content) {
  const confirm = () => [123]; confirm.content = content;
  return provider === '408' ? run.writer.prepared408Session(run.addon).write(run.question, run.category, content)
    : run.writer.importCategory(run.addon, 1, 'complete', null, confirm);
}

for (const provider of ['math', '408']) test(provider + ' 网站正文变化及用户编辑后重导都跳过，图片、个人笔记、手写、子卡片和位置不改变', async () => {
  const run = runtime(provider); run.question.stem = '原题 ![图](data:image/png;base64,AQID)'; run.question.hasBase64Image = true;
  await run.importOnce(); const card = run.imported(), parent = card.parentNote;
  const personal = { type: 'TextNote', text: '我的笔记' }, drawing = { type: 'PaintNote', paint: '我的手写' };
  card.comments.push(personal, drawing); const child = run.create('自己的解法'); card.addChild(child);
  card.noteTitle = '我的标题'; card.colorIndex = 8; card.comments[0].text += '\n手动编辑的题干';
  const before = structuredClone(card.comments), objects = [...card.comments];
  run.question.stem = '网站新版题干'; run.failures.image = true; run.failures.append = true;
  if (provider === 'math') run.context.__DAGUANYUAN_MATH_API_GLOBAL__.questionDetail = async () => { throw Error('不应读取已导入题目'); };
  const result = await run.importOnce();
  assert.equal(provider === '408' ? result : result.skippedCount, provider === '408' ? false : 1);
  if (provider === 'math') { assert.equal(result.failed.length, 0); assert.equal(result.answerAddedCount, 0); }
  assert.deepEqual(card.comments, before); objects.forEach((c, i) => assert.equal(card.comments[i], c));
  assert.equal(card.parentNote, parent); assert.equal(card.childNotes[0], child); assert.equal(card.noteTitle, '我的标题'); assert.equal(card.colorIndex, 8);
  assert.equal(run.deleted.length, 0); assert.doesNotMatch(card.comments[1].text, /(?:SOURCE|RENDERED)_STAMP:/);
});

for (const provider of ['math', '408']) test(provider + ' 仅补建缺失答案子卡，题干不变，已有答案和解析即使网站改变也跳过', async () => {
  const run = runtime(provider); await run.importOnce(); const card = run.imported(), body = card.comments[0], meta = card.comments[1];
  const personal = { text: '独立笔记' }; card.comments.push(personal);
  run.question.stem = '新版题干'; run.question.answer = 'C'; run.question.explanation = '网站解析';
  const first = await withContent(run, provider, 'questionAnswer');
  assert.equal(provider === '408' ? first : first.answerAddedCount, provider === '408' ? 'answerAdded' : 1);
  assert.equal(card.comments[0], body); assert.equal(card.comments[1], meta); assert.equal(card.comments[2], personal);
  const answer = card.childNotes[0]; assert.equal(answer.noteTitle, '答案与解析'); assert.equal(card.mindmapBranchClose, 1);
  assert.match(answer.comments[0].text, /### 答案\n\nC[\s\S]*网站解析/);
  assert.doesNotMatch(answer.comments[1].text, /(?:SOURCE|RENDERED)_STAMP:/);
  assert.equal(run.writer.linkedQuestion(answer), null);
  assert.equal(answer.comments[1].text.split('\n')[0], meta.text.split('\n')[0]);
  const answerBefore = structuredClone(answer.comments); answer.comments[0].text += '\n我的答案修改';
  run.question.answer = 'D'; run.question.explanation = '新的解析'; run.failures.image = true;
  if (provider === 'math') run.context.__DAGUANYUAN_MATH_API_GLOBAL__.questionDetail = async () => { throw Error('已有答案不应发请求'); };
  const repeated = await withContent(run, provider, 'questionAnswer');
  assert.equal(provider === '408' ? repeated : repeated.skippedCount, provider === '408' ? false : 1);
  if (provider === 'math') assert.equal(repeated.failed.length, 0);
  assert.equal(card.childNotes.length, 1); assert.equal(card.childNotes[0], answer);
  assert.equal(answer.comments[0].text, answerBefore[0].text + '\n我的答案修改');
  const only = await withContent(run, provider, 'question');
  assert.equal(provider === '408' ? only : only.skippedCount, provider === '408' ? false : 1);
});

test('已有答案子卡即使只有答案或只有解析也不覆盖，不补改其中正文', () => {
  for (const part of ['answer', 'explanation']) {
    const run = runtime(); run.question[part] = '原有内容';
    withContent(run, '408', 'questionAnswer'); const answer = run.imported().childNotes[0], before = structuredClone(answer.comments);
    run.question.answer = '新答案'; run.question.explanation = '新解析';
    assert.equal(withContent(run, '408', 'questionAnswer'), false); assert.deepEqual(answer.comments, before);
  }
});

test('补答案无内容或图片保存失败保留原题，重试成功后只建一张答案卡', () => {
  const run = runtime(); run.importOnce(); const card = run.imported(), before = structuredClone(card.comments);
  assert.throws(() => withContent(run, '408', 'questionAnswer'), /暂无可读取的答案/);
  run.question.answer = '![答案图](data:image/png;base64,AQID)'; run.question.hasBase64Image = true; run.failures.image = true;
  assert.throws(() => withContent(run, '408', 'questionAnswer'), /图片/);
  assert.deepEqual(card.comments, before); assert.equal(card.childNotes.length, 0);
  run.failures.image = false; assert.equal(withContent(run, '408', 'questionAnswer'), 'answerAdded');
  assert.match(card.childNotes[0].comments[0].text, /markdownimg/); assert.equal(card.mediaList, undefined);
  assert.equal(withContent(run, '408', 'questionAnswer'), false); assert.equal(card.childNotes.length, 1);
});

test('普通同名子卡不当作答案，重复的导入答案身份拒绝任意选择', () => {
  const run = runtime(); run.importOnce(); const card = run.imported(), personal = run.create('答案与解析');
  personal.comments.push({ text: '我的解法' }); card.addChild(personal); run.question.answer = 'C';
  assert.equal(withContent(run, '408', 'questionAnswer'), 'answerAdded');
  const answer = card.childNotes.find(n => n !== personal), duplicate = run.create('答案与解析');
  duplicate.comments = structuredClone(answer.comments); card.addChild(duplicate);
  assert.throws(() => withContent(run, '408', 'questionAnswer'), /多张相同的答案子卡/); assert.equal(personal.comments[0].text, '我的解法');
});

for (const provider of ['math', '408']) test(provider + ' 旧题目和答案修复后仅保留链接和身份，个人文字手写保持，重导仍跳过', async () => {
  const run = runtime(provider); run.question.answer = 'C'; await withContent(run, provider, 'questionAnswer');
  const card = run.imported(), answer = card.childNotes[0];
  const extras = [card, answer].map(note => {
    makeLegacy(note, true, '\n\n标记后个人文字');
    note.comments[0].text = note.comments[0].text.replace('\n\n标记后个人文字', '\n\n<!-- DAGUANYUAN_SOURCE_STAMP:314:d999c7df:43d28f17 -->\n\n<!-- DAGUANYUAN_RENDERED_STAMP:315:abcd:ef01 -->\n\n标记后个人文字');
    const text = { text: '我的评论' }, paint = { type: 'PaintNote', paint: '手写' }; note.comments.push(text, paint); return [text, paint];
  });
  assert.equal(run.repair().repairedCount, 2);
  [card, answer].forEach((note, i) => {
    assert.doesNotMatch(note.comments[0].text, /DAGUANYUAN_/);
    assert.match(note.comments[1].text, /^\[查看原题\]/); assert.equal((note.comments[1].text.match(/<!--/g) || []).length, 1);
    assert.doesNotMatch(note.comments[1].text, /STAMP:|SOURCE_LINK:|(?:ANSWER_)?URL:/);
    assert.equal(note.comments[2].text, '标记后个人文字'); assert.equal(note.comments[3], extras[i][0]); assert.equal(note.comments[4], extras[i][1]);
  });
  run.question.stem = '网站更新'; const repeated = await withContent(run, provider, 'questionAnswer');
  assert.equal(provider === '408' ? repeated : repeated.skippedCount, provider === '408' ? false : 1);
  assert.equal(run.repair().repairedCount, 0);
});

test('旧卡修复中排序失败可重试，原题和个人评论恢复，校验值最终清除', () => {
  for (const kind of ['sort', 'sorted']) {
    const run = runtime(); run.importOnce(); const card = run.imported(); makeLegacy(card, true);
    const personal = { text: '我的笔记' }; card.comments.push(personal); const before = structuredClone(card.comments);
    run.failures[kind] = true; assert.equal(run.repair().failed.length, 1); assert.deepEqual(card.comments, before);
    run.failures[kind] = false; assert.equal(run.repair().repairedCount, 1); assert.equal(card.comments[2], personal);
    assert.equal(run.importOnce(), false); assert.equal(run.repair().repairedCount, 0);
  }
});

test('同目录重复题卡拒绝任意处理；旧卡缺少链接只跳过，补答案时要求先修复', () => {
  const run = runtime(); run.importOnce(); const card = run.imported(), duplicate = run.create('重复题卡');
  duplicate.comments = structuredClone(card.comments); card.parentNote.addChild(duplicate);
  assert.throws(run.importOnce, /多张相同题卡/);
  const other = runtime(); other.importOnce(); const existing = other.imported(); makeLegacy(existing, true);
  assert.equal(other.importOnce(), false); other.question.answer = 'C';
  assert.throws(() => withContent(other, '408', 'questionAnswer'), /修复已导入题卡/);
  assert.equal(other.repair().repairedCount, 1); assert.equal(withContent(other, '408', 'questionAnswer'), 'answerAdded');
});
