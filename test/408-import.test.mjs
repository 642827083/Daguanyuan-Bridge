import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const mathSource = readFileSync(new URL("../src/DaguanyuanCardComments.js", import.meta.url), "utf8") + "\n" + readFileSync(new URL("../src/DaguanyuanMathImport.js", import.meta.url), "utf8");
const locatorSource = readFileSync(new URL("../src/DaguanyuanCardLocator.js", import.meta.url), "utf8");
const source = readFileSync(new URL("../src/Daguanyuan408Import.js", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../src/Daguanyuan408Page.js", import.meta.url), "utf8");
const addonSource = readFileSync(new URL("../src/WebAddon.js", import.meta.url), "utf8");
const category = { title: "浮点数的表示与运算", path: ["计算机组成原理", "数据的机器表示", "浮点数的表示与运算"], url: "https://www.408os.cn/exercise?knowledgeId=52&knowledgeName=浮点数" };

function runtime(questions, options = {}) {
  const notebook = { topicId: "topic-1", notes: [] };
  const notes = new Map();
  const deleted = [];
  const scripts = [];
  let serial = 0;
  let payload = "";
  let current = -1;
  let pageError = "";
  let cancelled = false;
  let nativeResource = false;
  let receivedBase64 = "";
  const lateCallbacks = [];
  const context = {
    console,
    MNUtil: { getNoteById(id) { return notes.get(id); } },
    NSNull: class {},
    MNNote: { new(id) { return notes.get(id); } },
    __DAGUANYUAN_MATH_API_GLOBAL__: { positiveInteger(value) {
      if (!Number.isSafeInteger(Number(value)) || Number(value) < 1) throw new Error("题目 ID 无效");
      return Number(value);
    } },
    Application: { sharedInstance() { return {
      studyController() { return { notebookController: { notebookId: "notebook-1" }, readerController: options.noDocument ? null : { currentDocumentController: { document: {} } } }; },
      refreshAfterDBChanged() {},
    }; } },
    Database: { sharedInstance() { return {
      getNotebookById() { return notebook; },
      getNoteById(id) { return notes.get(id); },
      createNoteWithTitleTopicid(title, topic) { assert.equal(topic, 'topic-1'); return context.Note.createWithTitleNotebookDocument(title); },
      allNotebooks() { return [notebook]; },
      deleteBookNoteTree(id) {
        const note = notes.get(id);
        if (note.parentNote) note.parentNote.childNotes = note.parentNote.childNotes.filter((item) => item !== note);
        notebook.notes = notebook.notes.filter((item) => item !== note);
        deleted.push(id);
        notes.delete(id);
      },
    }; } },
    Note: { createWithTitleNotebookDocument(title) {
      const note = {
        noteId: `note-${++serial}`, noteTitle: title, comments: [], childNotes: [], parentNote: null,
        appendMarkdownComment(text) { this.comments.push({ text }); },
      removeCommentByIndex(index) { this.comments.splice(index, 1); },
      sortCommentsByNewIndices(indices) { const before = this.comments.slice(); indices.forEach((position, old) => { this.comments[position] = before[old]; }); },
        addChild(child) {
          notebook.notes = notebook.notes.filter((item) => item !== child);
          child.parentNote = this;
          this.childNotes.push(child);
        },
        processMarkdownBase64Images() {
          if (options.failImage) return false;
          if (options.partialImage) return true;
          this.comments.forEach((comment) => { comment.text = comment.text.replace(/data:image\/[^)\s]+/g, "marginnote-media://saved-image.png"); });
          this.mediaList = "saved-image.png";
          return true;
        },
      };
      if (options.noImageProcessor) delete note.processMarkdownBase64Images;
      notebook.notes.push(note);
      notes.set(note.noteId, note);
      return note;
    } },
    UndoManager: { sharedInstance() { return { undoGrouping(label, topic, action) { action(); } }; } },
    NSTimer: { scheduledTimerWithTimeInterval(delay, repeat, callback) {
      let active = true;
      const timer = { invalidate() { active = false; } };
      const fire = () => { if (active) callback(timer); };
      if (delay < 1) queueMicrotask(fire);
      else if (options.fireWatchdogs) setImmediate(fire);
      return timer;
    } },
    NSURL: { URLWithString(url) { return url; } },
    NSMutableURLRequest: { requestWithURL(url) { return { url, setHTTPMethod() {}, setTimeoutInterval() {} }; } },
    NSOperationQueue: { mainQueue() { return {}; } },
    NSURLConnection: { sendAsynchronousRequestQueueCompletionHandler(request, queue, completion) {
      assert.equal(request.url, "https://oss.408os.cn/diagram.png");
      if (options.imageNoCallback) return;
      completion({ statusCode: options.imageStatus || 200, allHeaderFields: { "Content-Type": "image/png" } },
        { length: 12, base64Encoding() { return "iVBORw0KGgo="; } }, null);
    } },
  };
  vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../src/DaguanyuanSourceLink.js', import.meta.url), 'utf8'), context);
  vm.runInContext(mathSource, context);
  vm.runInContext(locatorSource, context);
  vm.runInContext(pageSource, context);
  vm.runInContext(source, context);
  const page = {
    read() {
      if (options.switched && current === 1) return JSON.stringify({ error: "当前 408 分类已切换，导入停止" });
      return JSON.stringify({ error: pageError, ready: !nativeResource, length: payload.length,
        resource: nativeResource ? "https://oss.408os.cn/diagram.png" : "" });
    },
    chunk(key, offset) { return payload.slice(offset, offset + 65536); },
    prepare(key, index) {
      current = index;
      pageError = options.badQuestion === index ? "图片读取失败" : "";
      payload = JSON.stringify({ question: questions[index] });
      nativeResource = Boolean(options.crossOrigin);
      return true;
    },
    resourceStart(key, type) { assert.equal(type, "image/png"); return true; },
    resourceAppend(key, chunk) { receivedBase64 += chunk; return true; },
    resourceFinish(key, error) { nativeResource = false; pageError = error || ""; return true; },
    cancel() { cancelled = true; return true; },
  };
  context.window = { __DAGUANYUAN_408_IMPORT_PAGE__: page };
  const controller = { addon: { window: {} }, webView: { evaluateJavaScript(script, callback) {
    scripts.push(script);
    const stall = options.stall === "start" && script.includes("String((function pageReceiver")
      || options.stall === "read" && script.includes(".read(")
      || options.stall === "chunk" && script.includes(".chunk(")
      || options.stall === "cancel" && script.includes(".cancel(");
    if (stall) { lateCallbacks.push(() => callback("true")); return; }
    if (script.includes("String((function pageReceiver")) {
      payload = JSON.stringify({ category, ids: questions.map((question) => question.id) });
      callback(options.foreignPage ? "false" : "true", options.nullError ? new context.NSNull() : null);
    } else {
      try { callback(vm.runInContext(script, context), options.nullError ? new context.NSNull() : null); } catch (error) { callback(null, error); }
    }
  } } };
  return { context, controller, notes, notebook, deleted, scripts, page, options, lateCallbacks,
    get cancelled() { return cancelled; }, get receivedBase64() { return receivedBase64; },
    importer: context.__DAGUANYUAN_408_IMPORT_GLOBAL__, writer: context.__DAGUANYUAN_MATH_IMPORT_GLOBAL__ };
}

test('408 独立导入页保留列表连接，只转换指定成员，关闭后清理连接', async () => {
  const run = runtime([{ id: 81, stem: '第一题' }, { id: 82, stem: '第二题' }]);
  const prepared = await run.importer.prepareWorkspace(run.controller);
  assert.deepEqual(Array.from(prepared.listing.ids), [81, 82]);
  assert.equal(run.scripts.some(s => s.includes('.prepare(')), false);
  assert.throws(() => prepared.readQuestion(999, 'question'), /不在原分类/);
  assert.equal((await prepared.readQuestion(82, 'question')).id, 82);
  assert.deepEqual(run.scripts.filter(s => s.includes('.prepare(')).map(s => Number(s.match(/,(\d+),/)[1])), [1]);
  await prepared.close(); assert.equal(run.cancelled, true);
});

test('408 网页回调的原生空错误值不阻断独立读取，未登录时提示入口', async () => {
  const run = runtime([{ id: 81, stem: '题干' }], { nullError: true });
  const prepared = await run.importer.prepareWorkspace(run.controller);
  assert.equal((await prepared.readQuestion(81, 'question')).id, 81); await prepared.close();
  const blocked = runtime([{ id: 81, stem: '题干' }], { foreignPage: true });
  await assert.rejects(blocked.importer.prepareWorkspace(blocked.controller), /导航栏的 408 页登录/);
});

test('408 分类确认准确数量后才转换题图；取消清理网页传输且不写卡', async () => {
  const run = runtime([{ id: 81, source: '2026年 第1题', stem: '题干' }, { id: 82, stem: '题干2' }]);
  let confirm;
  const operation = run.importer.importCategory(run.controller, null, null, plan => {
    assert.equal(plan.questions.length, 2);
    assert.match(plan.source, /浮点数/);
    assert.equal(plan.target, '当前学习集');
    return new Promise(resolve => { confirm = resolve; });
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(run.notes.size, 0);
  assert.equal(run.scripts.some(script => script.includes('.prepare(')), false);
  confirm(false);
  assert.equal((await operation).cancelled, true);
  assert.equal(run.notes.size, 0);
  assert.equal(run.cancelled, true);
});

test('408 选题只转换和写入所选题，保留原卷索引并按原顺序导入', async () => {
  const run = runtime([81, 82, 83].map(id => ({ id, source: '来源' + id, stem: '题干' + id })));
  const result = await run.importer.importCategory(run.controller, null, null, () => [83, 81]);
  assert.equal(result.total, 2); assert.equal(result.createdCount, 2);
  const prepared = run.scripts.filter(s => s.includes('.prepare(')).map(s => Number(s.match(/,(\d+),/)[1]));
  assert.deepEqual(prepared, [0, 2]);
  const cards = [...run.notes.values()].map(n => run.writer.linkedQuestion(n)?.id).filter(Boolean);
  assert.deepEqual(cards, [81, 83]);
});

test('408 选题内容传给网页转换器与写入器，旧整类导入仍只写题目', async () => {
  for (const content of ['question', 'questionAnswer']) {
    const run = runtime([{ id: 81, stem: '题干', answer: 'C', explanation: '解析' }]);
    const confirm = () => [81]; confirm.content = content;
    const result = await run.importer.importCategory(run.controller, null, null, confirm);
    assert.equal(result.createdCount, 1);
    assert.ok(run.scripts.some(script => script.includes('.prepare(') && script.includes(JSON.stringify(content))));
    const card = [...run.notes.values()].find(n => run.writer.linkedQuestion(n)?.id === 81);
    if (content === 'questionAnswer') {
      assert.equal(card.childNotes[0].noteTitle, '答案与解析');
      assert.equal(card.childNotes[0].comments.length, 2);
      assert.match(card.childNotes[0].comments[0].text, /^### 答案\n\nC\n\n<!-- DAGUANYUAN_408_ANSWER_ID:81 -->$/);
      assert.equal(card.childNotes[0].comments[1].text, '### 解析\n\n解析');
      assert.doesNotMatch(card.comments[0].text, /### 答案|### 解析/);
    }
    else assert.doesNotMatch(card.comments[0].text, /### 答案|### 解析/);
  }
});

test('408 运行中停止不处理剩余题，已写入计数保留在中断报告', async () => {
  const run = runtime([81, 82, 83].map(id => ({ id, stem: '题干' + id })));
  let stopped = false;
  const confirm = () => [81, 83];
  confirm.check = () => { if (stopped) { const error = Error('已停止'); error.stopImport = true; throw error; } };
  await assert.rejects(run.importer.importCategory(run.controller, () => { stopped = true; }, null, confirm), error => {
    assert.equal(error.importResult.createdCount, 1); assert.equal(error.importResult.total, 2); return true;
  });
  assert.equal(run.scripts.filter(s => s.includes('.prepare(')).length, 1);
});

test("408 导入整类所有题目，来源与数学 ID 独立，重复导入跳过", async () => {
  const questions = Array.from({ length: 48 }, (_, i) => ({ id: i + 1, source: `2009年 第${i + 1}题`, stem: `题干 ${i + 1}`, options: ["选项甲", "选项乙"] }));
  const run = runtime(questions, { noDocument: true });
  const mathNote = run.context.Note.createWithTitleNotebookDocument("数学题");
  mathNote.appendMarkdownComment("<!-- DAGUANYUAN_QUESTION_ID:1 -->");
  const result = await run.importer.importCategory(run.controller);
  assert.equal(result.total, 48);
  assert.equal(result.createdCount, 48);
  assert.equal(result.failed.length, 0);
  const topic = [...run.notes.values()].find((note) => note.noteTitle === category.title);
  assert.equal(topic.childNotes.length, 48);
  assert.equal(topic.parentNote.noteTitle, "数据的机器表示");
  assert.equal(topic.parentNote.parentNote.noteTitle, "计算机组成原理");
  assert.equal(topic.parentNote.parentNote.parentNote.noteTitle, "408");
  const text = topic.childNotes[0].comments[0].text;
  assert.match(text, /A\. 选项甲\n\nB\. 选项乙/);
  assert.doesNotMatch(text, /DAGUANYUAN_/);
  assert.match(topic.childNotes[0].comments[1].text, /DAGUANYUAN_408_QUESTION_ID:1/);
  const link = run.writer.linkedQuestion(topic.childNotes[0]);
  assert.equal(link.provider, "408");
  assert.equal(link.year, 2009);
  assert.match(link.url, /knowledgeId=52.*questionId=1/);
  assert.deepEqual(Array.from(run.writer.importedQuestionIds(run.controller.addon)), [1]);
  const again = await run.importer.importCategory(run.controller);
  assert.equal(again.createdCount, 0);
  assert.equal(again.skippedCount, 48);
  assert.equal(run.cancelled, true);
});

test('408 知识点目录不完整时不创建任何题卡，年份分类兼容既有导入', () => {
  const run = runtime([]);
  const session = run.writer.prepared408Session(run.controller.addon);
  const question = { id: 801, source: '2026年 第1题', stem: '题干', options: [] };
  for (const path of [undefined, [], ['计算机组成原理', ''], ['另一分类']]) {
    assert.throws(() => session.write(question, { ...category, path }), /目录不完整/);
    assert.equal(run.notes.size, 0);
  }
  assert.equal(session.write(question, { title: '2026年真题', url: 'https://www.408os.cn/exercise?year=2026' }), true);
  const note = [...run.notes.values()].find(item => item.noteTitle === question.source);
  assert.equal(note.parentNote.noteTitle, '2026年真题');
  assert.equal(note.parentNote.parentNote.noteTitle, '408');
});

test('408 整类导入只对目标分类查重，单题、其他分类和删除后的旧对象不阻止导入', async () => {
  const question = { id: 801, source: '2026年 第1题', stem: '题干', options: [] };
  const run = runtime([question]);
  const single = run.context.Note.createWithTitleNotebookDocument('其他位置的单题');
  single.appendMarkdownComment('<!-- DAGUANYUAN_408_QUESTION_ID:801 -->\n<!-- DAGUANYUAN_SINGLE_IMPORT:1 -->');
  const first = await run.importer.importCategory(run.controller);
  assert.equal(first.createdCount, 1);
  assert.equal(first.skippedCount, 0);
  const target = [...run.notes.values()].find(note => note.noteTitle === category.title);
  const prepareCount = run.scripts.filter(script => script.includes('.prepare(')).length;
  const again = await run.importer.importCategory(run.controller);
  assert.equal(again.skippedCount, 1);
  assert.equal(run.scripts.filter(script => script.includes('.prepare(')).length, prepareCount);
  const deletedNote = target.childNotes[0];
  run.notes.delete(deletedNote.noteId);
  const retry = await run.importer.importCategory(run.controller);
  assert.equal(retry.createdCount, 1, '数据库已删除，即使旧子节点列表保留对象也不能跳过');
  const otherCategory = { title: '另一个知识点', path: ['数据结构', '另一个知识点'], url: 'https://www.408os.cn/exercise?knowledgeId=999' };
  const session = run.writer.prepared408Session(run.controller.addon);
  assert.equal(session.hasQuestion(801, otherCategory), false);
  assert.equal(session.write(question, otherCategory), true);
  assert.equal(session.hasQuestion(801, otherCategory), true);
  assert.equal(single.parentNote, null, '不移动已有的单题卡片');
});

test('408 分类查重缺少 MN Utils 查询接口时给出明确提示', async () => {
  const run = runtime([{ id: 801, source: '2026年 第1题', stem: '题干', options: [] }]);
  delete run.context.MNUtil;
  const result = await run.importer.importCategory(run.controller);
  assert.match(result.failed[0].reason, /安装并启用 MN Utils/);
  assert.equal(run.notes.size, 0);
});

test('408 工具只查询当前题 ID，不转换图片、不创建题卡，并清理查询状态', async () => {
  const run = runtime([{ id: 843, stem: '带图题' }]);
  const target = { provider: '408', year: 2026, number: 44, url: 'https://www.408os.cn/exercise?year=2026' };
  const question = await run.importer.resolveQuestion(run.controller, target);
  assert.equal(question.id, 843); assert.equal(question.year, 2026); assert.equal(question.number, 44);
  assert.equal(question.provider, '408'); assert.equal(question.url, target.url);
  assert.equal(run.notes.size, 0);
  assert.equal(run.scripts.some(script => script.includes('.prepare(')), false);
  assert.equal(run.cancelled, true);
  for (const questions of [[], [{ id: 843 }, { id: 844 }]]) {
    const ambiguous = runtime(questions);
    await assert.rejects(ambiguous.importer.resolveQuestion(ambiguous.controller, target), /无法唯一确定/);
    assert.equal(ambiguous.cancelled, true); assert.equal(ambiguous.notes.size, 0);
  }
});

test('408 定位在当前学习集中按来源寻找卡片，与同 ID 数学题互不混淆', async () => {
  const run = runtime([]);
  const math = { noteId: 'math-card', comments: [{ text: '<!-- DAGUANYUAN_QUESTION_ID:843 -->' }], childNotes: [] };
  const os408 = { noteId: '408-card', comments: [{ text: '<!-- DAGUANYUAN_408_QUESTION_ID:843 -->' }], childNotes: [] };
  run.notebook.notes.push(math, os408);
  run.notes.set(math.noteId, math); run.notes.set(os408.noteId, os408);
  let focused;
  run.context.Application.sharedInstance = () => ({ studyController() { return { notebookController: { notebookId: 'topic-1', changeFocusToNote(note) { focused = note; } }, focusNoteInMindMapById() {} }; } });
  assert.equal((await run.writer.focusQuestion(run.controller.addon, 843, '408')).noteId, '408-card');
  assert.equal(focused === os408, true);
  assert.equal((await run.writer.focusQuestion(run.controller.addon, 843)).noteId, 'math-card');
  assert.equal(focused === math, true);
  run.notebook.notes.pop();
  await assert.rejects(run.writer.focusQuestion(run.controller.addon, 843, '408'), /没有这道题/);
});

test("带大图片的 408 题目分块读取并保存为卡片媒体", async () => {
  const run = runtime([{ id: 13, stem: `题干 ![图](data:image/png;base64,${"A".repeat(180000)})`, options: ["甲"], hasBase64Image: true }]);
  const result = await run.importer.importCategory(run.controller);
  assert.equal(result.createdCount, 1);
  const note = [...run.notes.values()].find((note) => /DAGUANYUAN_408_QUESTION_ID/.test(note.comments[1]?.text));
  assert.match(note.comments[0].text, /marginnote-media:\/\/saved-image/);
  assert.doesNotMatch(note.comments[0].text, /data:image/);
  assert.ok(run.scripts.filter((script) => script.includes(".chunk(")).length >= 4);
});

test("图片未保存或只保存部分时清理题卡，重试后能正常导入", async () => {
  for (const setting of ["failImage", "partialImage"]) {
    const run = runtime([{ id: 13, stem: "![图](data:image/png;base64,AQID)", options: [], hasBase64Image: true }], { [setting]: true });
    const result = await run.importer.importCategory(run.controller);
    assert.equal(result.createdCount, 0);
    assert.equal(result.failed.length, 1);
    assert.match(result.failed[0].reason, /完整保存题目图片/);
    assert.equal(result.failed[0].stage, "MarginNote 保存图片");
    assert.equal(result.failed[0].diagnostics.imageCount, 1);
    assert.equal(result.failed[0].diagnostics.remainingImages, 1);
    assert.equal(run.deleted.length, 1);
    run.options[setting] = false;
    assert.equal((await run.importer.importCategory(run.controller)).createdCount, 1);
  }
});

test("宿主未提供图片保存接口时保留题号和诊断信息，不暴露图片数据", async () => {
  const run = runtime([{ id: 44, source: "2026年 第44题", stem: "![图](data:image/png;base64,AQID)", options: [], hasBase64Image: true }], { noImageProcessor: true });
  const result = await run.importer.importCategory(run.controller);
  assert.equal(result.failed[0].source, "2026年 第44题");
  assert.equal(result.failed[0].stage, "MarginNote 保存图片");
  assert.equal(result.failed[0].diagnostics.processorAvailable, false);
  assert.doesNotMatch(JSON.stringify(result.failed), /AQID|data:image/);
  assert.equal(run.deleted.length, 1);
});

test("一题图片读取失败不影响整类后续题目，失败项可再次导入", async () => {
  const run = runtime([{ id: 13, stem: "题干一" }, { id: 14, stem: "题干二" }], { badQuestion: 0 });
  const progress = [];
  const result = await run.importer.importCategory(run.controller, (value) => progress.push(value));
  assert.equal(result.createdCount, 1);
  assert.equal(result.failed[0].questionId, 13);
  assert.equal(progress.at(-1).processed, 2);
  run.options.badQuestion = -1;
  const retried = await run.importer.importCategory(run.controller);
  assert.equal(retried.createdCount, 1);
  assert.equal(retried.skippedCount, 1);
});

test("跨域图片由原生系统网络下载，失败会计入题目错误", async () => {
  const run = runtime([{ id: 13, stem: "题图", options: [] }], { crossOrigin: true });
  assert.equal((await run.importer.importCategory(run.controller)).createdCount, 1);
  assert.equal(run.receivedBase64, "iVBORw0KGgo=");
  const failed = runtime([{ id: 13, stem: "题图" }], { crossOrigin: true, imageStatus: 404 });
  const result = await failed.importer.importCategory(failed.controller);
  assert.equal(result.createdCount, 0);
  assert.match(result.failed[0].reason, /跨域题图下载失败：404/);
});

test("切换分类或不是 408 分类时停止，清理网页传输状态", async () => {
  const foreign = runtime([{ id: 13, stem: "题干" }], { foreignPage: true });
  await assert.rejects(foreign.importer.importCategory(foreign.controller), /请先进入 408/);
  assert.equal(foreign.cancelled, true);
  const switched = runtime([{ id: 13, stem: "题干一" }, { id: 14, stem: "题干二" }], { switched: true });
  await assert.rejects(switched.importer.importCategory(switched.controller), /已新建 1 道.*分类已切换/);
  assert.equal(switched.cancelled, true);
});

test("网页启动、状态读取或分块回调缺失时限时中断，不继续创建题卡", async () => {
  for (const stall of ["start", "read", "chunk"]) {
    const run = runtime([{ id: 13, stem: "题干" }], { stall, fireWatchdogs: true });
    const outcome = run.importer.importCategory(run.controller);
    const completed = await Promise.race([outcome.then(() => "success", (error) => error), new Promise((resolve) => setTimeout(() => resolve("never-finished"), 100))]);
    assert.notEqual(completed, "never-finished", `${stall} 回调丢失时一直显示导入中`);
    assert.match(completed.message, /网页调用超时/);
    assert.equal(run.notes.size, 0);
    run.lateCallbacks.forEach((callback) => callback());
    assert.equal(run.notes.size, 0);
  }
});

test("跨域图片请求不回调时记录超时失败并结束，清理调用不回调也不会阻止返回", async () => {
  for (const stall of ["image", "cancel"]) {
    const run = runtime([{ id: 13, stem: "题图" }], { fireWatchdogs: true,
      crossOrigin: stall === "image", imageNoCallback: stall === "image", stall });
    const outcome = run.importer.importCategory(run.controller);
    const completed = await Promise.race([outcome, new Promise((resolve) => setTimeout(() => resolve("never-finished"), 100))]);
    assert.notEqual(completed, "never-finished", `${stall} 回调丢失时一直显示导入中`);
    if (stall === "image") assert.match(completed.failed[0].reason, /下载超时/);
    else assert.equal(completed.createdCount, 1);
  }
});

test("408 分类定位使用绑定分类与题目序号，防止进入数学定位流程", () => {
  let opened;
  const context = {
    JSB: { defineClass(name, methods) { return methods; } },
    __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__: { navigationNote() { return {}; }, currentQuestionContext() { return { source: {}, progress: { index: 3 } }; } },
    __DAGUANYUAN_CATEGORY_MAPPING_STORE_GLOBAL__: { binding408ForSource() { return { targetURL: category.url }; } },
    __DAGUANYUAN_WEB_PANEL_GLOBAL__: { open408Question(controller, url, index) { opened = { url, index }; } },
    console,
  };
  vm.createContext(context);
  vm.runInContext(addonSource, context);
  context.self = { panelController: {} };
  context.createDaguanyuanBridgeAddon().locateQuestion();
  assert.equal(opened.url, category.url);
  assert.equal(opened.index, 3);
});


test('408 当前页范围限制在网页题目内，按网页顺序写入并保持真实列表索引', async () => {
  const run = runtime([81, 82, 83, 84].map(id => ({ id, source: '来源' + id, stem: '题干' + id })));
  const page = { provider: '408', url: 'https://www.408os.cn/exercise?year=2010', questions: [{ id: 83, title: '网页第一题' }, { id: 81, title: '网页第二题' }] };
  let plan;
  const result = await run.importer.importCategory(run.controller, null, null, value => { plan = value; return [81, 83]; }, page);
  assert.deepEqual(Array.from(plan.questions, q => q.id), [83, 81]); assert.equal(result.total, 2);
  const prepared = run.scripts.filter(s => s.includes('.prepare(')).map(s => Number(s.match(/,(\d+),/)[1]));
  assert.deepEqual(prepared, [2, 0]);
  assert.deepEqual([...run.notes.values()].map(n => run.writer.linkedQuestion(n)?.id).filter(Boolean), [83, 81]);
});
test('408 网页题目不在真实列表中时停止，不静默扩大导入范围', async () => {
  const run = runtime([{ id: 81, stem: '题干' }]);
  await assert.rejects(run.importer.importCategory(run.controller, null, null, () => true,
    { provider: '408', url: 'https://www.408os.cn/exercise?year=2010', questions: [{ id: 999 }] }), /不一致/);
  assert.equal(run.notes.size, 0); assert.equal(run.scripts.some(s => s.includes('.prepare(')), false);
});
