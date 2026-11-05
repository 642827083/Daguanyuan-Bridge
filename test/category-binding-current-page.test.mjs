import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

const records = [[1, 0, '高等数学'], [2, 1, '一元微分'], [3, 2, '凹凸性'], [4, 3, '基本概念题'], [5, 2, '其他'], [6, 5, '基本概念题']];
const directory = { definition_revision: 7, roots: [{ category_id: 100, label: '高等数学', children: [
  { category_id: 200, label: '一元微分', children: [
    { category_id: 300, label: '凹凸性', children: [{ category_id: 400, label: '基本概念题', question_count: 6 }] },
    { category_id: 500, label: '其他', children: [{ category_id: 600, label: '基本概念题', question_count: 2 }] },
  ] },
] }] };

function runtime(options = {}) {
  const { window } = parseHTML(`<html><body>
    <div class="learning-shell__scope-toggle" aria-label="题单，当前真题"></div>
    <header data-learning-question-practice-toolbar><h1><button aria-label="选择题目分类" title="基本概念题">基本概念题<span>6 题</span></button></h1></header>
    <aside id="practice-chapter-directory"><button data-chapter-id="400" aria-current="page">基本概念题</button></aside>
  </body></html>`);
  window.location = new URL(options.url || 'https://cxyonly.fans/math/practice');
  window.localStorage = { getItem(key) { return key === 'daguan_user' ? '{"id":1,"math_exam_subject":"math_2"}' : null; } };
  const browser = vm.createContext({ window, document: window.document, URL, URLSearchParams, console });
  const messages = [], bindings = [], requests = [], writes = [], pages = [], reports = [];
  let methods, source = { notebookId: 'book', parentNoteId: 'parent', parentTitle: '基本概念题', sourcePath: ['凹凸性', '基本概念题'] };
  const controller = { addon: { window: {} }, currentContentPage: options.provider || 'math', webView: {
    evaluateJavaScript(script, callback) {
      try { callback(vm.runInContext(script, browser), null); } catch (error) { callback(null, error); }
    },
  } };
  const native = vm.createContext({ console, self: controller,
    JSB: { defineClass(name, value) { methods = value; return { new() { return {}; } }; } },
    Application: { sharedInstance() { return { showHUD(message) { messages.push(message); } }; } },
    NSUserDefaults: { standardUserDefaults() { return { objectForKey() { return true; } }; } },
    __DAGUANYUAN_IMPORT_SELECTION_GLOBAL__: { begin() { throw Error('直接导入不能打开勾选框'); }, evaluate() { return Promise.resolve(true); } },
    __DAGUANYUAN_IMPORT_REPORT_GLOBAL__: { textFor(result) { return result.interrupted || ''; }, show(owner, result) { reports.push(result); } },
    __DAGUANYUAN_RETEST_BRIDGE_GLOBAL__: { script() { return 'true'; } },
    __DAGUANYUAN_MATH_IMPORT_GLOBAL__: {
      selectQuestions(questions, accepted) { assert.equal(accepted, true); return questions; },
      importCategory() { throw Error('新版分类不能调用忽略题单的旧导入'); },
      preparedMathSession() { const book = source.notebookId; return { targetTitle: '学习集', check() {
        if (source.notebookId !== book) throw Error('目标学习集已切换');
      }, async importQuestions(ids) {
        writes.push(...ids); if (options.onWrite) options.onWrite(ids);
        return { createdCount: ids.length, failed: [] };
      } }; },
    },
    __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__: { currentCategorySource() { return source; } },
    __DAGUANYUAN_CATEGORY_MAPPING_STORE_GLOBAL__: {
      saveBinding(owner, id) { bindings.push({ owner, id }); },
      save408Binding(owner, url) { bindings.push({ owner, url }); return { targetURL: url }; },
    },
    __DAGUANYUAN_MATH_API_GLOBAL__: { questionScope(value) { return value; }, async categoryRecords() { return records; },
      async practiceQuestionPage(context, number) {
        pages.push({ context, number });
        if (options.readPage) return options.readPage(context, number);
        return { total: 66, pageSize: 20, questions: Array.from({ length: Math.min(20, 66 - (number - 1) * 20) }, (_, i) => ({ id: (number - 1) * 20 + i + 1 })) };
      }, questionListDirectory(selection, owner, check) {
      requests.push(selection); if (check) check();
      return options.readDirectory ? options.readDirectory() : Promise.resolve(directory);
    } },
  });
  for (const name of ['DaguanyuanCategoryRoutes', 'DaguanyuanWebsiteBridge', 'DaguanyuanMathNavigation', 'DaguanyuanMathSelection', 'WebBridgeCommands', 'WebPanelController']) {
    vm.runInContext(readFileSync(new URL(`../src/${name}.js`, import.meta.url), 'utf8'), native);
  }
  native.__DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.replaceCatalog({ records });
  controller.addon.panelController = controller;
  return { window, native, messages, bindings, requests, writes, pages, reports, controller, bind: () => methods.bindCurrentCategory(),
    async directImport() {
      const address = 'daguanyuanbridge://ui?payload=' + encodeURIComponent(JSON.stringify({ requestId: 'direct', command: 'importCurrentQuestions' }));
      methods.webViewShouldStartLoadWithRequestNavigationType(controller.webView, { URL: { absoluteString: address } });
      for (let n = 0; n < 40 && controller.categoryImportBusy; n++) await new Promise(resolve => setImmediate(resolve));
      assert.equal(controller.categoryImportBusy, false);
    },
    changeSource(value) { source = value; } };
}

