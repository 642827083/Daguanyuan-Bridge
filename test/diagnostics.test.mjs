import { withMathSite } from './helpers/math-site.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = withMathSite(fs.readFileSync(new URL('../src/DaguanyuanDiagnostics.js', import.meta.url), 'utf8'));
const persisted = '/documents/DaguanyuanBridge/logs/diagnostics.json';
const legacy = '/documents/cn.marginnote.daguanyuan-bridge/logs/diagnostics.json';
const legacyExport = '/temp/cn.marginnote.daguanyuan-bridge/diagnostic-export/Daguanyuan-Bridge-Diagnostics.txt';
function runtime(files = new Map(), options = {}) {
  const timers = [], exports = [], clipboard = {}, directories = new Set(), accesses = [];
  const app = { documentPath: '/documents', tempPath: '/temp', appVersion: '4.2', build: '1234', osType: 0,
    saveFileWithUti(path, uti) { exports.push({ path, uti }); } };
  const state = { failWrite: false, failRead: false, ...options };
  function data(text) { return { length: Buffer.byteLength(text), text,
    writeToFileAtomically(path, atomic) { accesses.push(path); assert.equal(atomic, true); if (state.failWrite) return false; files.set(path, text); return true; } }; }
  const context = { console, Application: { sharedInstance: () => app },
    __DAGUANYUAN_PLUGIN_INFO__: { version: '1.2.0' },
    NSFileManager: { defaultManager: () => ({ fileExistsAtPath(path) { accesses.push(path); return files.has(path) || directories.has(path); },
      createDirectoryAtPathWithIntermediateDirectoriesAttributes(path, parents, attributes) { accesses.push(path); assert.equal(parents, true); assert.equal(attributes, null); directories.add(path); return true; },
    }) },
    NSData: { dataWithContentsOfFile(path) { accesses.push(path); return state.failRead || !files.has(path) ? undefined : data(files.get(path)); },
      dataWithStringEncoding(text, encoding) { assert.equal(encoding, 4); return data(text); } },
    NSJSONSerialization: { dataWithJSONObjectOptions(value, option) { assert.equal(option, 0); return data(JSON.stringify(value)); },
      JSONObjectWithDataOptions(value) { try { return JSON.parse(value.text); } catch { return undefined; } } },
    NSTimer: { scheduledTimerWithTimeInterval(seconds, repeat, callback) {
      assert.equal(seconds, 1); assert.equal(repeat, false);
      const timer = { active: true, invalidate() { this.active = false; }, fire() { if (this.active) { this.active = false; callback(); } } };
      timers.push(timer); return timer;
    } }, UIPasteboard: { generalPasteboard: () => clipboard },
  };
  vm.createContext(context); vm.runInContext(source, context);
  const logs = context.__DAGUANYUAN_DIAGNOSTICS_GLOBAL__;
  return { logs, files, timers, exports, clipboard, state, app, context, accesses,
    snapshot() { const text = logs.text(); return JSON.parse(text.slice(text.indexOf('{'))); } };
}

test('日志按批次原子保存，错误立即保存，重启后保留历史并记录环境和会话', () => {
  const run = runtime();
  const taskId = run.logs.begin('import.single', { provider: 'math', questionId: 42 });
  assert.equal(run.files.size, 0); assert.equal(run.timers.length, 1);
  run.logs.info('import.progress', { taskId, processed: 1 }); assert.equal(run.timers.length, 1);
  run.timers[0].fire(); assert.ok(run.files.has(persisted));
  run.logs.error('import.failure', Error('题目接口请求失败'), { taskId, stage: '读取题目', httpStatus: 503 });
  assert.equal(JSON.parse(run.files.get(persisted)).entries.at(-1).level, 'error');
  const restarted = runtime(run.files), snapshot = restarted.snapshot();
  assert.equal(snapshot.entries.filter(row => row.event === 'session.start').length, 2);
  assert.equal(new Set(snapshot.entries.map(row => row.session)).size, 2);
  assert.equal(snapshot.environment.pluginVersion, '1.2.0'); assert.equal(snapshot.environment.mnVersion, '4.2');
  assert.equal(snapshot.entries.find(row => row.event === 'import.failure').details.taskId, taskId);
});

