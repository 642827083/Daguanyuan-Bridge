import { withMathSite } from './helpers/math-site.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function runtime(provider, records) {
  const notes = new Map(); let serial = 0;
  function create(title) {
    const note = { noteId: String(++serial), noteTitle: title, childNotes: [], comments: [],
      addChild(child) { child.parentNote = this; this.childNotes.push(child); },
      insertChildBefore(child, before) { child.parentNote = this; this.childNotes.splice(this.childNotes.indexOf(before), 0, child); } };
    notes.set(note.noteId, note); return note;
  }
  const sandbox = { console, MNUtil: { getNoteById: id => notes.get(id) },
    __DAGUANYUAN_408_CATALOG_DATA__: { records, years: [2026, 2025] } };
  vm.createContext(sandbox);
  vm.runInContext(withMathSite(readFileSync(new URL('../src/DaguanyuanCategoryRoutes.js', import.meta.url), 'utf8')), sandbox);
  sandbox.__DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.replaceCatalog({ records });
  const source = withMathSite(readFileSync(new URL('../src/DaguanyuanMathImport.js', import.meta.url), 'utf8'));
  vm.runInContext(source.replace('return { importedQuestionIds,', 'return { orderingProbe: findOrCreatePath, importedQuestionIds,'), sandbox);
  const context = { topicId: 'study', database: { createNoteWithTitleTopicid: create } };
  const root = create('Daguanyuan Bridge');
  return { root, create, sandbox, context,
    insert(path) { return sandbox.__DAGUANYUAN_MATH_IMPORT_GLOBAL__.orderingProbe(root, path, context, provider); } };
}

for (const provider of ['math', '408']) {
  test(provider + ' 分类逆序补导按目录插入，重复导入复用，未知手工节点保留', () => {
    const r = runtime(provider, [[1, 0, '学科'], [30, 1, '第一章'], [10, 1, '第二章'], [20, 1, '第三章']]);
    const prefix = provider === '408' ? ['408', '学科'] : ['学科'];
    const third = r.insert([...prefix, '第三章']); const parent = third.parentNote;
    const personal = r.create('手写笔记'); parent.addChild(personal);
    r.insert([...prefix, '第一章']); r.insert([...prefix, '第二章']);
    assert.deepEqual(parent.childNotes.map(n => n.noteTitle), ['第一章', '第二章', '第三章', '手写笔记']);
    assert.equal(r.insert([...prefix, '第三章']), third);
    assert.equal(parent.childNotes.length, 4); assert.equal(parent.childNotes[3], personal);
  });
}

test('数学独立导入使用会话在线目录，而非全局目录或分类 ID 数值顺序', () => {
  const r = runtime('math', [[1, 0, '学科'], [2, 1, '第二章'], [3, 1, '第一章']]);
  r.context.categoryRoutes = r.sandbox.__DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.forCatalog({ records: [[1, 0, '学科'], [3, 1, '第一章'], [2, 1, '第二章']] });
  const second = r.insert(['学科', '第二章']); r.insert(['学科', '第一章']);
  assert.deepEqual(second.parentNote.childNotes.map(n => n.noteTitle), ['第一章', '第二章']);
});

test('408 年份目录按已有年份清单插入，保留原年份卡片', () => {
  const r = runtime('408', [[1, 0, '数据结构']]);
  const old = r.insert(['408', '2025年真题']); r.insert(['408', '2026年真题']);
  assert.deepEqual(old.parentNote.childNotes.map(n => n.noteTitle), ['2026年真题', '2025年真题']);
});

test('缺少原生插入接口时明确报错，避免悄悄追加到错误位置', () => {
  const r = runtime('math', [[1, 0, '学科'], [2, 1, '第一章'], [3, 1, '第二章']]);
  const second = r.insert(['学科', '第二章']); second.parentNote.insertChildBefore = undefined;
  assert.throws(() => r.insert(['学科', '第一章']), /无法按章节顺序插入分类/);
  assert.deepEqual(second.parentNote.childNotes.map(n => n.noteTitle), ['第二章']);
});
