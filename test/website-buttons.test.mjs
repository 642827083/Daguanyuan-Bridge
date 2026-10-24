import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../src/DaguanyuanWebsiteBridge.js", import.meta.url), "utf8");

test('数学单题按钮默认隐藏，开启后位于题目元数据末尾，关闭立即移除', () => {
  const page = browser('www.cxyonly.fans', '/math/practice/1');
  page.context.window.location.href = 'https://www.cxyonly.fans/math/practice/1';
  const row = page.element('li', { 'data-learning-question-id': '843' });
  const card = page.element('article', { 'data-learning-question-card': '' });
  const header = page.element('header'), metadata = page.element('div');
  const source = page.element('span');
  metadata.appendChild(page.element('strong')); metadata.appendChild(source);
  header.appendChild(metadata); card.appendChild(header); row.appendChild(card); page.main.appendChild(row); page.rows.push(row);
  const bridge = page.context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__;
  vm.runInContext(bridge.singleImportScript(), page.context); page.runSync();
  assert.equal(row.querySelector('[data-daguanyuan-single-import]'), null);
  vm.runInContext(bridge.singleImportScript(true), page.context); page.runSync();
  const button = row.querySelector('[data-daguanyuan-single-import]');
  assert.equal(button.textContent, '导入本题'); assert.equal(button.previousElementSibling, source);
  button.handlers.click.call(button, { preventDefault() {}, stopPropagation() {} });
  const target = JSON.parse(decodeURIComponent(page.body.children.at(-1).src.split('payload=')[1]));
  assert.equal(target.id, 843); assert.equal(target.provider, 'math'); assert.equal(button.disabled, true);
  const frames = page.body.children.length;
  button.handlers.click.call(button, { preventDefault() {}, stopPropagation() {} });
  assert.equal(page.body.children.length, frames);
  page.context.window.__DAGUANYUAN_SINGLE_IMPORT_BUTTONS__.finishImport(); page.runSync();
  assert.equal(button.disabled, false); assert.equal(button.textContent, '导入本题');
  vm.runInContext(bridge.singleImportScript(false), page.context); page.runSync();
  assert.equal(row.querySelector('[data-daguanyuan-single-import]'), null);
});

test('408 单题按钮位于分值右侧，点击捕获当前题号，翻题后不会发送旧题号', () => {
  const page = browser('www.408os.cn', '/exercise', '?year=2026');
  page.context.window.location.href = 'https://www.408os.cn/exercise?year=2026';
  const row = page.element('div', { class: 'question-card' });
  const header = page.element('div', { class: 'question-header' }), metadata = page.element('div', { class: 'header-tags' });
  const year = page.element('span', { class: 'year-tag' }), number = page.element('span', { class: 'index-tag' }), score = page.element('span', { class: 'score-tag' });
  year.textContent = '2026'; number.textContent = '第44题'; score.textContent = '10分';
  metadata.appendChild(year); metadata.appendChild(number); metadata.appendChild(score); header.appendChild(metadata); row.appendChild(header);
  page.main.appendChild(row); page.rows.push(row);
  const bridge = page.context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__;
  vm.runInContext(bridge.singleImportScript(true), page.context); page.runSync();
  const button = row.querySelector('[data-daguanyuan-single-import]');
  assert.equal(button.previousElementSibling, score);
  const original = JSON.parse(button.getAttribute('data-daguanyuan-single-import'));
  assert.equal(original.year, 2026); assert.equal(original.number, 44);
  number.textContent = '第45题';
  button.handlers.click.call(button, { preventDefault() {}, stopPropagation() {} });
  const target = JSON.parse(decodeURIComponent(page.body.children.at(-1).src.split('payload=')[1]));
  assert.equal(target.number, 45); assert.equal(metadata.children.filter(n => n.tagName === 'BUTTON').length, 1);
  page.context.window.location.pathname = '/overview';
  vm.runInContext(bridge.singleImportScript(true), page.context); page.runSync();
  assert.equal(row.querySelector('[data-daguanyuan-single-import]'), null);
});

