import { withMathSite } from './helpers/math-site.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function runtime() {
  const notes = new Map(), notebook = { topicId: 'study', notes: [] }, selection = { notebookId: 'study' };
  const failure = {}, groups = [], refreshes = []; let serial = 0;
  function create(title = '2026年 第1题') {
    const note = { noteId: 'n' + ++serial, notebookId: 'study', noteTitle: title, comments: [], childNotes: [], colorIndex: 7,
      appendMarkdownComment(text) { if (failure.append) throw Error('追加失败'); this.comments.push({ text, type: 'TextNote', markdown: true }); },
      appendTextComment(text) { this.comments.push({ text, type: 'TextNote', markdown: false }); },
      sortCommentsByNewIndices(destinations) {
        if (failure.sort) throw Error('排序失败');
        const before = this.comments.slice(); destinations.forEach((position, old) => { this.comments[position] = before[old]; });
        if (failure.sorted) { failure.sorted = false; throw Error('排序后失败'); }
      },
      removeCommentByIndex(index) {
        const removed = this.comments.splice(index, 1)[0];
        if (failure.remove && removed.text.includes('QUESTION_ID')) { failure.remove = false; throw Error('删除后失败'); }
      },
      addChild(child) { child.parentNote = this; this.childNotes.push(child); notebook.notes = notebook.notes.filter(n => n !== child); },
      processMarkdownBase64Images() { throw Error('修复不应处理图片'); },
    };
    notes.set(note.noteId, note); notebook.notes.push(note); return note;
  }
  const context = { console,
    Application: { sharedInstance() { return { studyController() { return { notebookController: selection }; }, refreshAfterDBChanged(topic) { refreshes.push(topic); } }; } },
    Database: { sharedInstance() { return { getNotebookById(id) { return id === 'study' ? notebook : null; }, getNoteById: id => notes.get(id) }; } },
    UndoManager: { sharedInstance() { return { undoGrouping(label, topic, fn) { fn(); } }; } },
    __DAGUANYUAN_MATH_API_GLOBAL__: { positiveInteger: Number },
    MNNote: { new(id) { return notes.get(id); } },
    MNUtil: { undoGrouping(fn, topic) { groups.push(topic); fn(); }, getNoteById: id => notes.get(id) },
  };
  vm.createContext(context);
  for (const name of ['DaguanyuanSourceLink', 'DaguanyuanCardComments', 'DaguanyuanCommentFold', 'DaguanyuanMathImport', 'DaguanyuanCardRepair']) {
    vm.runInContext(withMathSite(readFileSync(new URL('../src/' + name + '.js', import.meta.url), 'utf8')), context);
  }
  const C = context.__DAGUANYUAN_CARD_COMMENTS_GLOBAL__, repair = context.__DAGUANYUAN_CARD_REPAIR_GLOBAL__, addon = { window: {} };
  function legacy(provider = 'math', role, withLink = true, id = 123) {
    const url = provider === '408' ? 'https://www.408os.cn/exercise?year=2026&questionId=' + id : 'https://www.cxyonly.fans/math/practice/1?questionId=' + id;
    const body = role ? '### 答案\n\nC\n\n### 解析\n\n![解析](marginnote4app://markdownimg/png/local)' : '题干\n\n![题图](marginnote4app://markdownimg/png/local)';
    const raw = body.replace(/marginnote4app:\/\/markdownimg\/png\/local/g, 'data:image/png;base64,AQID');
    const prefix = provider === '408' ? 'DAGUANYUAN_408_' : 'DAGUANYUAN_';
    let old = body;
    if (role) old = old.replace(/(### (答案|解析)\n\n[\s\S]*?)(?=\n\n### (?:答案|解析)\n\n|$)/g,
      (_, part, title) => part + '\n\n<!-- ' + prefix + 'ANSWER_PART:' + (title === '答案' ? 'answer' : 'explanation') + ' -->');
    old += '\n\n<!-- ' + prefix + (role ? 'ANSWER_ID:' : 'QUESTION_ID:') + id + ' -->\n\n<!-- ' + prefix + (role ? 'ANSWER_URL:' : 'URL:') + url + ' -->';
    const source = '314:d999c7df:43d28f17', rendered = '315:abcd:ef01';
    old += '\n\n<!-- DAGUANYUAN_SOURCE_STAMP:' + source + ' -->\n\n<!-- DAGUANYUAN_RENDERED_STAMP:' + rendered + ' -->';
    const note = create(role ? '答案与解析' : undefined); note.appendMarkdownComment(old);
    if (withLink) note.appendMarkdownComment('[查看原题](' + context.__DAGUANYUAN_SOURCE_LINK_GLOBAL__.link(provider, id, url, 2026) + ')\n\n<!-- DAGUANYUAN_SOURCE_LINK:' + provider + ':' + id + ' -->');
    return { note, url, body, raw, source, rendered, id };
  }
  return { context, C, repair, addon, notes, notebook, selection, failure, create, legacy, groups, refreshes,
    preview: () => repair.preview(addon), apply: prepared => repair.apply(addon, prepared), fix: () => repair.apply(addon, repair.preview(addon)) };
}

