import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const bridgeSource = read('../src/DaguanyuanWebsiteBridge.js');
const nextSource = read('./browser/fixtures/408-next-question.js');
const headerSource = read('./browser/fixtures/408-year-header.js');

function page(number = 20, options = {}) {
  const timers = new Map(), listeners = {}, observers = [], actions = [];
  const url = new URL(options.url || 'https://www.408os.cn/exercise?year=2026&questionId=' + (799 + number));
  let timerId = 0;
  function element(tag = 'div', classes = '') {
    const attrs = {}, handlers = {};
    return {
      tagName: tag.toUpperCase(), className: classes, children: [], parentNode: null, textContent: '', innerHTML: '', handlers,
      get attributes() { return Object.entries(attrs).map(([name, value]) => ({ name, value })); },
      get firstChild() { return this.children[0] || null; },
      get nextSibling() { return this.parentNode?.children[this.parentNode.children.indexOf(this) + 1] || null; },
      getAttribute(name) { return attrs[name] ?? null; }, setAttribute(name, value) { attrs[name] = value; },
      appendChild(child) { if (child.parentNode) child.remove(); child.parentNode = this; this.children.push(child); return child; },
      insertBefore(child, sibling) { this.appendChild(child); if (sibling) { this.children.pop(); this.children.splice(this.children.indexOf(sibling), 0, child); } },
      remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(node => node !== this); this.parentNode = null; },
      closest(selector) { for (let node = this; node; node = node.parentNode) if (selector.startsWith('[') && node.getAttribute(selector.slice(1, -1)) !== null) return node; return null; },
      addEventListener(name, callback) { handlers[name] = callback; },
      click() { handlers.click?.({ preventDefault() {}, stopPropagation() {} }); },
      querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
      querySelectorAll(selector) {
        const matches = (node, part) => part === '*' || part.startsWith('.') && part.slice(1).split('.').every(value => node.className.split(' ').includes(value))
          || part.startsWith('[') && node.getAttribute(part.slice(1, -1)) !== null || node.tagName.toLowerCase() === part;
        const selected = [];
        function visit(node) {
          for (const rule of selector.split(', ')) {
            const parts = rule.split(' ');
            if (!matches(node, parts.at(-1))) continue;
            let parent = node.parentNode, index = parts.length - 2;
            while (index >= 0 && parent) { if (matches(parent, parts[index])) index--; parent = parent.parentNode; }
            if (index < 0) { selected.push(node); break; }
          }
          node.children.forEach(visit);
        }
        this.children.forEach(visit); return selected;
      },
    };
  }
  const root = element('html'), header = element('header', 'exercise-header'), left = element('div', 'header-left');
  const title = element('h1', 'header-title'); title.setAttribute('data-v-fixture', '');
  root.appendChild(header); header.appendChild(left); left.appendChild(title);
  const wrapper = element('div', 'single-question-wrapper'), card = element('div', 'question-card');
  const yearTag = element('span', 'year-tag'), numberTag = element('span', 'index-tag');
  root.appendChild(wrapper); wrapper.appendChild(card); card.appendChild(numberTag);
  if (!options.hideYear) card.appendChild(yearTag);
  const context = vm.createContext({});
  const all = Array.from({ length: 47 }, (_, index) => ({ id: 800 + index, year: 2026, questionIndex: index + 1 }));
  const model = { assigned: null, menu: null };
  function render(question) {
    context.K.value = [question];
    yearTag.textContent = String(question.year); numberTag.textContent = '第' + question.questionIndex + '题';
    title.textContent = context.websiteYearHeader(Object.fromEntries(url.searchParams), question, 1);
    observers.filter(observer => observer.active).forEach(observer => observer.callback());
  }
  Object.assign(context, {
    URLSearchParams, Number,
    document: { documentElement: root, createElement: element,
      querySelector: selector => root.querySelector(selector), querySelectorAll: selector => root.querySelectorAll(selector) },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; this.active = false; observers.push(this); }
      observe() { this.active = true; } disconnect() { this.active = false; }
    },
    window: {
      innerWidth: options.mobile ? 390 : 1200,
      location: Object.assign(url, { assign(address) { model.assigned = new URL(address, url).href; actions.push('navigate'); } }),
      setTimeout(callback) { timers.set(++timerId, callback); return timerId; }, clearTimeout(id) { timers.delete(id); },
      addEventListener(name, callback) { listeners[name] = callback; }, removeEventListener(name) { delete listeners[name]; },
    },
    K: { value: [all[number - 1]] }, le: { value: 0 }, G: { value: 'single' }, Mn: { value: 2026 },
    Yn: { value: false }, Tn: { value: false }, $n: { value: false },
    Il: { get value() { return context.K.value[0]; } },
    n: { replace: async value => { url.search = new URLSearchParams(value.query).toString(); actions.push('route'); } },
    Ul: async id => { actions.push('load:' + id); render(all.find(question => question.id === id)); },
    t: { get query() { return Object.fromEntries(url.searchParams); } }, i: Object.assign, u: Object.assign,
    l: { success() {}, info() {} },
    r(self, args, generator) {
      const iterator = generator.apply(self, args || []);
      return new Promise((resolve, reject) => {
        function step(value) { let result; try { result = iterator.next(value); } catch (error) { reject(error); return; }
          result.done ? resolve(result.value) : Promise.resolve(result.value).then(step, reject); }
        step();
      });
    },
  });
  vm.runInContext(bridgeSource, context); vm.runInContext(nextSource, context); vm.runInContext(headerSource, context);
  render(all[number - 1]);
  function run() { for (let count = 0; timers.size && count < 20; count++) { const batch = [...timers.values()]; timers.clear(); batch.forEach(callback => callback()); } assert.equal(timers.size, 0); }
  function notify() { observers.filter(observer => observer.active).forEach(observer => observer.callback()); run(); }
  return { context, model, url, root, left, title, numberTag, yearTag, actions, observers, listeners, run, notify,
    inject() { return vm.runInContext(context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__.exerciseQuestionScript(), context); },
    openMenu() { model.menu = element('div', 'settings-menu'); root.appendChild(model.menu); notify(); return model.menu; },
  };
}