test('数学的来源无论是视频按钮还是文本，三个工具均紧接来源右侧并位于分类路径之前', () => {
  for (const sourceTag of ['button', 'span']) {
    const page = browser('cxyonly.fans', '/math/practice/1');
    page.context.window.location.href = 'https://cxyonly.fans/math/practice/1';
    const row = page.element('li', { 'data-learning-question-id': '843' });
    const card = page.element('article', { 'data-learning-question-card': '' });
    const header = page.element('header'), metadata = page.element('div');
    const sourceLabel = page.element(sourceTag, { 'data-question-source': '' });
    const path = page.element('span', { 'data-question-category-paths': '' });
    sourceLabel.textContent = '2026数二（1） ▷'; path.textContent = '高等数学 / 极限 / 函数';
    let opened = false; sourceLabel.addEventListener('click', () => { opened = true; });
    metadata.appendChild(page.element('strong')); metadata.appendChild(sourceLabel); metadata.appendChild(path);
    header.appendChild(metadata); card.appendChild(header); row.appendChild(card); page.main.appendChild(row); page.rows.push(row);
    const bridge = page.context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__;
    vm.runInContext(bridge.practiceScript(true, true), page.context); page.runSync();
    vm.runInContext(bridge.singleImportScript(true), page.context); page.runSync();
    const tools = () => metadata.children.filter(b => b.getAttribute('data-daguanyuan-question-target') !== null);
    assert.deepEqual(tools().map(b => b.textContent), ['定位卡片', '添加笔记', '导入本题']);
    assert.equal(tools()[0].previousElementSibling === sourceLabel, true);
    assert.equal(path.previousElementSibling === tools()[2], true);
    sourceLabel.handlers.click(); assert.equal(opened, true);
    vm.runInContext(bridge.practiceScript(true, false), page.context); page.runSync();
    assert.deepEqual(tools().map(b => b.textContent), ['定位卡片', '导入本题']);
    assert.equal(tools()[0].previousElementSibling === sourceLabel, true);
    vm.runInContext(bridge.singleImportScript(false), page.context); page.runSync();
    assert.equal(tools().length, 1); assert.equal(tools()[0].previousElementSibling === sourceLabel, true);
  }
});