test('修复保存后按开关折叠新生成的原题评论，失败单独提示且保留修复内容', () => {
  for (const fail of [false, true]) {
    const r = runtime(), entry = r.legacy(), writes = [];
    r.context.NSUserDefaults = { standardUserDefaults() { return { objectForKey() { return true; } }; } };
    entry.note.commentState = function () { return { ok: true, revision: 'r', comments: this.comments.map((c, i) => ({ ...c, index: i + 1, collapsed: false })) }; };
    entry.note.setCommentsCollapsed = function (targets, collapsed, revision) {
      assert.deepEqual(r.refreshes, ['study']); assert.equal(r.groups.length, 1);
      writes.push({ targets: JSON.parse(JSON.stringify(targets)), collapsed, revision });
      return fail ? { ok: false, error: { message: '未能折叠' } } : { ok: true, persisted: true };
    };
    const result = r.fix(); assert.equal(result.repairedCount, 1); assert.equal(result.failed.length, 0);
    assert.deepEqual(writes, [{ targets: [{ index: 2 }], collapsed: true, revision: 'r' }]);
    assert.equal(result.commentFoldWarnings?.length || 0, fail ? 1 : 0);
    assert.match(entry.note.comments[1].text, /^\[查看原题\]/);
  }
});

for (const provider of ['math', '408']) for (const withLink of [false, true]) {
  test(provider + ' 修复旧题目和答案，补齐第二条链接并清除校验注释并保留图文、对象和卡片属性，重复修复无变化 ' + withLink, () => {
    const run = runtime(), q = run.legacy(provider, undefined, withLink), a = run.legacy(provider, 'ANSWER', withLink);
    q.note.addChild(a.note); const child = run.create('自建解法'); q.note.addChild(child);
    const personal = { type: 'TextNote', markdown: false, text: '我的批注' }, drawing = { type: 'PaintNote', paint: '手写媒体' };
    q.note.comments.push(personal, drawing); a.note.comments.push(drawing);
    const prepared = run.preview(); assert.equal(prepared.questionCount, 1); assert.equal(prepared.answerCount, 1);
    assert.match(q.note.comments[0].text, /QUESTION_ID:/); assert.equal(run.groups.length, 0);
    const result = run.apply(prepared); assert.equal(result.repairedCount, 2); assert.equal(result.failed.length, 0);
    for (const entry of [q, a]) {
      const { note, body, source, rendered } = entry;
      assert.equal(note.comments[0].text, body); assert.doesNotMatch(note.comments[0].text, /DAGUANYUAN_/);
      assert.match(note.comments[1].text, /^\[查看原题\]/); assert.doesNotMatch(note.comments[1].text, /(?:SOURCE|RENDERED)_STAMP:/);
      assert.doesNotMatch(note.comments[1].text, /DAGUANYUAN_(?:408_)?(?:URL|ANSWER_URL|ANSWER_PART):|DAGUANYUAN_SOURCE_LINK:/);
      assert.equal((note.comments[1].text.match(/<!--/g) || []).length, 1);
      const route = run.context.__DAGUANYUAN_SOURCE_LINK_GLOBAL__.parse(note.comments[1].text.match(/\(([^)]+)\)/)[1].slice('marginnote4app://addon/'.length));
      assert.equal(route.questionId, 123); assert.equal(route.provider, provider); assert.equal(route.url, entry.url);
      assert.equal(note.colorIndex, 7);
    }
    assert.equal(q.note.comments[2], personal); assert.equal(q.note.comments[3], drawing); assert.equal(a.note.comments[2], drawing);
    assert.equal(q.note.childNotes[0], a.note); assert.equal(q.note.childNotes[1], child); assert.equal(a.note.parentNote, q.note);
    assert.equal(run.context.__DAGUANYUAN_MATH_IMPORT_GLOBAL__.linkedQuestion(q.note).id, 123);
    assert.equal(run.context.__DAGUANYUAN_MATH_IMPORT_GLOBAL__.linkedQuestion(a.note), null);
    assert.equal(run.fix().repairedCount, 0); assert.equal(run.groups.length, 1); assert.deepEqual(run.refreshes, ['study']);
  });
}

