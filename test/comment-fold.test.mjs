import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function runtime() {
  const stored = new Map(), notes = new Map(), timers = [], writes = [];
  const notebook = { notes: [] }, selection = { notebookId: 'study' };
  class NSNull { toJSON() { return null; } }
  const context = {
    console,
    NSNull,
    NSUserDefaults: { standardUserDefaults: () => ({ objectForKey: key => stored.get(key), setObjectForKey: (v, k) => stored.set(k, v) }) },
    Application: { sharedInstance: () => ({ studyController: () => ({ notebookController: selection }) }) },
    Database: { sharedInstance: () => ({ getNotebookById: id => id === 'study' ? notebook : null, getNoteById: id => notes.get(id) }) },
    NSTimer: { scheduledTimerWithTimeInterval(time, repeats, fn) { timers.push(fn); return { invalidate() {} }; } },
  };
  vm.createContext(context);
  for (const name of ['DaguanyuanSourceLink', 'DaguanyuanCardComments', 'DaguanyuanCommentFold']) {
    vm.runInContext(readFileSync(new URL('../src/' + name + '.js', import.meta.url), 'utf8'), context);
  }
  const api = context.__DAGUANYUAN_COMMENT_FOLD_GLOBAL__;
  function create(options = {}) {
    const id = 'n' + (notes.size + 1), provider = options.provider || 'math';
    const url = provider === 'math' ? 'https://www.cxyonly.fans/math/practice/1?questionId=123' : 'https://www.408os.cn/exercise?year=2026&questionId=123';
    const metadata = context.__DAGUANYUAN_CARD_COMMENTS_GLOBAL__.metadata({ id: 123 }, url, provider, options.role);
    const source = { text: metadata, index: 7, commentId: options.old ? null : 'stable-' + id, ownerNoteId: options.owner || id, collapsed: false };
    if (options.boxedNull) source.commentId = new NSNull();
    const body = { text: '题目正文', index: 3, collapsed: false };
    const drawing = { type: 'PaintNote', paint: '手写', index: 8, collapsed: false };
    const personal = { text: '[查看原题](https://example.com/)', index: 1, collapsed: false };
    const note = { noteId: id, notebookId: 'study', comments: [body, personal, source, drawing], childNotes: [],
      commentState() { return options.readError || { ok: true, revision: 'revision-' + id, comments: this.comments }; },
      setCommentsCollapsed(targets, collapsed, revision) {
        writes.push({ id, targets: JSON.parse(JSON.stringify(targets)), collapsed, revision });
        const target = writes.at(-1).targets[0];
        const byIndex = Number.isSafeInteger(target.index) && target.index > 0;
        const byId = typeof target.ownerNoteId === 'string' && target.ownerNoteId.length > 0 && typeof target.commentId === 'string' && target.commentId.length > 0;
        if (byIndex === byId) return { ok: false, error: { code: 'INVALID_INPUT', message: 'Select by index OR by ownerNoteId + commentId.' } };
        if (options.writeError) return options.writeError;
        source.collapsed = collapsed;
        return { ok: true, persisted: true, changedCount: 1 };
      },
    };
    notes.set(id, note); notebook.notes.push(note);
    return { note, source, body, personal, drawing };
  }
  return { api, context, stored, notes, notebook, selection, timers, writes, create, addon: { window: {} } };
}

test('原生 NSNull 评论 ID 不能当成有效身份，必须按读取到的评论序号折叠', () => {
  const r = runtime(), n = r.create({ boxedNull: true });
  assert.equal(r.api.fold(n.note, true).changed, true);
  assert.deepEqual(r.writes[0].targets, [{ index: 7 }]);
  assert.equal(n.body.collapsed, false); assert.equal(n.drawing.collapsed, false);
});

test('210 张旧题卡的原生空评论 ID 批量折叠不再全部报目标选择错误', async () => {
  const r = runtime(); for (let i = 0; i < 210; i++) r.create({ boxedNull: true });
  const pending = r.api.batch(r.addon, true);
  while (r.timers.length) r.timers.shift()();
  const result = await pending;
  assert.equal(result.failed.length, 0, result.failed[0]?.reason);
  assert.equal(result.changed, 210);
});

test('缺少任一有效字符串身份时只传序号，保持读取到的版本且支持展开', () => {
  for (const field of ['commentId', 'ownerNoteId']) for (const value of [undefined, '', '   ', 123, {}, new String('wrapped')]) {
    const r = runtime(), n = r.create(); n.source[field] = value; n.source.collapsed = true;
    assert.equal(r.api.fold(n.note, false).changed, true);
    assert.deepEqual(r.writes[0].targets, [{ index: 7 }]);
    assert.equal(r.writes[0].revision, 'revision-n1'); assert.equal(n.source.collapsed, false);
  }
});