test('统一练习网址从页面选中节点读取当前题单分类，映射到本地分类后绑定', async () => {
  const run = runtime();
  await run.bind();
  assert.equal(run.bindings.length, 1, run.messages.join('\n'));
  assert.equal(run.bindings[0].id, 4);
  assert.equal(run.requests[0].listId, 'exam-chapters-math-2');
  assert.match(run.messages.at(-1), /已绑定.*基本概念题/);
});

for (const [label, listId, scope] of [['完整', 'complete-math-2', 'complete'], ['严选', 'core-math-2', 'core']]) {
  test('直接导入保留侧栏的' + label + '范围和备考科目', async () => {
    const run = runtime();
    run.window.document.querySelector('.learning-shell__scope-toggle').setAttribute('aria-label', '题单，当前' + label);
    await run.directImport();
    assert.equal(run.writes.length, 66, run.controller.lastCategoryImportReportText);
    assert.equal(run.pages[0].context.listId, listId);
    assert.equal(run.pages[0].context.scope, scope);
  });
}

test('目录收起时直接导入使用明确的完整路径，不凭同名题型猜测', async () => {
  const run = runtime();
  run.window.document.querySelector('aside').remove();
  await run.directImport();
  assert.equal(run.writes.length, 0);
  assert.match(run.reports[0].interrupted, /唯一|目录/);
  run.window.document.querySelector('h1 button').setAttribute('title', '高等数学 / 一元微分 / 凹凸性 / 基本概念题');
  await run.directImport();
  assert.equal(run.writes.length, 66);
});

test('全部分类页仍明确提示进入具体分类，不误导入整个题库', async () => {
  const run = runtime();
  run.window.document.querySelector('aside').remove();
  run.window.document.querySelector('h1 button').setAttribute('title', '全部分类');
  await run.directImport();
  assert.equal(run.pages.length, 0);
  assert.equal(run.writes.length, 0);
  assert.match(run.reports[0].interrupted, /具体.*分类/);
});

test('直接导入读取目录期间分类切换，停止且不写题卡', async () => {
  const run = runtime({ readDirectory() {
    run.window.document.querySelector('[data-chapter-id]').setAttribute('data-chapter-id', '600');
    return Promise.resolve(directory);
  } });
  await run.directImport();
  assert.equal(run.pages.length, 0);
  assert.equal(run.writes.length, 0);
  assert.match(run.reports[0].interrupted, /分类已变化/);
});

test('分页读取期间分类切换，写入前再次核对并停止', async () => {
  const run = runtime({ readPage(context, number) {
    run.window.document.querySelector('[data-chapter-id]').setAttribute('data-chapter-id', '600');
    return { total: 1, pageSize: 20, questions: [{ id: 1 }] };
  } });
  await run.directImport();
  assert.equal(run.writes.length, 0);
  assert.match(run.reports[0].interrupted, /分类已变化/);
});

test('导入一批后分类切换，停止后续批次并保留已导入的数量', async () => {
  const run = runtime({ onWrite() { run.window.document.querySelector('[data-chapter-id]').setAttribute('data-chapter-id', '600'); } });
  await run.directImport();
  assert.equal(run.writes.length, 20);
  assert.equal(run.reports[0].createdCount, 20);
  assert.match(run.reports[0].interrupted, /分类已变化/);
});

test('分页期间切换目标学习集，不向新学习集继续写入', async () => {
  const run = runtime({ readPage() {
    run.changeSource({ notebookId: 'another-book' });
    return { total: 1, pageSize: 20, questions: [{ id: 1 }] };
  } });
  await run.directImport();
  assert.equal(run.writes.length, 0);
  assert.match(run.reports[0].interrupted, /学习集已切换/);
});

test('空分类直接结束，分页失败则保留真实原因并恢复导入入口', async () => {
  const empty = runtime({ readPage: () => ({ total: 0, pageSize: 20, questions: [] }) });
  await empty.directImport();
  assert.equal(empty.writes.length, 0);
  assert.equal(empty.reports.length, 0);
  assert.match(empty.messages.at(-1), /没有可导入/);
  const failed = runtime({ readPage() { throw Error('题目读取失败'); } });
  await failed.directImport();
  assert.equal(failed.writes.length, 0);
  assert.match(failed.reports[0].interrupted, /题目读取失败/);
});

