import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const importerSource = fs.readFileSync(new URL('../src/DaguanyuanMathImport.js', import.meta.url), 'utf8');
const locatorURL = new URL('../src/DaguanyuanCardLocator.js', import.meta.url);
function runtime(options = {}) {
  let clock = 0, current = options.current === undefined ? 'book-a' : options.current;
  const timers = [], calls = [], cards = new Map(), books = new Map();
  const book = (id, title = id) => { const result = { topicId: id, title, notes: [] }; books.set(id, result); return result; };
  book('book-a', '当前学习集'); book('book-b', '目标学习集'); book('book-c', '另一个学习集');
  function card(bookId, id, question = 843, provider = '408', parent = null) {
    const note = { noteId: id, notebookId: bookId, noteTitle: '2026年 第44题', parentNote: parent, childNotes: [],
      comments: [{ text: `<!-- DAGUANYUAN_${provider === '408' ? '408_' : ''}QUESTION_ID:${question} -->` }] };
    cards.set(id, note); (parent ? parent.childNotes : books.get(bookId).notes).push(note); return note;
  }
  const study = { notebookController: { get notebookId() { return current; }, changeFocusToNote(note) { calls.push(['focus', note.noteId, clock]); } },
    focusNoteInMindMapById(id) { if (options.centerThrows) throw Error('画布不可用'); calls.push(['center', id, clock]); } };
  let choiceResolve, choiceReject;
  const addon = { window: {}, panelController: {} };
  const context = { console, Application: { sharedInstance() { return {
    studyController() { return study; }, openURL(url) {
      calls.push(['open', url, clock]);
      if (options.openThrows) throw Error('链接派发异常');
      if (options.switchAfter !== undefined) context.NSTimer.scheduledTimerWithTimeInterval(options.switchAfter, false, () => {
        current = cards.get(decodeURIComponent(url.split('/').at(-1)))?.notebookId;
        context.__DAGUANYUAN_CARD_LOCATOR_GLOBAL__?.resume(addon);
      });
      return false;
    },
  }; } }, Database: { sharedInstance() { return {
    getNotebookById(id) { return books.get(id); }, getNoteById(id) { return cards.get(id); },
    allNotebooks() { calls.push(['all-books']); return [...books.values()]; },
  }; } }, NSURL: { URLWithString: value => value },
  NSTimer: { scheduledTimerWithTimeInterval(delay, repeat, callback) {
    const timer = { at: clock + delay, active: true, invalidate() { this.active = false; }, fire() { if (this.active) callback(this); } };
    timer.callback = () => { if (timer.active) callback(timer); }; timers.push(timer); return timer;
  } },
  __DAGUANYUAN_MATH_API_GLOBAL__: { positiveInteger: v => { const n = Number(v); if (!Number.isSafeInteger(n) || n < 1) throw Error('题目 ID 无效'); return n; } },
  __DAGUANYUAN_CARD_LOCATOR_UI_GLOBAL__: { choose(controller, candidates) {
    calls.push(['choose', JSON.parse(JSON.stringify(candidates))]); return new Promise((resolve, reject) => { choiceResolve = resolve; choiceReject = reject; });
  }, cancel() { if (choiceReject) { choiceReject(Error('已取消定位')); choiceReject = null; } } },
  };
  vm.createContext(context);
  if (fs.existsSync(locatorURL)) vm.runInContext(fs.readFileSync(locatorURL, 'utf8'), context);
  vm.runInContext(importerSource, context);
  async function flush() { for (let i = 0; i < 15; i++) await Promise.resolve(); }
  async function advance(seconds) {
    const target = clock + seconds; await flush();
    for (let i = 0; i < 10000; i++) {
      const timer = timers.filter(t => t.active && t.at <= target).sort((a, b) => a.at - b.at)[0];
      if (!timer) break;
      clock = timer.at; timer.callback(); timer.active = false; await flush();
    }
    clock = target; await flush();
  }
  return { addon, context, calls, cards, books, card, advance, flush,
    locate(id = 843, provider = '408') { return Promise.resolve().then(() => context.__DAGUANYUAN_MATH_IMPORT_GLOBAL__.focusQuestion(addon, id, provider)); },
    choose(index) { const candidates = calls.find(call => call[0] === 'choose')[1]; choiceResolve(candidates[index]); },
    switchTo(id) { current = id; }, get activeTimers() { return timers.filter(t => t.active).length; },
  };
}

test('当前学习集不要求打开来源文档，切焦点后等待布局再定位居中', async () => {
  const run = runtime(); run.card('book-a', 'target');
  const pending = run.locate(); await run.flush();
  assert.deepEqual(run.calls, [['focus', 'target', 0]]);
  await run.advance(0.079); assert.equal(run.calls.some(c => c[0] === 'center'), false);
  await run.advance(0.2); assert.equal((await pending).noteId, 'target');
  assert.equal(run.calls.filter(c => c[0] === 'center').length, 1);
  assert.ok(run.calls.find(c => c[0] === 'center')[2] >= 0.08);
  assert.equal(run.activeTimers, 0);
});

