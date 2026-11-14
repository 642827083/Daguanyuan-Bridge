var __DAGUANYUAN_DIAGNOSTICS_GLOBAL__ = (function () {
  const DIRECTORY_NAME = 'DaguanyuanBridge';
  const MAX_ENTRIES = 2000, MAX_BYTES = 1024 * 1024;
  const KEYS = 'taskId provider scope examSubject command action stage status mastery httpStatus questionId total createdCount answerAddedCount skippedCount failedCount processed elapsedMs mode pluginVersion mnVersion mnBuild osType notebookSequence notebookMatchesOpening viewAvailable categoryState locatorState focusInNotebook visibleFocusInNotebook memoryInNotebook focusMatchesMemory visibleFocusMatchesMemory categoryMatchesFocus categoryMatchesVisible categoryMatchesMemory loopGeneration tickCount heartbeatAgeMs'.split(' ');
  const session = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  let entries = [], sizes = [], bytes = 0, loaded = false, dirty = false, timer = null, sequence = 0;
  let storageWarning = '', readBlocked = false;

  function member(object, key) {
    try {
      let value = object && object[key];
      if (typeof value === 'undefined' && object && typeof object.objectForKey === 'function') value = object.objectForKey(key);
      return typeof value === 'function' ? value.call(object) : value;
    } catch (_) { return undefined; }
  }
  function normalizeError(error, stage) {
    const info = member(error, 'userInfo');
    const message = member(info, 'WKJavaScriptExceptionMessage') || member(error, 'message') || member(error, 'localizedDescription')
      || (typeof error === 'string' ? error : '未知错误');
    const result = new Error(clean(message));
    result.stage = clean(stage || member(error, 'stage'), 120);
    const name = member(error, 'name');
    if (typeof name === 'string' && /^[A-Za-z][A-Za-z0-9_.]{0,79}$/.test(name)) result.name = name;
    const stack = member(error, 'stack');
    if (typeof stack === 'string') result.stack = stack;
    const source = member(error, 'script') || member(info, 'WKJavaScriptExceptionSourceURL') || '';
    const file = String(source).match(/(?:^|[\\/])((?:Daguanyuan|Web)[A-Za-z0-9_-]*\.js|main\.js)(?:[?#].*)?$/);
    if (file) result.script = file[1];
    ['line', 'column'].forEach(function (key) {
      const value = Number(member(error, key) || member(info, key === 'line' ? 'WKJavaScriptExceptionLineNumber' : 'WKJavaScriptExceptionColumnNumber'));
      if (Number.isSafeInteger(value) && value > 0) result[key] = value;
    });
    const code = Number(member(error, 'nativeCode') || member(error, 'code'));
    if (Number.isSafeInteger(code)) result.nativeCode = code;
    return result;
  }
  function clean(value, limit) {
    if (typeof value !== 'string' && typeof value !== 'number') return '';
    return String(value).slice(0, 12000)
      .replace(/\{[\s\S]*|\[(?!(?:结构化内容已隐藏|网页内容已隐藏|图片数据|已隐藏|网址已隐藏|路径已隐藏|邮箱已隐藏|用户内容已隐藏|长数据已隐藏)\])[\s\S]*/g, '[结构化内容已隐藏]')
      .replace(/<[^>]+>[\s\S]*/g, '[网页内容已隐藏]')
      .replace(/data:[^\s]+/gi, '[图片数据]')
      .replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [已隐藏]')
      .replace(/((?:authorization|cookie|token|password|secret|api[_-]?key|access[_-]?token|密码|密钥)\s*["']?\s*[:=]\s*)[^\r\n,;]+/gi, '$1[已隐藏]')
      .replace(/https?:\/\/[^\s<>"')]+/gi, '[网址已隐藏]')
      .replace(/(?:file:\/\/[^\r\n"'<>]+|[a-z]:[\\/][^\r\n"'<>]+|\/(?:Users|home|private|var|Volumes|storage|data)\/[^\r\n"'<>]+)/gi, '[路径已隐藏]')
      .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[邮箱已隐藏]')
      .replace(/(?:题干|题目正文|笔记内容|卡片标题|评论内容)\s*[:：=][^\r\n]*/g, '[用户内容已隐藏]')
      .replace(/[A-Za-z0-9_+\/=.-]{64,}/g, '[长数据已隐藏]').slice(0, limit || 600);
  }
  function detailsFor(input) {
    const output = {};
    KEYS.forEach(function (key) {
      const value = member(input, key);
      if (typeof value === 'number' && Number.isFinite(value)) output[key] = value;
      else if (typeof value === 'string') {
        if (key === 'taskId' && !/^[a-z0-9-]{1,100}$/i.test(value)) return;
        if (key !== 'stage' && key !== 'taskId' && !/^[a-zA-Z0-9_. -]{1,80}$/.test(value)) return;
        output[key] = clean(value, key === 'stage' ? 120 : 100);
      }
    });
    return output;
  }
  function errorFor(error) {
    const originalError = error;
    error = normalizeError(error);
    const raw = typeof error === 'string' ? error : member(error, 'message') || member(error, 'localizedDescription') || '未知错误';
    const stack = String(member(error, 'stack') || '').split('\n').slice(1).map(function (line) {
      const match = line.match(/((?:Daguanyuan|Web)[A-Za-z0-9_-]*\.js|main\.js):\d+(?::\d+)?/);
      return match ? match[0] : '';
    }).filter(Boolean).slice(0, 20).join('\n');
    const output = { message: clean(raw), stage: clean(member(error, 'stage'), 120), stack };
    ['name', 'script', 'line', 'column', 'nativeCode'].forEach(function (key) { if (typeof error[key] !== 'undefined') output[key] = error[key]; });
    const diagnostics = member(originalError, 'diagnostics'), image = {};
    'imageCount base64Chars width height nestedImages foreignObjects remainingImages mediaChanged processorAvailable'.split(' ').forEach(function (key) {
      const value = member(diagnostics, key);
      if (typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) image[key] = value;
    });
    if (Object.keys(image).length) output.image = image;
    return output;
  }
  function byteLength(text) {
    let size = 0;
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      if (code < 128) size += 1;
      else if (code < 2048) size += 2;
      else if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length && text.charCodeAt(index + 1) >= 0xdc00 && text.charCodeAt(index + 1) <= 0xdfff) { size += 4; index += 1; }
      else size += 3;
    }
    return size;
  }
  function append(entry) {
    const size = byteLength(JSON.stringify(entry)) + 1;
    entries.push(entry); sizes.push(size); bytes += size;
    while (entries.length > MAX_ENTRIES || bytes > MAX_BYTES - 1024) { entries.shift(); bytes -= sizes.shift(); }
  }
  function app() { return Application.sharedInstance(); }
  function filePath(temporary) {
    const root = member(app(), temporary ? 'tempPath' : 'documentPath');
    if (!root) throw new Error('日志目录不可用');
    return String(root).replace(/\/$/, '') + '/' + DIRECTORY_NAME + (temporary ? '/diagnostic-export' : '/logs');
  }
  function directory(path) {
    const manager = NSFileManager.defaultManager();
    if (!manager.fileExistsAtPath(path) && !manager.createDirectoryAtPathWithIntermediateDirectoriesAttributes(path, true, null)) throw new Error('无法创建日志目录');
  }
  function environment() {
    const nativeApp = typeof Application === 'undefined' ? null : app();
    const info = typeof __DAGUANYUAN_PLUGIN_INFO__ === 'undefined' ? {} : __DAGUANYUAN_PLUGIN_INFO__;
    return detailsFor({ pluginVersion: info.version || 'unknown', mnVersion: member(nativeApp, 'appVersion'), mnBuild: member(nativeApp, 'build'), osType: member(nativeApp, 'osType') });
  }
  function readEntries(path) {
    const data = NSData.dataWithContentsOfFile(path);
    if (!data || Number(member(data, 'length')) > MAX_BYTES) throw new Error('已有日志无法读取或超出大小限制');
    const saved = NSJSONSerialization.JSONObjectWithDataOptions(data, 0);
    if (!saved || saved.schemaVersion !== 1 || !Array.isArray(saved.entries)) throw new Error('已有日志格式无效');
    const rows = saved.entries.slice(-MAX_ENTRIES).map(function (entry) {
      if (!entry || !/^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(entry.time) || !/^[a-z][a-z0-9_.-]{0,79}$/i.test(entry.event)) return null;
      const row = { time: entry.time, session: /^[a-z0-9-]{1,100}$/i.test(entry.session) ? entry.session : '', level: ['info', 'warn', 'error'].indexOf(entry.level) >= 0 ? entry.level : 'info', event: entry.event, details: detailsFor(entry.details) };
      if (entry.error) row.error = errorFor({ message: member(entry.error, 'message'), stage: member(entry.error, 'stage'), stack: '\n' + String(member(entry.error, 'stack') || ''), diagnostics: member(entry.error, 'image'), name: member(entry.error, 'name'), script: member(entry.error, 'script'), line: member(entry.error, 'line'), column: member(entry.error, 'column'), nativeCode: member(entry.error, 'nativeCode') });
      return row;
    }).filter(Boolean);
    return rows;
  }
  function load() {
    if (loaded) return;
    loaded = true;
    try {
      const path = filePath(false) + '/diagnostics.json';
      if (NSFileManager.defaultManager().fileExistsAtPath(path)) readEntries(path).forEach(append);
    } catch (_) { storageWarning = '已有日志读取失败，本次日志暂存于内存；可导出或清空后重试。'; readBlocked = true; }
    append({ time: new Date().toISOString(), session, level: 'info', event: 'session.start', details: environment() });
    dirty = true;
  }
  function flush() {
    try {
      load();
      if (timer) { timer.invalidate(); timer = null; }
      if (readBlocked) return false;
      if (!dirty) return true;
      const path = filePath(false); directory(path);
      let data;
      // 以原生序列化后的实际大小再次校验，避免不同转义方式突破上限。
      while (true) {
        data = NSJSONSerialization.dataWithJSONObjectOptions({ schemaVersion: 1, entries }, 0);
        if (!data) throw new Error('日志序列化失败');
        const length = Number(member(data, 'length'));
        if (!Number.isFinite(length) || length < 1) throw new Error('日志数据长度不可用');
        if (length <= MAX_BYTES) break;
        if (!entries.length) throw new Error('日志容量计算失败');
        entries.shift(); bytes -= sizes.shift();
      }
      if (!data.writeToFileAtomically(path + '/diagnostics.json', true)) throw new Error('日志写入失败');
      dirty = false; storageWarning = ''; return true;
    } catch (_) { storageWarning = '日志保存失败，本次日志暂存于内存，请及时导出。'; return false; }
  }
  function record(level, event, details, error, deferFlush) {
    try {
      load();
      if (typeof event !== 'string' || !/^[a-z][a-z0-9_.-]{0,79}$/i.test(event)) return;
      const row = { time: new Date().toISOString(), session, level, event, details: detailsFor(details) };
      if (error) row.error = errorFor(error);
      append(row); dirty = true;
      if (level === 'error' && !deferFlush) flush();
      else if (!timer && typeof NSTimer !== 'undefined') timer = NSTimer.scheduledTimerWithTimeInterval(1, false, function () { timer = null; flush(); });
    } catch (_) { /* 日志异常不能影响插件操作。 */ }
  }
  function info(event, details) { record('info', event, details); }
  function warn(event, details) { record('warn', event, details); }
  function error(event, failure, details) { record('error', event, details, failure); }
  function begin(event, details) {
    const taskId = session + '-' + (++sequence).toString(36);
    info(event + '.start', Object.assign({}, details, { taskId })); return taskId;
  }
  function result(event, taskId, value, details) {
    try {
      value = value || {};
      const failures = Array.isArray(value.failed) ? value.failed : [];
      const context = Object.assign({}, details, { taskId, total: value.total, createdCount: value.createdCount, answerAddedCount: value.answerAddedCount, skippedCount: value.skippedCount, failedCount: failures.length, status: value.cancelled ? 'cancelled' : value.interrupted ? 'interrupted' : failures.length ? 'partial' : 'complete' });
      if (value.interrupted) record('error', event + '.result', context, value.interrupted, true);
      else record(failures.length ? 'warn' : 'info', event + '.result', context);
      failures.slice(0, 20).forEach(function (item) { record('error', event + '.item', Object.assign({}, details, { taskId, questionId: item.questionId, stage: item.stage }), { message: item.reason || '导入失败', stage: item.stage, diagnostics: item.diagnostics }, true); });
      if (value.interrupted || failures.length) flush();
    } catch (_) { /* 导入回执中的异常不影响结果展示。 */ }
  }
  function text() {
    load(); flush();
    return 'Daguanyuan Bridge 诊断日志\n仅保存在本机；最多保留最近 2000 条、约 1 MB。\n'
      + JSON.stringify({ exportedAt: new Date().toISOString(), environment: environment(), storageWarning, entries }, null, 2);
  }
  function copy() { UIPasteboard.generalPasteboard().string = text(); }
  function exportFile() {
    if (typeof app().saveFileWithUti !== 'function') throw new Error('当前版本不支持导出，请使用复制日志');
    const content = text(), path = filePath(true); directory(path);
    const destination = path + '/Daguanyuan-Bridge-Diagnostics.txt';
    const data = NSData.dataWithStringEncoding(content, 4);
    if (!data || !data.writeToFileAtomically(destination, true)) throw new Error('日志导出文件写入失败，请使用复制日志');
    app().saveFileWithUti(destination, 'public.plain-text');
  }
  function clear() {
    try {
      load();
      if (timer) { timer.invalidate(); timer = null; }
      entries = []; sizes = []; bytes = 0; dirty = true; readBlocked = false;
      const saved = flush();
      const temporary = filePath(true) + '/Daguanyuan-Bridge-Diagnostics.txt';
      if (NSFileManager.defaultManager().fileExistsAtPath(temporary)) {
        const empty = NSData.dataWithStringEncoding('', 4);
        if (!empty || !empty.writeToFileAtomically(temporary, true)) return false;
      }
      return saved;
    } catch (_) { return false; }
  }
  return { info, warn, error, begin, result, flush, text, copy, exportFile, clear, normalizeError };
})();