test('真题直接加载第 20 题，标题与模式入口恢复，不选大纲、不滚动、不加载整卷', () => {
  const fixture = page();
  assert.equal(fixture.title.textContent, '第20题', '网站原始单题分支省略年份');
  assert.equal(fixture.inject(), 'direct:2026:819'); fixture.run();
  assert.equal(fixture.title.textContent, '2026年第20题');
  assert.deepEqual(fixture.actions, []);
  assert.equal(fixture.context.K.value.length, 1);
  const modes = fixture.root.querySelector('[data-daguanyuan-408-direct-modes]');
  assert.equal(modes.children.length, 2);
  assert.equal(modes.children[1].getAttribute('aria-pressed'), 'true');
  assert.equal(modes.children[0].getAttribute('data-v-fixture'), '');
});

test('复用网站真实上下题函数连续切题，不重新注入也持续保留年份且每次只加载一题', async () => {
  const fixture = page(); fixture.inject(); fixture.run();
  for (const number of [21, 22, 23]) {
    await fixture.context.ba(); fixture.run();
    assert.equal(fixture.title.textContent, '2026年第' + number + '题');
    assert.equal(fixture.url.searchParams.get('questionId'), String(799 + number));
    assert.equal(fixture.context.K.value.length, 1);
  }
  await fixture.context.ha(); fixture.run();
  assert.equal(fixture.title.textContent, '2026年第22题');
  assert.deepEqual(fixture.actions, ['route', 'load:820', 'route', 'load:821', 'route', 'load:822', 'route', 'load:821']);
  fixture.root.querySelector('[data-daguanyuan-408-direct-modes]').children[0].click();
  const address = new URL(fixture.model.assigned);
  assert.equal(address.searchParams.get('daguanyuanQuestionId'), '821', '进入列表使用当前题而非初次定位题');
  assert.equal(address.searchParams.get('daguanyuanView'), 'list');
  assert.equal(address.searchParams.has('questionId'), false);
});

test('手机隐藏年份标签也恢复标题，在设置菜单补齐显示模式，重复注入不重复创建', async () => {
  const fixture = page(42, { mobile: true, hideYear: true }); fixture.inject(); fixture.run();
  assert.equal(fixture.title.textContent, '2026年第42题');
  assert.equal(fixture.left.querySelector('[data-daguanyuan-408-direct-modes]'), null);
  const menu = fixture.openMenu();
  assert.equal(menu.firstChild.className, 'settings-section');
  assert.equal(menu.querySelectorAll('.mode-btn-mobile').length, 2);
  fixture.inject(); fixture.run();
  assert.equal(fixture.observers.length, 1);
  assert.equal(menu.querySelectorAll('.mode-btn-mobile').length, 2);
  await fixture.context.ba(); fixture.run();
  assert.equal(fixture.title.textContent, '2026年第43题');
});

test('题首题尾遵循网站边界，点击已选单题不导航，退出真题来源清理监听和按钮', async () => {
  for (const number of [1, 47]) {
    const fixture = page(number); fixture.inject(); fixture.run();
    await fixture.context[number === 1 ? 'ha' : 'ba'](); fixture.run();
    assert.equal(fixture.title.textContent, '2026年第' + number + '题');
    assert.deepEqual(fixture.actions, []);
    fixture.root.querySelector('[data-daguanyuan-408-direct-modes]').children[1].click();
    assert.equal(fixture.model.assigned, null);
    fixture.url.search = '?knowledgeId=53&daguanyuanQuestionId=419'; fixture.notify();
    assert.equal(fixture.root.querySelector('[data-daguanyuan-408-direct-modes]'), null);
    assert.equal(fixture.observers[0].active, false);
    assert.equal(Object.keys(fixture.listeners).length, 0);
  }
});

test('加载中旧题卡或错误年份不写入错误标题，非年份单题不修改页面', () => {
  const fixture = page(); fixture.numberTag.textContent = '第19题'; fixture.inject(); fixture.run();
  assert.equal(fixture.title.textContent, '第20题');
  fixture.numberTag.textContent = '第20题'; fixture.yearTag.textContent = '2025'; fixture.notify();
  assert.equal(fixture.title.textContent, '第20题');
  fixture.yearTag.textContent = '2026'; fixture.notify();
  assert.equal(fixture.title.textContent, '2026年第20题');
  for (const query of ['?year=2026&questionId=419', '?year=2026&questionId=819&mode=collection', '?questionId=819', '?year=2026']) {
    const other = page(20, { url: 'https://www.408os.cn/exercise' + query }); other.inject();
    assert.equal(other.observers.length, 0);
    assert.equal(other.root.querySelector('[data-daguanyuan-408-direct-modes]'), null);
  }
});

test('网站恢复原有模式按钮后移除补充入口，不重复展示', () => {
  const fixture = page(); fixture.inject(); fixture.run();
  const native = fixture.context.document.createElement('div', 'mode-switch');
  fixture.left.appendChild(native); fixture.notify();
  assert.equal(fixture.left.querySelectorAll('.mode-switch').length, 1);
  assert.equal(fixture.left.querySelector('[data-daguanyuan-408-direct-modes]'), null);
});