test('跨学习集先打开卡片链接，确认切换后进入焦点并居中，openURL 返回 false 不误报失败', async () => {
  const run = runtime({ switchAfter: 0.4 }); run.card('book-b', 'target-b');
  const pending = run.locate(); await run.flush();
  assert.equal(run.calls.find(c => c[0] === 'open')[1], 'marginnote4app://note/target-b');
  assert.equal(run.calls.some(c => c[0] === 'focus'), false);
  await run.advance(1);
  assert.equal((await pending).notebookId, 'book-b');
  assert.ok(run.calls.find(c => c[0] === 'focus')[2] >= 0.6);
  assert.equal(run.calls.find(c => c[0] === 'center')[1], 'target-b');
  assert.equal(run.activeTimers, 0);
});

test('当前学习集匹配优先，其他学习集和数学同 ID 卡片不会误配', async () => {
  const run = runtime(); run.card('book-a', 'math', 843, 'math'); run.card('book-b', 'other-408'); run.card('book-a', 'local-408');
  const pending = run.locate(); await run.advance(1);
  assert.equal((await pending).noteId, 'local-408');
  assert.equal(run.calls.some(c => c[0] === 'all-books' || c[0] === 'choose' || c[0] === 'open'), false);
});

test('多个匹配题卡由用户选择，不按遍历顺序定位，重复引用和循环只计一次', async () => {
  const run = runtime({ switchAfter: 0.3 }); const first = run.card('book-b', 'first'); const second = run.card('book-c', 'second');
  first.childNotes.push(first); run.books.get('book-b').notes.push(first);
  const pending = run.locate(); await run.flush();
  const choices = run.calls.find(c => c[0] === 'choose')[1];
  assert.equal(choices.length, 2); assert.equal(run.calls.some(c => c[0] === 'open'), false);
  run.choose(choices.findIndex(c => c.noteId === second.noteId)); await run.advance(1);
  assert.equal((await pending).noteId, 'second');
});

test('未打开学习集也能查找已有题卡，当前学习集重复题卡同样提供选择', async () => {
  const run = runtime({ current: '', switchAfter: 0.2 }); run.card('book-b', 'target');
  const pending = run.locate(); await run.advance(1); assert.equal((await pending).noteId, 'target');
  const duplicate = runtime(); duplicate.card('book-a', 'one'); duplicate.card('book-a', 'two');
  const selecting = duplicate.locate(); await duplicate.flush(); duplicate.choose(1); await duplicate.advance(1);
  assert.equal((await selecting).noteId, 'two');
});

test('切换超时、居中失败和场景关闭均清理状态，迟到切换不再改变焦点', async () => {
  const timeout = runtime(); timeout.card('book-b', 'target'); const pending = timeout.locate();
  const rejected = assert.rejects(pending, /切换.*超时/); await timeout.advance(12); await rejected;
  timeout.switchTo('book-b'); timeout.context.__DAGUANYUAN_CARD_LOCATOR_GLOBAL__.resume(timeout.addon); await timeout.advance(1);
  assert.equal(timeout.calls.some(c => c[0] === 'focus'), false); assert.equal(timeout.activeTimers, 0);
  const failed = runtime({ centerThrows: true }); failed.card('book-a', 'target');
  const error = assert.rejects(failed.locate(), /画布不可用/); await failed.advance(1); await error;
  assert.equal(failed.addon.__daguanyuanCardLocation, null);
  const closed = runtime(); closed.card('book-a', 'target');
  const cancelled = closed.locate(); await closed.flush(); const result = assert.rejects(cancelled, /取消/);
  closed.context.__DAGUANYUAN_CARD_LOCATOR_GLOBAL__.cancel(closed.addon); await result; await closed.advance(1);
  assert.equal(closed.calls.some(c => c[0] === 'center'), false);
});

test('选择后目标被删除、移走或学习集改变时停止，并阻止并发请求', async () => {
  const run = runtime(); run.card('book-a', 'one'); run.card('book-a', 'two');
  const pending = run.locate(); await run.flush(); await assert.rejects(run.locate(), /正在定位/);
  run.cards.delete('two'); run.choose(1); await assert.rejects(pending, /不存在|同步/);
  const changed = runtime(); changed.card('book-a', 'target');
  const rejected = assert.rejects(changed.locate(), /学习集.*切换/); await changed.flush(); changed.switchTo('book-c'); await changed.advance(1); await rejected;
});

test('选择列表超时可重试，找不到题卡时提示所有学习集并结束', async () => {
  const run = runtime(); run.card('book-a', 'one'); run.card('book-a', 'two');
  const pending = assert.rejects(run.locate(), /选择.*超时/); await run.advance(121); await pending;
  assert.equal(run.addon.__daguanyuanCardLocation, null); assert.equal(run.activeTimers, 0);
  const empty = runtime(); await assert.rejects(empty.locate(), /学习集.*没有/); assert.equal(empty.activeTimers, 0);
});