test('答案缺少网址时从对应父题目补齐；分类卡和普通笔记不参与修复', () => {
  const run = runtime(), q = run.legacy('408', undefined, false), a = run.legacy('408', 'ANSWER', false);
  q.note.addChild(a.note); a.note.comments[0].text = a.note.comments[0].text.replace(/\n\n<!-- DAGUANYUAN_408_ANSWER_URL:[^\n]+-->/, '');
  const regular = run.create('普通笔记'); regular.appendTextComment('我的题目');
  const category = run.create('分类'); category.appendMarkdownComment('<!-- DAGUANYUAN_ROOT -->');
  assert.equal(run.fix().repairedCount, 2); assert.equal(run.context.__DAGUANYUAN_SOURCE_LINK_GLOBAL__.fromComment(a.note.comments[1].text).url, q.url);
  assert.equal(regular.comments.length, 1); assert.equal(category.comments.length, 1);
});

test('身份、原题入口冲突及缺少网址时跳过，不生成猜测链接', () => {
  for (const kind of ['id', 'url', 'link', 'missing']) {
    const run = runtime(), { note } = run.legacy('math', undefined, false);
    if (kind === 'id') note.comments[0].text += '\n\n<!-- DAGUANYUAN_QUESTION_ID:999 -->';
    if (kind === 'url') note.comments[0].text += '\n\n<!-- DAGUANYUAN_URL:https://www.cxyonly.fans/math/practice/2?questionId=123 -->';
    if (kind === 'link') note.appendMarkdownComment('[查看原题](' + run.context.__DAGUANYUAN_SOURCE_LINK_GLOBAL__.link('math', 999, 'https://www.cxyonly.fans/math/practice/1?questionId=999', 0) + ')');
    if (kind === 'missing') note.comments[0].text = note.comments[0].text.replace(/\n\n<!-- DAGUANYUAN_URL:[^\n]+-->/, '');
    const before = structuredClone(note.comments), preview = run.preview();
    assert.equal(preview.jobs.length, 0, kind); assert.equal(preview.skipped.length, 1, kind);
    assert.equal(run.apply(preview).skippedCount, 1); assert.deepEqual(note.comments, before); assert.equal(run.groups.length, 0);
  }
});

test('统计后切换学习集拒绝修复，删除、移动或编辑过的题卡跳过', () => {
  for (const kind of ['switch', 'delete', 'move', 'edit']) {
    const run = runtime(), { note } = run.legacy(), preview = run.preview();
    if (kind === 'switch') run.selection.notebookId = 'other';
    if (kind === 'delete') run.notebook.notes = [];
    if (kind === 'move') note.parentNote = run.create('新的父卡');
    if (kind === 'edit') note.comments[0].text += '\n我的新评论';
    const before = structuredClone(note.comments);
    if (kind === 'switch') assert.throws(() => run.apply(preview), /学习集|学习集已切换/);
    else { const result = run.apply(preview); assert.equal(result.repairedCount, 0); assert.equal(result.skippedCount, 1); }
    assert.deepEqual(note.comments, before);
  }
});