test('自动折叠默认关闭并保存选择，关闭不会改动已有卡片', () => {
  const r = runtime(), { note } = r.create();
  assert.equal(r.api.enabled(), false);
  const ctx = { database: { getNoteById: id => r.notes.get(id) } };
  r.api.enqueue(ctx, note); assert.equal(ctx.commentFoldPending, undefined);
  r.api.setEnabled(true); assert.equal(r.api.enabled(), true);
  r.api.enqueue(ctx, note); r.api.enqueue(ctx, note); assert.equal(r.api.flush(ctx).length, 0);
  assert.equal(r.writes.length, 1);
  r.api.setEnabled(false); assert.equal(note.comments[2].collapsed, true);
});

for (const provider of ['math', '408']) for (const role of [undefined, 'ANSWER']) {
  test(provider + ' ' + (role || 'QUESTION') + ' 识别移动后的原题评论，按稳定身份折叠并可展开', () => {
    const r = runtime(), n = r.create({ provider, role, owner: 'original-owner' });
    assert.equal(r.api.fold(n.note, true).changed, true);
    assert.deepEqual(r.writes[0].targets, [{ ownerNoteId: 'original-owner', commentId: 'stable-n1' }]);
    assert.equal(r.writes[0].revision, 'revision-n1');
    assert.equal(n.body.collapsed, false); assert.equal(n.personal.collapsed, false); assert.equal(n.drawing.collapsed, false);
    assert.equal(r.api.fold(n.note, true).unchanged, true); assert.equal(r.writes.length, 1);
    assert.equal(r.api.fold(n.note, false).changed, true); assert.equal(n.source.collapsed, false);
  });
}

test('旧评论使用接口返回的一起始序号，普通卡片与其他插件链接不处理', () => {
  const r = runtime(), n = r.create({ old: true }); r.api.fold(n.note, true);
  assert.deepEqual(r.writes[0].targets, [{ index: 7 }]);
  n.note.comments = [n.body, n.personal, { text: '[查看原题](marginnote4app://addon/yankean-bridge?x=1)' }];
  assert.equal(r.api.fold(n.note, true).skipped, true); assert.equal(r.writes.length, 1);
});

test('重复来源、读取失败、版本冲突及未保存均明确失败，不改版本重试', () => {
  const r = runtime(), duplicate = r.create(); duplicate.note.comments.push({ ...duplicate.source });
  assert.throws(() => r.api.fold(duplicate.note, true), /重复/); assert.equal(r.writes.length, 0);
  const stale = r.create({ writeError: { ok: false, error: { code: 'COMMENT_CHANGED', message: '评论已变化' } } });
  assert.throws(() => r.api.fold(stale.note, true), e => e.code === 'COMMENT_CHANGED'); assert.equal(r.writes.length, 1);
  const unsaved = r.create({ writeError: { ok: true, persisted: false } });
  assert.throws(() => r.api.fold(unsaved.note, true), /未确认保存/);
  const unreadable = r.create({ readError: { ok: false, error: { code: 'READ_ONLY', message: '只读' } } });
  assert.throws(() => r.api.fold(unreadable.note, true), /只读/);
});

test('旧宿主停止批量修改，自动折叠失败独立返回警告，已删除卡片跳过', async () => {
  const r = runtime(), n = r.create(); delete n.note.commentState;
  r.api.setEnabled(true); const ctx = { database: { getNoteById: id => r.notes.get(id) } };
  r.api.enqueue(ctx, n.note); ctx.commentFoldPending.push('deleted');
  const warnings = r.api.flush(ctx); assert.equal(warnings.length, 1); assert.match(warnings[0].reason, /不支持/);
  const result = await r.api.batch(r.addon, true);
  assert.match(result.interrupted, /不支持/); assert.equal(result.failed.length, 1); assert.equal(r.writes.length, 0);
});

test('批量去重遍历当前学习集，切换学习集或取消后停止后续批次', async () => {
  for (const reason of ['switch', 'cancel']) {
    const r = runtime(); for (let i = 0; i < 13; i++) r.create();
    r.notebook.notes.push(r.notebook.notes[0]);
    let active = true;
    const pending = r.api.batch(r.addon, true, undefined, () => active);
    assert.equal(r.writes.length, 10);
    if (reason === 'switch') r.selection.notebookId = 'other'; else active = false;
    r.timers.shift()(); const result = await pending;
    assert.equal(result.total, 13); assert.equal(result.changed, 10); assert.ok(result.interrupted); assert.equal(r.writes.length, 10);
  }
});

test('批量在开关关闭时仍可独立折叠、展开，连续批次完成后计数准确', async () => {
  const r = runtime(); for (let i = 0; i < 12; i++) r.create();
  const folded = r.api.batch(r.addon, true); r.timers.shift()();
  assert.equal((await folded).changed, 12); assert.equal(r.api.enabled(), false);
  const unchanged = r.api.batch(r.addon, true); r.timers.shift()();
  assert.equal((await unchanged).unchanged, 12);
  const unfolded = r.api.batch(r.addon, false); r.timers.shift()();
  assert.equal((await unfolded).changed, 12); assert.equal(r.writes.length, 24);
});