test('只记录允许的技术字段，过滤登录凭据、正文、个人路径和非插件堆栈', () => {
  const run = runtime();
  const failure = Error('读取失败\nAuthorization: Bearer super-secret\nCookie=session-private\nurl=https://site.test/private?token=url-secret\nC:\\Users\\Private Person\\notes\\file.pdf\n/Users/another-secret/file.pdf\n题干：sensitive question\n{"stem":"json-question"}');
  failure.stage = '读取题目';
  failure.stack = 'Error: sensitive question\n at write (C:\\Users\\Private Person\\DaguanyuanMathImport.js:42:9)\n native@/Users/private-person/system.js:10\n at main.js:20:3';
  run.logs.error('image.read', failure, { provider: 'math', questionId: 8, token: 'raw-token', payload: { stem: 'private stem' }, noteTitle: 'private title', stage: '读取图片' });
  const snapshot = run.snapshot(), text = JSON.stringify(snapshot);
  for (const secret of ['super-secret', 'session-private', 'url-secret', 'Private Person', 'another-secret', 'sensitive question', 'json-question', 'private stem', 'private title', 'raw-token', 'system.js', 'private-person']) assert.equal(text.includes(secret), false, secret);
  const entry = snapshot.entries.at(-1);
  assert.deepEqual(entry.details, { provider: 'math', questionId: 8, stage: '读取图片' });
  assert.match(entry.error.stack, /DaguanyuanMathImport.js:42:9/); assert.match(entry.error.stack, /main.js:20:3/);
});

test('分类诊断导出保留刷新状态和学习集归属关系，重启后也不包含卡片名称或真实 ID', () => {
  const run = runtime(), view = {}, memory = { noteId: 'private-old-note', notebookId: 'private-old-book', parentNote: { noteTitle: '旧学习集私有分类' } };
  const focus = { noteId: 'private-new-note', notebookId: 'private-new-book', parentNote: { noteTitle: '新学习集私有分类' } };
  run.app.studyController = () => ({ view, notebookController: { notebookId: 'private-new-book', focusNote: focus, visibleFocusNote: focus } });
  run.context.__DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__ = { parentTitle: note => note.parentNote.noteTitle };
  vm.runInContext(withMathSite(fs.readFileSync(new URL('../src/DaguanyuanFocusNextUI.js', import.meta.url), 'utf8')), run.context);
  const addon = { window: {}, __daguanyuanFocusNextLastFocus: memory, __daguanyuanFocusNextOpeningNotebookId: 'private-new-book',
    __daguanyuanFocusNextTickAt: Date.now() - 6000, __daguanyuanFocusNextTickCount: 12, __daguanyuanFocusNextRememberToken: 3,
    __daguanyuanFocusCategoryButton: { hidden: false, superview: view, __daguanyuanDisplayedCategoryTitle: '旧学习集私有分类' } };
  run.context.__DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__.diagnose(addon, 'copy_logs');
  // 主动导出时，未落盘的诊断记录也必须被包含。
  const entry = run.snapshot().entries.find(row => row.event === 'focus.trace');
  assert.equal(entry.details.tickCount, 12); assert.equal(entry.details.loopGeneration, 3);
  assert.ok(entry.details.heartbeatAgeMs >= 6000);
  assert.equal(entry.details.categoryState, 'attached'); assert.equal(entry.details.focusInNotebook, 'match');
  assert.equal(entry.details.memoryInNotebook, 'mismatch'); assert.equal(entry.details.categoryMatchesFocus, 'mismatch');
  assert.equal(entry.details.notebookMatchesOpening, 'match');
  const restarted = runtime(run.files).snapshot().entries.find(row => row.event === 'focus.trace');
  assert.deepEqual(restarted.details, entry.details);
  assert.doesNotMatch(JSON.stringify([entry, restarted]), /private-|私有分类|noteId|notebookId/);
});

test('最近记录最多 2000 条，UTF-8 和原生序列化后的文件均不超过 1 MB', () => {
  const run = runtime();
  for (let index = 0; index < 2300; index++) run.logs.info('test.count', { processed: index });
  let rows = run.snapshot().entries;
  assert.equal(rows.length, 2000); assert.equal(rows[0].details.processed, 300); assert.equal(rows.at(-1).details.processed, 2299);
  // 使用可变长度中文及 emoji 验证字节上限，而非只按字符串长度计算。
  for (let index = 0; index < 900; index++) run.logs.error('test.bytes', Error('汉字🙂'.repeat(150)), { processed: index });
  assert.ok(Buffer.byteLength(run.files.get(persisted)) <= 1024 * 1024);
  rows = run.snapshot().entries; assert.ok(rows.length < 2000); assert.equal(rows.at(-1).details.processed, 899);
});