test('新版题单版本已变化时不退回旧分类接口导入', async () => {
  const run = runtime({ url: 'https://cxyonly.fans/math/practice?listId=core-math-2&listRevision=6&categoryId=400&scope=core&examSubject=math_2' });
  await run.directImport();
  assert.equal(run.pages.length, 0);
  assert.equal(run.writes.length, 0);
  assert.match(run.reports[0].interrupted, /题单版本已变化/);
});

test('直接导入统一练习网址的当前分类：保留题单及版本，分页导入全部66题且不打开勾选框', async () => {
  const run = runtime();
  await run.directImport();
  assert.equal(run.reports.length, 0, run.controller.lastCategoryImportReportText);
  assert.deepEqual(run.writes, Array.from({ length: 66 }, (_, i) => i + 1));
  assert.deepEqual(run.pages.map(page => page.number), [1, 2, 3, 4]);
  for (const { context } of run.pages) {
    assert.equal(context.categoryId, 400);
    assert.equal(context.listId, 'exam-chapters-math-2');
    assert.equal(context.listRevision, 7);
    assert.equal(context.scope, 'exam');
    assert.equal(context.examSubject, 'math_2');
  }
});

test('旧分类网址保持可绑定，不要求网页具有新版目录控件', async () => {
  const run = runtime({ url: 'https://cxyonly.fans/math/practice/3?resumeCategoryId=4' });
  run.window.document.body.innerHTML = '';
  await run.bind();
  assert.equal(run.bindings.length, 1, run.messages.join('\n'));
  assert.equal(run.bindings[0].id, 4);
});

test('缺少选中节点且题型名称重复时拒绝猜测', async () => {
  const run = runtime();
  run.window.document.querySelector('aside').remove();
  await run.bind();
  assert.equal(run.bindings.length, 0);
  assert.match(run.messages.at(-1), /唯一|同名|目录/);
});

test('目录收起时可按页面明确的完整题型路径绑定', async () => {
  const run = runtime();
  run.window.document.querySelector('aside').remove();
  run.window.document.querySelector('h1 button').setAttribute('title', '高等数学 / 一元微分 / 凹凸性 / 基本概念题');
  await run.bind();
  assert.equal(run.bindings[0]?.id, 4, run.messages.join('\n'));
});

test('全部分类页面不误绑定到题单的根节点', async () => {
  const run = runtime();
  run.window.document.querySelector('[data-chapter-id]').setAttribute('data-chapter-id', '0');
  run.window.document.querySelector('h1 button').setAttribute('title', '全部分类');
  await run.bind();
  assert.equal(run.bindings.length, 0);
  assert.match(run.messages.at(-1), /具体.*分类/);
});

test('网页读取失败或题单读取失败时显示原因且不保存绑定', async () => {
  const run = runtime({ readDirectory: () => Promise.reject(new Error('题单读取失败')) });
  await run.bind();
  assert.equal(run.bindings.length, 0);
  assert.match(run.messages.at(-1), /题单读取失败/);
  run.controller.webView.evaluateJavaScript = (script, callback) => callback(null, new Error('网页读取失败'));
  await run.bind();
  assert.equal(run.bindings.length, 0);
  assert.match(run.messages.at(-1), /网页读取失败/);
});

test('408 绑定仍保存原来的知识点或原卷地址', async () => {
  const url = 'https://www.408os.cn/exercise?knowledgeId=123';
  const run = runtime({ provider: '408', url });
  await run.bind();
  assert.equal(run.bindings[0]?.url, url);
  assert.equal(run.requests.length, 0);
});

test('知识点页或外站不借用残留的分类控件建立绑定', async () => {
  for (const url of ['https://cxyonly.fans/math/practice/concepts/400', 'https://example.com/math/practice']) {
    const run = runtime({ url });
    await run.bind();
    assert.equal(run.bindings.length, 0);
    assert.match(run.messages.at(-1), /数学题型练习页面/);
  }
});

test('读取题单期间当前分类变化，不保存旧页面的绑定', async () => {
  let complete;
  const run = runtime({ readDirectory: () => new Promise(resolve => { complete = resolve; }) });
  const pending = run.bind();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(typeof complete, 'function');
  run.window.document.querySelector('[data-chapter-id]').setAttribute('data-chapter-id', '600');
  complete(directory);
  await pending;
  assert.equal(run.bindings.length, 0);
  assert.match(run.messages.at(-1), /变化|切换|重试/);
});

test('读取题单期间切换学习集，不把旧分类绑定到新的学习集', async () => {
  let complete;
  const run = runtime({ readDirectory: () => new Promise(resolve => { complete = resolve; }) });
  const pending = run.bind();
  await new Promise(resolve => setImmediate(resolve));
  run.changeSource({ notebookId: 'another-book', parentNoteId: 'another-parent' });
  complete(directory);
  await pending;
  assert.equal(run.bindings.length, 0);
  assert.match(run.messages.at(-1), /学习集.*变化/);
});