test('追加、排序或删旧评论中途失败恢复原评论，个人文字与手写对象保持，重试可完成', () => {
  for (const kind of ['append', 'sort', 'sorted', 'remove']) {
    const run = runtime(), { note } = run.legacy();
    const personal = { type: 'TextNote', markdown: false, text: '个人评论' }, paint = { type: 'PaintNote', paint: '保留手写' };
    note.comments.push(personal, paint); const before = structuredClone(note.comments);
    run.failure[kind] = true; const result = run.fix();
    assert.equal(result.failed.length, 1, kind); assert.equal(result.repairedCount, 0, kind); assert.deepEqual(note.comments, before, kind);
    assert.equal(note.comments[2], personal); assert.equal(note.comments[3], paint);
    run.failure[kind] = false; assert.equal(run.fix().repairedCount, 1); assert.equal(note.comments[2], personal); assert.equal(note.comments[3], paint);
  }
});

test('Native 评论列表与函数属性可读取，MN Utils 缺失时不修改卡片', () => {
  const run = runtime(), { note } = run.legacy(); const original = note.comments;
  note.comments = { count() { return original.length; }, objectAtIndex(i) { return original[i]; } };
  assert.equal(run.preview().jobs.length, 1); note.comments = original;
  delete run.context.MNUtil.undoGrouping; assert.throws(run.preview, /MN Utils/); assert.equal(note.comments, original);
});

test('带图旧卡修复后再次导入相同题目跳过，图片保存接口不再调用', () => {
  const run = runtime(), { note, raw } = run.legacy('408', undefined, false), parent = run.create('父卡');
  parent.addChild(note); run.selection.focusNote = parent;
  assert.equal(run.fix().repairedCount, 1);
  const question = { id: 123, source: '2026年 第1题', stem: raw, options: [], hasBase64Image: true };
  const session = run.context.__DAGUANYUAN_MATH_IMPORT_GLOBAL__.preparedSingleSession(run.addon, '408');
  assert.equal(session.write(question, { url: 'https://www.408os.cn/exercise?year=2026' }), false);
  assert.equal(parent.childNotes.length, 1); assert.equal(parent.childNotes[0], note);
});

for (const provider of ['math', '408']) test(provider + ' 已经把注释移到第二条的题目和答案卡，可再次整理为一条身份注释的新格式', () => {
  const run = runtime(), q = run.legacy(provider), a = run.legacy(provider, 'ANSWER'); q.note.addChild(a.note);
  const personal = { text: '个人笔记', type: 'TextNote', markdown: false }, drawing = { type: 'PaintNote', paint: '我的手写' };
  const prefix = provider === '408' ? 'DAGUANYUAN_408_' : 'DAGUANYUAN_';
  [q, a].forEach((entry, index) => {
    entry.note.comments[0].text = entry.body;
    entry.note.comments[1].text = run.C.metadata({ id: 123, source: '2026年' }, entry.url, provider, index ? 'ANSWER' : undefined, entry.raw, entry.body)
      + '\n\n<!-- DAGUANYUAN_SOURCE_STAMP:300:abc:abc -->\n\n<!-- DAGUANYUAN_RENDERED_STAMP:301:def:def -->'
      + '\n\n<!-- DAGUANYUAN_SOURCE_STAMP:314:d999c7df:43d28f17 -->\n\n<!-- DAGUANYUAN_RENDERED_STAMP:315:abcd:ef01 -->'
      + '\n\n<!-- DAGUANYUAN_SOURCE_LINK:' + provider + ':123 -->'
      + '\n\n<!-- ' + prefix + (index ? 'ANSWER_URL:' : 'URL:') + entry.url + ' -->'
      + (index ? '\n\n<!-- ' + prefix + 'ANSWER_PART:answer -->' : '');
    entry.note.comments.push(personal, drawing);
  });
  const bodies = [q.note.comments[0], a.note.comments[0]], links = [q, a].map(entry => entry.note.comments[1].text.split('\n')[0]);
  assert.equal(run.preview().jobs.length, 2); assert.equal(run.fix().repairedCount, 2);
  [q, a].forEach((entry, index) => {
    const note = entry.note;
    assert.equal(note.comments[0], bodies[index]); assert.equal(note.comments[1].text.split('\n')[0], links[index]);
    assert.equal((note.comments[1].text.match(/<!--/g) || []).length, 1);
    assert.doesNotMatch(note.comments[1].text, /DAGUANYUAN_(?:408_)?(?:URL|ANSWER_URL|ANSWER_PART):|DAGUANYUAN_SOURCE_LINK:/);
    assert.equal(run.C.read(note, 123, provider, index ? 'ANSWER' : undefined).url, entry.url);
    assert.equal(note.comments[2], personal); assert.equal(note.comments[3], drawing);
  });
  assert.equal(run.preview().jobs.length, 0); assert.equal(run.fix().repairedCount, 0);
});