test('写盘失败不影响操作且保留内存记录，恢复后可重试保存', () => {
  const run = runtime(new Map(), { failWrite: true });
  assert.doesNotThrow(() => run.logs.error('storage.failure', Error('写盘失败')));
  assert.equal(run.logs.flush(), false); assert.match(run.snapshot().storageWarning, /保存失败/);
  assert.equal(run.snapshot().entries.at(-1).event, 'storage.failure');
  run.state.failWrite = false; assert.equal(run.logs.flush(), true); assert.equal(run.snapshot().storageWarning, '');
  assert.equal(JSON.parse(run.files.get(persisted)).entries.at(-1).event, 'storage.failure');
});

test('空文件、非法 JSON、未知 schema 和读取失败均保留原文件，清空可恢复持久化', () => {
  for (const content of ['', '{invalid', 'null', '{"schemaVersion":2,"entries":[]}']) {
    const run = runtime(new Map([[persisted, content]]));
    assert.doesNotThrow(() => run.logs.info('test.memory'));
    assert.match(run.snapshot().storageWarning, /读取失败/); assert.equal(run.files.get(persisted), content);
    assert.equal(run.logs.clear(), true); assert.deepEqual(JSON.parse(run.files.get(persisted)).entries, []);
    run.logs.info('test.recovered'); assert.equal(run.logs.flush(), true);
  }
  const run = runtime(new Map([[persisted, '{"schemaVersion":1,"entries":[]}']]), { failRead: true });
  run.logs.info('test.memory'); assert.equal(run.logs.flush(), false); assert.match(run.snapshot().storageWarning, /读取失败/);
});

test('清空取消延迟保存，重启不恢复旧记录，保存失败正确返回失败', () => {
  const run = runtime(); run.logs.info('test.old'); const old = run.timers[0];
  assert.equal(run.logs.clear(), true); old.fire();
  assert.deepEqual(run.snapshot().entries, []);
  assert.equal(runtime(run.files).snapshot().entries.some(row => row.event === 'test.old'), false);
  run.logs.info('test.new'); run.state.failWrite = true;
  assert.equal(run.logs.clear(), false); run.state.failWrite = false; assert.equal(run.logs.flush(), true);
  assert.deepEqual(JSON.parse(run.files.get(persisted)).entries, []);
});

test('导出和复制包含未落盘日志，导出固定临时文件并使用纯文本类型', () => {
  const run = runtime(new Map(), { failWrite: true }); run.logs.info('test.unsaved');
  run.logs.copy(); assert.match(run.clipboard.string, /test.unsaved/); assert.match(run.clipboard.string, /保存失败/);
  assert.throws(() => run.logs.exportFile(), /导出文件写入失败/);
  run.state.failWrite = false; run.logs.exportFile(); run.logs.exportFile();
  assert.equal(run.exports.length, 2); assert.equal(run.exports[0].uti, 'public.plain-text');
  assert.equal(run.exports[0].path, run.exports[1].path); assert.match(run.files.get(run.exports[0].path), /test.unsaved/);
  assert.equal(run.logs.clear(), true); assert.equal(run.files.get(run.exports[0].path), '');
  delete run.app.saveFileWithUti; assert.throws(() => run.logs.exportFile(), /使用复制日志/);
});

test('导入结果关联任务，仅记录计数与前 20 项失败，不记录题目来源或报告正文', () => {
  const run = runtime(); const taskId = run.logs.begin('import.category', { provider: '408' });
  run.logs.result('import.category', taskId, { total: 50, createdCount: 25, skippedCount: 0,
    failed: Array.from({ length: 25 }, (_, index) => ({ questionId: index + 1, source: 'private-source', reason: '保存题卡失败', stage: '保存图片' })) }, { provider: '408' });
  const snapshot = run.snapshot(), result = snapshot.entries.find(row => row.event === 'import.category.result');
  assert.equal(result.details.taskId, taskId); assert.equal(result.details.failedCount, 25); assert.equal(result.details.status, 'partial');
  assert.equal(snapshot.entries.filter(row => row.event === 'import.category.item').length, 20);
  assert.equal(JSON.stringify(snapshot).includes('private-source'), false);
});

test('错误对象的异常 getter 或运行时缺失不会让日志接口抛出', () => {
  const run = runtime(); const error = { get message() { throw Error('getter'); }, get stack() { throw Error('getter'); } };
  assert.doesNotThrow(() => run.logs.error('test.getter', error));
  delete run.context.Application; delete run.context.NSTimer;
  assert.doesNotThrow(() => run.logs.info('test.no.native')); assert.equal(run.logs.flush(), false);
});