function browser(hostname, pathname, search = "") {
  const timers = [];
  function element(tagName = "div", attributes = {}) {
    return {
      tagName: tagName.toUpperCase(), attributes, children: [], parentNode: null, handlers: {}, style: {},
      get firstChild() { return this.children[0] || null; },
      get previousElementSibling() {
        if (!this.parentNode) return null;
        return this.parentNode.children[this.parentNode.children.indexOf(this) - 1] || null;
      },
      get nextSibling() {
        if (!this.parentNode) return null;
        return this.parentNode.children[this.parentNode.children.indexOf(this) + 1] || null;
      },
      getAttribute(name) { return this.attributes[name] ?? null; },
      setAttribute(name, value) { this.attributes[name] = value; },
      appendChild(child) { child.parentNode = this; this.children.push(child); },
      insertBefore(child, sibling) {
        if (child.parentNode) child.parentNode.removeChild(child);
        child.parentNode = this;
        const index = this.children.indexOf(sibling);
        this.children.splice(index < 0 ? this.children.length : index, 0, child);
      },
      removeChild(child) { this.children = this.children.filter((item) => item !== child); child.parentNode = null; },
      matches(selector) { return selector === "article.question-document[data-question-id]" && this.tagName === "ARTICLE"; },
      closest(selector) {
        let node = this.parentNode;
        while (node) {
          if (selector === "[data-learning-question-id]" && node.getAttribute("data-learning-question-id")) return node;
          node = node.parentNode;
        }
        return null;
      },
      querySelector(selector) {
        if (selector === '.question-header > .header-tags') return this.querySelector('.header-tags');
        if (selector === '[data-learning-question-card] > header > div:first-child') {
          const card = this.querySelector("[data-learning-question-card]");
          const header = card?.children.find((child) => child.tagName === "HEADER");
          return header?.children.find((child) => child.tagName === "DIV") || null;
        }
        const attribute = selector.match(/^\[([^\]]+)\]$/);
        for (const child of this.children) {
          if (selector.startsWith('.') && String(child.getAttribute('class') || '').split(' ').includes(selector.slice(1))) return child;
          if (selector.toUpperCase() === child.tagName) return child;
          if (selector === '[class*="chapterSelector"]' && String(child.getAttribute("class") || "").includes("chapterSelector")) return child;
          if (attribute && child.getAttribute(attribute[1]) !== null) return child;
          const nested = child.querySelector(selector);
          if (nested) return nested;
        }
        return null;
      },
      addEventListener(name, callback) { this.handlers[name] = callback; },
    };
  }
  const body = element("body");
  const main = element("main");
  body.appendChild(main);
  const practiceHeader = element("header", { "data-learning-question-practice-toolbar": "" });
  const contextBox = element("div", { "data-slot": "context" });
  const categorySelector = element("div", { "class": "chapterSelector" });
  contextBox.appendChild(categorySelector);
  practiceHeader.appendChild(contextBox);
  main.appendChild(practiceHeader);
  const exerciseHeader = element("header", { "class": "exercise-header" });
  const exerciseLeft = element("div", { "class": "header-left" });
  const modeSwitch = element("div", { "class": "mode-switch" });
  exerciseLeft.appendChild(element("button"));
  exerciseLeft.appendChild(element("h1"));
  exerciseLeft.appendChild(modeSwitch);
  exerciseHeader.appendChild(exerciseLeft);
  main.appendChild(exerciseHeader);
  const rows = [];
  const context = { URL, URLSearchParams,
    window: {
      location: { hostname, pathname, search },
      setTimeout(callback, delay) { timers.push({ callback, delay }); return timers.length; },
      addEventListener() {},
    },
    document: {
      documentElement: element("html"), body,
      createElement(tag) { return element(tag); },
      querySelector(selector) {
        if (selector === "main") return main;
        if (selector === '[role="main"]') return null;
        if (selector === '[data-learning-question-practice-toolbar] [data-slot="context"]') return contextBox;
        if (selector === ".exercise-header > .header-left") return exerciseLeft;
        return body.querySelector(selector);
      },
      querySelectorAll(selector) {
        if (selector.startsWith("[data-learning-question-id], article.question-document[data-question-id]") || selector === '.question-card') return rows;
        const found = [];
        const attribute = selector.match(/^\[([^\]]+)\]$/);
        function visit(node) {
          if (attribute && node.getAttribute(attribute[1]) !== null) found.push(node);
          node.children.forEach(visit);
        }
        visit(body);
        return found;
      },
    },
    MutationObserver: class { observe() {} },
    Number, String, encodeURIComponent,
  };
  vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../src/Daguanyuan408Routes.js', import.meta.url), 'utf8'), context);
  vm.runInContext(source, context);
  function runSync() {
    const index = timers.findIndex((item) => item.delay === 80);
    assert.ok(index >= 0);
    timers.splice(index, 1)[0].callback();
  }
  return { context, body, main, contextBox, categorySelector, exerciseLeft, modeSwitch, rows, element, runSync };
}

test('408 题本显示三个单题工具，翻题回传当前题号，始终隐藏导入当前题目', () => {
  for (const query of ['?mode=collection&collectionId=4&collectionName=不会题本', '?mode=collection&collectionId=8&collectionName=不熟题本&year=2026']) {
    const page = browser('www.408os.cn', '/exercise', query);
    page.context.window.location.href = 'https://www.408os.cn/exercise' + query;
    const row = page.element('div', { class: 'question-card' }), metadata = page.element('div', { class: 'header-tags' });
    const year = page.element('span', { class: 'year-tag' }), number = page.element('span', { class: 'index-tag' });
    year.textContent = '2025'; number.textContent = '第14题'; metadata.appendChild(year); metadata.appendChild(number); row.appendChild(metadata);
    page.main.appendChild(row); page.rows.push(row);
    const bridge = page.context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__;
    vm.runInContext(bridge.practiceScript(true, true), page.context); page.runSync();
    vm.runInContext(bridge.singleImportScript(true), page.context); page.runSync();
    const buttons = metadata.children.filter(item => item.tagName === 'BUTTON');
    assert.deepEqual(buttons.map(item => item.textContent), ['定位卡片', '添加笔记', '导入本题']);
    year.textContent = '2024'; number.textContent = '第13题';
    for (const [index, finish] of [[0, 'finishLocate'], [1, 'finishNotePaste'], [2, 'finishImport']]) {
      buttons[index].handlers.click.call(buttons[index], { preventDefault() {}, stopPropagation() {} });
      const target = JSON.parse(decodeURIComponent(page.body.children.at(-1).src.split('payload=')[1]));
      assert.equal(target.year, 2024); assert.equal(target.number, 13); assert.equal(target.url, page.context.window.location.href);
      page.context.window.__DAGUANYUAN_QUESTION_TOOLS__[finish](); page.runSync();
    }
    vm.runInContext(bridge.bindCategoryScript(true, true), page.context); page.runSync();
    assert.equal(page.body.querySelector('[data-daguanyuan-import-category]'), null);
    assert.equal(page.body.querySelector('[data-daguanyuan-bind-category-wrap]'), null);
    vm.runInContext(bridge.singleImportScript(false), page.context); page.runSync();
    assert.deepEqual(metadata.children.filter(item => item.tagName === 'BUTTON').map(item => item.textContent), ['定位卡片', '添加笔记']);
  }
});