test('修复从只有查看原题链接的父题卡补齐答案卡网址和年份，父卡改名不丢失来源', () => {
  const run = runtime(), parent = run.create('我的题卡'), answer = run.create('答案与解析'); parent.addChild(answer);
  const url = 'https://www.408os.cn/exercise?knowledgeId=7&questionId=123';
  parent.appendMarkdownComment('题干'); parent.appendMarkdownComment(run.C.metadata({ id: 123, source: '2010年' }, url, '408', undefined, '题干', '题干'));
  answer.appendMarkdownComment('### 答案\n\nC'); answer.appendMarkdownComment('<!-- DAGUANYUAN_408_ANSWER_ID:123 -->');
  const prepared = run.preview(); assert.equal(prepared.questionCount, 0); assert.equal(prepared.answerCount, 1);
  assert.equal(run.apply(prepared).repairedCount, 1);
  const link = run.context.__DAGUANYUAN_SOURCE_LINK_GLOBAL__.fromComment(answer.comments[1].text);
  assert.equal(link.url, url); assert.equal(link.year, 2010); assert.equal(link.questionId, 123);
  const source = run.context.__DAGUANYUAN_MATH_IMPORT_GLOBAL__.linkedQuestion(parent);
  assert.equal(source.url, url); assert.equal(source.year, 2010);
  assert.equal(run.preview().jobs.length, 0);
});

test('答案补链接的预览之后父题卡来源被修改时，跳过答案卡，保留原内容', () => {
  const run = runtime(), parent = run.create('题卡'), answer = run.create('答案与解析'); parent.addChild(answer);
  const url = 'https://www.cxyonly.fans/math/practice/1?questionId=123';
  parent.appendMarkdownComment('题干'); parent.appendMarkdownComment(run.C.metadata({ id: 123 }, url, 'math', undefined, '题干', '题干'));
  answer.appendMarkdownComment('### 答案\n\nC'); answer.appendMarkdownComment('<!-- DAGUANYUAN_ANSWER_ID:123 -->');
  const prepared = run.preview(), before = structuredClone(answer.comments);
  parent.comments[1].text = run.C.metadata({ id: 123 }, url.replace('practice/1', 'practice/2'), 'math', undefined, '题干', '题干');
  const result = run.apply(prepared); assert.equal(result.repairedCount, 0); assert.equal(result.skippedCount, 1);
  assert.deepEqual(answer.comments, before);
});

test('旧网址注释和查看原题链接的网址不一致时跳过，不丢弃冲突的来源信息', () => {
  const run = runtime(), { note } = run.legacy('math');
  note.comments[0].text = note.comments[0].text.replace('practice/1?', 'practice/2?');
  const before = structuredClone(note.comments), prepared = run.preview();
  assert.equal(prepared.jobs.length, 0); assert.match(prepared.skipped[0].reason, /网址冲突/); assert.deepEqual(note.comments, before);
});

test('整理旧单题卡时保留单题来源标记，避免后续分类导入改变其位置', () => {
  const run = runtime(), { note } = run.legacy('408', undefined, false);
  note.comments[0].text += '\n\n<!-- DAGUANYUAN_SINGLE_IMPORT:1 -->';
  assert.equal(run.fix().repairedCount, 1);
  assert.doesNotMatch(note.comments[0].text, /DAGUANYUAN_/);
  assert.match(note.comments[1].text, /DAGUANYUAN_SINGLE_IMPORT:1/);
  assert.doesNotMatch(note.comments[1].text, /DAGUANYUAN_SOURCE_LINK:|DAGUANYUAN_408_URL:/);
  assert.equal(run.fix().repairedCount, 0);
});