test('网页原生异常提取具体消息及行列，只保存插件脚本名，重启后保留诊断字段', () => {
  const run = runtime();
  const error = { localizedDescription: () => '发生 JS 异常', code: () => 4, userInfo: () => ({ objectForKey(key) {
    return { WKJavaScriptExceptionMessage: 'TypeError: 保存失败 token=private-token', WKJavaScriptExceptionLineNumber: 72,
      WKJavaScriptExceptionColumnNumber: 9, WKJavaScriptExceptionSourceURL: 'https://site.test/private/DaguanyuanMasteryPage.js?token=source-secret', Cookie: 'private-cookie' }[key];
  } }) };
  const normalized = run.logs.normalizeError(error, 'read_receipt');
  run.logs.error('mastery.save.result', normalized, { questionId: 1214, provider: 'math', mastery: 'mastered' });
  const entry = runtime(run.files).snapshot().entries.find(row => row.event === 'mastery.save.result');
  assert.match(entry.error.message, /TypeError: 保存失败/);
  assert.equal(entry.error.line, 72); assert.equal(entry.error.column, 9); assert.equal(entry.error.nativeCode, 4);
  assert.equal(entry.error.script, 'DaguanyuanMasteryPage.js'); assert.equal(entry.error.stage, 'read_receipt');
  assert.equal(entry.details.mastery, 'mastered');
  assert.doesNotMatch(JSON.stringify(entry), /private-token|private-cookie|source-secret|site.test/);
});

test('图片失败只保留允许的计数及状态，重启后仍过滤额外诊断数据', () => {
  const run = runtime();
  const error = Error('图片保存失败'); error.diagnostics = { imageCount: 3, base64Chars: 1024, remainingImages: 1, processorAvailable: true,
    mediaChanged: false, html: '<p>private html</p>', originalImage: 'data:image/png;base64,private-image', file: '/Users/private/image.png' };
  run.logs.error('image.save', error);
  const snapshot = runtime(run.files).snapshot();
  assert.deepEqual(snapshot.entries.find(row => row.event === 'image.save').error.image, { imageCount: 3, base64Chars: 1024, remainingImages: 1, mediaChanged: false, processorAvailable: true });
  assert.equal(JSON.stringify(snapshot).includes('private'), false);
});

test('原生序列化长度异常不会清空内存记录，恢复后正常保存', () => {
  const run = runtime(); run.logs.info('test.keep');
  const original = run.context.NSJSONSerialization.dataWithJSONObjectOptions;
  run.context.NSJSONSerialization.dataWithJSONObjectOptions = () => ({ writeToFileAtomically() { throw Error('不应写入'); } });
  assert.equal(run.logs.flush(), false);
  assert.ok(run.snapshot().entries.some(row => row.event === 'test.keep'));
  run.context.NSJSONSerialization.dataWithJSONObjectOptions = original; assert.equal(run.logs.flush(), true);
});

test('记录、重启、导出和清空仅访问 DaguanyuanBridge，不迁移旧测试日志或索引', () => {
  const catalog = '/documents/DaguanyuanBridge/category-catalog.json', mappings = '/documents/DaguanyuanBridge/category-mappings.json';
  const index = '/documents/cn.marginnote.daguanyuan-bridge/math-import-index.json';
  const old = new Map([[legacy, '{"schemaVersion":1,"entries":[{"event":"old.history"}]}'], [legacyExport, 'old-export'], [index, 'unused-index'], [catalog, 'catalog-content'], [mappings, 'bindings-content']]);
  const run = runtime(new Map(old)); run.logs.info('test.current'); run.logs.exportFile(); run.logs.copy();
  assert.equal(run.exports[0].path, '/temp/DaguanyuanBridge/diagnostic-export/Daguanyuan-Bridge-Diagnostics.txt');
  assert.ok(run.snapshot().entries.some(row => row.event === 'test.current'));
  assert.equal(run.snapshot().entries.some(row => row.event === 'old.history'), false);
  assert.equal(run.logs.clear(), true);
  const restarted = runtime(run.files); restarted.snapshot();
  assert.ok([...run.accesses, ...restarted.accesses].every(path => /^\/(documents|temp)\/DaguanyuanBridge\//.test(path)));
  for (const [path, content] of old) assert.equal(run.files.get(path), content);
});

test('重启读取历史日志时保留脱敏提示，过滤结果保持一致', () => {
  const run = runtime(); run.logs.error('test.redacted', Error('读取失败 /Users/private/file.pdf'));
  const first = run.snapshot().entries.find(row => row.event === 'test.redacted');
  const second = runtime(run.files).snapshot().entries.find(row => row.event === 'test.redacted');
  assert.deepEqual(second.error, first.error); assert.equal(second.error.message.includes('/Users/private'), false);
});