test('数学和 408 三个工具统一排列、统一描边样式，开关互不覆盖', () => {
  for (const provider of ['math', '408']) {
    const page = browser(provider === 'math' ? 'cxyonly.fans' : 'www.408os.cn', provider === 'math' ? '/math/practice/1' : '/exercise', '?year=2026');
    page.context.window.location.href = provider === 'math' ? 'https://cxyonly.fans/math/practice/1' : 'https://www.408os.cn/exercise?year=2026';
    const row = page.element('li', provider === 'math' ? { 'data-learning-question-id': '843' } : { class: 'question-card' });
    const card = page.element('article', { 'data-learning-question-card': '' });
    const header = page.element('header'), metadata = page.element('div', { class: 'header-tags' });
    const year = page.element('span', { class: 'year-tag' }), number = page.element('span', { class: 'index-tag' }), score = page.element('span', { class: 'score-tag' });
    year.textContent = '2026'; number.textContent = '第44题'; score.textContent = '10分';
    metadata.appendChild(year); metadata.appendChild(number); metadata.appendChild(score); header.appendChild(metadata); card.appendChild(header); row.appendChild(card);
    page.main.appendChild(row); page.rows.push(row);
    const bridge = page.context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__;
    const buttons = () => metadata.children.filter(n => n.tagName === 'BUTTON');
    vm.runInContext(bridge.singleImportScript(true), page.context); page.runSync();
    vm.runInContext(bridge.practiceScript(true, true), page.context); page.runSync();
    assert.deepEqual(buttons().map(b => b.textContent), ['定位卡片', '添加笔记', '导入本题']);
    assert.equal(buttons()[0].previousElementSibling === score, true);
    assert.equal(new Set(buttons().map(b => b.style.cssText)).size, 1);
    assert.match(buttons()[2].style.cssText, /background:#fff/);
    for (let i = 0; i < 3; i += 1) {
      vm.runInContext(bridge.practiceScript(true, true), page.context); page.runSync();
      vm.runInContext(bridge.singleImportScript(true), page.context); page.runSync();
    }
    assert.equal(buttons().length, 3);
    vm.runInContext(bridge.singleImportScript(false), page.context); page.runSync();
    assert.deepEqual(buttons().map(b => b.textContent), ['定位卡片', '添加笔记']);
    vm.runInContext(bridge.practiceScript(false, true), page.context); page.runSync();
    assert.deepEqual(buttons().map(b => b.textContent), ['添加笔记']);
    vm.runInContext(bridge.singleImportScript(true), page.context); page.runSync();
    vm.runInContext(bridge.practiceScript(true, false), page.context); page.runSync();
    assert.deepEqual(buttons().map(b => b.textContent), ['定位卡片', '导入本题']);
  }
});

test('408 定位与添加笔记发送独立来源及最新题号，完成后恢复按钮', () => {
  const page = browser('www.408os.cn', '/exercise', '?knowledgeId=125');
  page.context.window.location.href = 'https://www.408os.cn/exercise?knowledgeId=125';
  const row = page.element('div', { class: 'question-card' }), metadata = page.element('div', { class: 'header-tags' });
  const year = page.element('span', { class: 'year-tag' }), number = page.element('span', { class: 'index-tag' });
  year.textContent = '2026'; number.textContent = '第44题'; metadata.appendChild(year); metadata.appendChild(number); row.appendChild(metadata);
  page.main.appendChild(row); page.rows.push(row);
  vm.runInContext(page.context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__.practiceScript(true, true), page.context); page.runSync();
  for (const [key, command, finish] of [['locate-card', 'locate-card', 'finishLocate'], ['add-note', 'add-note', 'finishNotePaste']]) {
    const button = row.querySelector('[data-daguanyuan-408-' + key + ']');
    number.textContent = '第45题';
    button.handlers.click.call(button, { preventDefault() {}, stopPropagation() {} });
    assert.equal(button.disabled, true);
    const frame = page.body.children.at(-1).src;
    assert.match(frame, new RegExp('daguanyuanbridge://' + command + '\\?payload='));
    const target = JSON.parse(decodeURIComponent(frame.split('payload=')[1]));
    assert.equal(target.provider, '408'); assert.equal(target.number, 45); assert.equal(target.year, 2026);
    const frameCount = page.body.children.length;
    button.handlers.click.call(button, { preventDefault() {}, stopPropagation() {} });
    assert.equal(page.body.children.length, frameCount);
    page.context.window.__DAGUANYUAN_QUESTION_TOOLS__[finish](); page.runSync();
    assert.equal(button.disabled, false);
    number.textContent = '第44题';
  }
});

test("数学题目页每题只插入一个定位卡片按钮并回传题目 ID", () => {
  const page = browser("www.cxyonly.fans", "/math/practice/855");
  const row = page.element("li", { "data-learning-question-id": "3356" });
  const card = page.element("article", { "data-learning-question-card": "" });
  const header = page.element("header");
  const metadata = page.element("div");
  const number = page.element("strong");
  const source = page.element("span");
  const article = page.element("article", { "data-question-id": "3356" });
  metadata.appendChild(number);
  metadata.appendChild(source);
  header.appendChild(metadata);
  card.appendChild(header);
  card.appendChild(article);
  row.appendChild(card);
  page.main.appendChild(row);
  page.rows.push(row, article);
  const script = page.context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__.practiceScript();
  vm.runInContext(script, page.context);
  page.runSync();
  const button = row.querySelector("[data-daguanyuan-practice-locate-card]");
  assert.equal(button?.textContent, "定位卡片");
  assert.deepEqual(metadata.children.map((child) => child.tagName), ["STRONG", "SPAN", "BUTTON"]);
  assert.equal(button.parentNode, metadata);
  assert.equal(article.querySelector("[data-daguanyuan-practice-locate-card]"), null);
  button.handlers.click.call(button, { preventDefault() {}, stopPropagation() {} });
  assert.equal(page.body.children.at(-1).src, "daguanyuanbridge://locate-card?id=3356");
  vm.runInContext(script, page.context);
  page.runSync();
  assert.equal(metadata.children.filter((child) => child.getAttribute("data-daguanyuan-practice-locate-card")).length, 1);
});

test("旧版题外按钮自动移到元数据右侧并采用复测按钮尺寸", () => {
  const page = browser("cxyonly.fans", "/math/practice/855");
  const row = page.element("li", { "data-learning-question-id": "3356" });
  const card = page.element("article", { "data-learning-question-card": "" });
  const header = page.element("header");
  const metadata = page.element("div");
  const number = page.element("strong");
  const source = page.element("span");
  const oldButton = page.element("button", { "data-daguanyuan-practice-locate-card": "3356" });
  oldButton.style.cssText = "font-size:12px";
  metadata.appendChild(number);
  metadata.appendChild(source);
  header.appendChild(metadata);
  card.appendChild(header);
  row.appendChild(card);
  row.appendChild(oldButton);
  page.main.appendChild(row);
  page.rows.push(row);
  vm.runInContext(page.context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__.practiceScript(), page.context);
  page.runSync();
  assert.equal(metadata.children[2] === oldButton, true);
  assert.match(oldButton.style.cssText, /padding:5px 10px/);
  assert.match(oldButton.style.cssText, /font-size:12px/);
});

test("题目页定位卡片开关可即时隐藏并重新显示按钮", () => {
  const page = browser("cxyonly.fans", "/math/practice/855");
  const row = page.element("li", { "data-learning-question-id": "3356" });
  const card = page.element("article", { "data-learning-question-card": "" });
  const header = page.element("header");
  const metadata = page.element("div");
  metadata.appendChild(page.element("strong"));
  metadata.appendChild(page.element("span"));
  header.appendChild(metadata);
  card.appendChild(header);
  row.appendChild(card);
  page.main.appendChild(row);
  page.rows.push(row);
  const bridge = page.context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__;
  vm.runInContext(bridge.practiceScript(true), page.context);
  page.runSync();
  assert.ok(row.querySelector("[data-daguanyuan-practice-locate-card]"));
  vm.runInContext(bridge.practiceScript(false), page.context);
  page.runSync();
  assert.equal(row.querySelector("[data-daguanyuan-practice-locate-card]"), null);
  vm.runInContext(bridge.practiceScript(true), page.context);
  page.runSync();
  assert.ok(row.querySelector("[data-daguanyuan-practice-locate-card]"));
});

test("添加笔记按钮紧邻定位卡片且两个开关独立", () => {
  const page = browser("cxyonly.fans", "/math/practice/360");
  const row = page.element("li", { "data-learning-question-id": "4042" });
  const card = page.element("article", { "data-learning-question-card": "" });
  const header = page.element("header");
  const metadata = page.element("div");
  metadata.appendChild(page.element("strong"));
  metadata.appendChild(page.element("span"));
  header.appendChild(metadata);
  card.appendChild(header);
  row.appendChild(card);
  page.main.appendChild(row);
  page.rows.push(row);
  const bridge = page.context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__;
  vm.runInContext(bridge.practiceScript(true, true), page.context);
  page.runSync();
  const locate = row.querySelector("[data-daguanyuan-practice-locate-card]");
  const note = row.querySelector("[data-daguanyuan-practice-add-note]");
  assert.equal(metadata.children[2] === locate && metadata.children[3] === note, true);
  assert.equal(note.textContent, "添加笔记");
  assert.equal(note.style.cssText, locate.style.cssText);
  note.handlers.click.call(note, { preventDefault() {}, stopPropagation() {} });
  assert.equal(page.body.children.at(-1).src, "daguanyuanbridge://add-note?id=4042");
  vm.runInContext(bridge.practiceScript(true, true), page.context);
  page.runSync();
  assert.equal(metadata.children.filter((item) => item.getAttribute("data-daguanyuan-practice-add-note")).length, 1);
  vm.runInContext(bridge.practiceScript(false, true), page.context);
  page.runSync();
  assert.equal(row.querySelector("[data-daguanyuan-practice-locate-card]"), null);
  assert.equal(metadata.children[2] === note, true);
  vm.runInContext(bridge.practiceScript(true, false), page.context);
  page.runSync();
  assert.equal(row.querySelector("[data-daguanyuan-practice-add-note]"), null);
  assert.ok(row.querySelector("[data-daguanyuan-practice-locate-card]"));
});

test("数学和 408 设置开关刷新右下角绑定按钮，页顶不重复显示绑定", () => {
  for (const [host, path, search] of [["cxyonly.fans", "/math/practice/855", ""], ["www.408os.cn", "/exercise", "?year=2026"]]) {
    const page = browser(host, path, search), states = [];
    page.context.window.__DAGUANYUAN_IMPORT_UI__ = { refresh() { states.push(page.context.window.__DAGUANYUAN_BIND_CATEGORY_BUTTON__.bindEnabled); } };
    const bridge = page.context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__;
    vm.runInContext(bridge.bindCategoryScript(true), page.context); page.runSync();
    assert.equal(page.main.querySelector("[data-daguanyuan-bind-category-wrap]"), null);
    assert.equal(states.at(-1), true);
    vm.runInContext(bridge.bindCategoryScript(false), page.context); page.runSync();
    assert.equal(states.at(-1), false);
  }
});

test("旧版页顶绑定按钮升级后移除，不在页顶重新创建", () => {
  const page = browser("cxyonly.fans", "/math/practice/855");
  const toolbar = page.element("div", { "data-daguanyuan-bind-category-wrap": "" });
  toolbar.appendChild(page.element("button"));
  page.main.insertBefore(toolbar, page.main.firstChild);
  const oldState = { timer: null, schedule() {} };
  page.context.window.__DAGUANYUAN_BIND_CATEGORY_BUTTON__ = oldState;
  vm.runInContext(page.context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__.bindCategoryScript(true), page.context);
  page.runSync();
  const current = page.main.querySelector("[data-daguanyuan-bind-category-wrap]");
  assert.equal(current, null);
  assert.equal(toolbar.parentNode, null);
  assert.equal(oldState.timer, -1);
});

test("数学页顶不再创建导入按钮，右下角导入开关与绑定独立", () => {
  const page = browser("cxyonly.fans", "/math/practice/1035");
  const bridge = page.context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__;
  vm.runInContext(bridge.bindCategoryScript(true, true), page.context); page.runSync();
  const state = page.context.window.__DAGUANYUAN_BIND_CATEGORY_BUTTON__;
  assert.equal(page.main.querySelector("[data-daguanyuan-bind-category-wrap]"), null);
  assert.equal(state.importEnabled, true);
  state.importBusy = true; state.finishImport(); page.runSync(); assert.equal(state.importBusy, false);
  vm.runInContext(bridge.bindCategoryScript(false, true), page.context); page.runSync();
  assert.equal(state.bindEnabled, false); assert.equal(state.importEnabled, true);
  vm.runInContext(bridge.bindCategoryScript(true, false), page.context); page.runSync();
  assert.equal(state.importEnabled, false);
  assert.equal(state.selectionEnabled, true);
  vm.runInContext(bridge.bindCategoryScript(true, false, false), page.context); page.runSync();
  assert.equal(state.selectionEnabled, false); assert.equal(state.bindEnabled, true);
  vm.runInContext(bridge.bindCategoryScript(true, false, true), page.context); page.runSync();
  assert.equal(state.selectionEnabled, true);
});

test("分类导入在侧栏收起时读取网站保存的严选范围", () => {
  const context = {
    URLSearchParams,
    window: {
      location: { href: "https://www.cxyonly.fans/math/practice/345" },
      localStorage: { getItem(key) { assert.equal(key, "daguan:question-bank-scope"); return "core"; } },
    },
    document: { querySelector() { return { getAttribute() { return "core"; } }; } },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  const bridge = context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__;
  const captured = JSON.parse(vm.runInContext(bridge.importContextScript(), context));
  assert.equal(captured.url, "https://www.cxyonly.fans/math/practice/345");
  assert.equal(captured.scope, "core");
  context.document.querySelector = () => null;
  assert.equal(JSON.parse(vm.runInContext(bridge.importContextScript(), context)).scope, "core");
  context.window.localStorage.getItem = () => null;
  assert.equal(JSON.parse(vm.runInContext(bridge.importContextScript(), context)).scope, "complete");
  context.window.localStorage.getItem = () => "exam";
  assert.equal(JSON.parse(vm.runInContext(bridge.importContextScript(), context)).scope, "exam");
  context.window.localStorage.getItem = () => { throw new Error("Storage blocked"); };
  assert.equal(JSON.parse(vm.runInContext(bridge.importContextScript(), context)).scope, "");
});

test("408 年份页移除旧入口并将导入状态交给右下角", () => {
  const page = browser("www.408os.cn", "/exercise", "?year=2026");
  const bridge = page.context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__;
  const states = [];
  page.context.window.__DAGUANYUAN_IMPORT_UI__ = { refresh() { states.push(page.context.window.__DAGUANYUAN_BIND_CATEGORY_BUTTON__.importEnabled); } };
  vm.runInContext(bridge.bindCategoryScript(true, true), page.context); page.runSync();
  assert.equal(page.main.querySelector("[data-daguanyuan-bind-category-wrap]"), null);
  assert.equal(states.at(-1), true);
  vm.runInContext(bridge.bindCategoryScript(false, false), page.context); page.runSync();
  assert.equal(states.at(-1), false);
});

test("408 知识点分类的导入配置不再创建页顶按钮", () => {
  const page = browser("www.408os.cn", "/exercise", "?knowledgeId=125&knowledgeName=浮点数");
  const bridge = page.context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__;
  vm.runInContext(bridge.bindCategoryScript(true, true), page.context); page.runSync();
  assert.equal(page.main.querySelector("[data-daguanyuan-bind-category-wrap]"), null);
  assert.equal(page.context.window.__DAGUANYUAN_BIND_CATEGORY_BUTTON__.importEnabled, true);
  vm.runInContext(bridge.bindCategoryScript(true, false), page.context); page.runSync();
  assert.equal(page.context.window.__DAGUANYUAN_BIND_CATEGORY_BUTTON__.importEnabled, false);
});

test("408 总览和数学首页不显示分类绑定按钮", () => {
  for (const [host, path] of [
    ["cxyonly.fans", "/math"],
    ["www.408os.cn", "/overview"],
  ]) {
    const page = browser(host, path);
    vm.runInContext(page.context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__.bindCategoryScript(true), page.context);
    page.runSync();
    assert.equal(page.main.querySelector("[data-daguanyuan-bind-category-wrap]"), null);
  }
});
