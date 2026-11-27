import { withMathSite } from './helpers/math-site.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const bridgeSource = withMathSite(fs.readFileSync(new URL('../src/DaguanyuanWebsiteBridge.js', import.meta.url), 'utf8'));
const routeSource = withMathSite(fs.readFileSync(new URL('../src/Daguanyuan408Routes.js', import.meta.url), 'utf8'));
const nextSource = withMathSite(fs.readFileSync(new URL('./browser/fixtures/408-next-question.js', import.meta.url), 'utf8'));
const headerSource = withMathSite(fs.readFileSync(new URL('./browser/fixtures/408-year-header.js', import.meta.url), 'utf8'));
const questions = [
  { id: 12, year: 2009, questionIndex: 12 },
  { id: 419, year: 2017, questionIndex: 43 },
  { id: 640, year: 2022, questionIndex: 29 },
];

function fixture(all = questions, target = 419, options = {}) {
  const context = vm.createContext({}); vm.runInContext(routeSource, context);
  const sourceURL = options.year ? 'https://www.408os.cn/exercise?year=' + options.year : 'https://www.408os.cn/exercise?knowledgeId=53&knowledgeName=数据类型转换'
    + (options.sourcePage ? '&sourcePage=' + encodeURIComponent(options.sourcePage) : '');
  // 年份场景保留旧整卷链接，验证兼容定位和主动进入列表时的行为。
  const url = new URL(options.year ? sourceURL + '&daguanyuanQuestionId=' + target
    : context.__DAGUANYUAN_408_ROUTES_GLOBAL__.detailURL(sourceURL, target, 2017));
  // 模拟网站接口按定位 URL 的来源范围返回数据；丢失 overview 时后续页会包含 Relax。
  if (options.bank && url.searchParams.get('sourcePage') === 'overview') all = all.filter(question => ['PAST_EXAM', 'EXAM'].includes(question.sourceType));
  const timers = [], listeners = {}, attrs = {}, actions = [];
  let clock = 0, loaded = Math.min(options.pageSize || 47, all.length), rendered = Math.min(10, loaded), mode = 'list';
  const model = { activeIndex: 0, nextLoaded: [], modal: false, assigned: null, messages: [],
    pages: [{ pageNum: 1, sourcePage: url.searchParams.get('sourcePage') }] };
  const current = () => all[model.activeIndex];
  function item(label, isActive, click, unloaded = false) {
    return { textContent: label, click, classList: { contains(value) { return value === 'active' ? isActive() : value === 'unloaded' && unloaded; } } };
  }
  function card(question) {
    return { querySelector(selector) {
      return { textContent: selector === '.year-tag' ? String(question.year) : '第' + question.questionIndex + '题' };
    } };
  }
  function load() { loaded = Math.min(loaded + (options.pageSize || 47), all.length); rendered = Math.min(10, loaded); context.K.value = all.slice(0, loaded); actions.push('load'); model.pages.push({ pageNum: model.pages.length + 1, sourcePage: url.searchParams.get('sourcePage') }); }
  const document = {
    documentElement: { setAttribute(key, value) { attrs[key] = value; } },
    addEventListener(name, callback) { listeners[name] = callback; },
    removeEventListener(name) { delete listeners[name]; },
    querySelector(selector) {
      if (selector === '.progress-restore-overlay') return model.modal ? {} : null;
      if (selector === '.single-question-wrapper .question-card') return mode === 'single' && current() ? card(options.wrongCard || current()) : null;
      if (selector === '.load-more-btn') return loaded < all.length ? { disabled: false, textContent: '加载更多 (剩余 ' + (all.length - loaded) + ' 题)', click: load } : null;
      if (selector === '.content-area') return { dispatchEvent() {} };
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '.mode-switch .mode-btn, .mode-btn-mobile') return ['list', 'single'].map(value => item(value === 'list' ? '列表模式' : '单题模式', () => mode === value, () => { mode = value; context.G.value = value; actions.push(value); }));
      if (selector === '.question-wrapper[data-question-id]') return mode === 'list' ? all.slice(0, rendered).map((question, index) => ({
        getAttribute() { return String(question.id); }, querySelector: card(question).querySelector,
        scrollIntoView() { model.activeIndex = index; rendered = Math.min(loaded, index + 10); actions.push('scroll:' + question.id); },
      })) : [];
      if (selector === '.exercise-outline .num-item') {
        if (mode !== 'list' || options.noOutline) return [];
        const first = Math.max(0, Math.min(model.activeIndex - 10, all.length - 20));
        return all.slice(first, first + 20).map((question, offset) => {
          const index = first + offset;
          return item(String(options.year ? question.questionIndex : index + 1), () => model.activeIndex === index, () => { model.activeIndex = index; rendered = Math.min(loaded, index + 10); actions.push('jump:' + question.id); }, index >= loaded);
        });
      }
      return [];
    },
  };
  Object.assign(context, {
    URLSearchParams, document, Event: class {}, Date: { now: () => clock },
    window: { location: Object.assign(url, { assign(address) { model.assigned = new URL(address, url).href; } }), setTimeout(callback, delay) { const timer = { callback, delay }; timers.push(timer); return timer; }, clearTimeout(timer) { const index = timers.indexOf(timer); if (index >= 0) timers.splice(index, 1); } },
    K: { value: all.slice(0, loaded) }, Yn: { value: url.searchParams.has('knowledgeId') }, Tn: { value: false }, $n: { value: false }, G: { value: mode }, Mn: { value: options.year || 2017 }, In: { value: Number(url.searchParams.get('questionId')) || null }, ta: new Map(),
    Il: { get value() { return context.K.value[model.activeIndex]; } }, le: { get value() { return model.activeIndex; }, set value(value) { model.activeIndex = value; } },
    fa: async id => { if (all.findIndex(q => q.id === id) + 1 >= loaded && loaded < all.length) load(); return model.activeIndex < loaded - 1; },
    Xl: async id => { model.nextLoaded.push(id); }, da: async () => {}, Ul: async id => { if (!options.year) throw new Error('不应请求年份下一题 ' + id); context.K.value = [all.find(q => q.id === id)]; model.activeIndex = 0; },
    n: { replace: async value => { if (!options.year) throw new Error('不应替换知识点网址为年份网址'); url.search = new URLSearchParams(value.query).toString(); } }, l: { success(message) { model.messages.push(message); }, info(message) { model.messages.push(message); } },
    t: { get query() { return Object.fromEntries(url.searchParams); } }, i: Object.assign, u: Object.assign,
    ua: async () => { throw new Error('分类仅一题时也不能加载年份题卷'); },
    ka: async index => { model.activeIndex = index; },
    r: function (self, args, generator) { const iterator = generator.apply(self, args || []); return new Promise((resolve, reject) => { function step(value) { let result; try { result = iterator.next(value); } catch (error) { reject(error); return; } result.done ? resolve(result.value) : Promise.resolve(result.value).then(step, reject); } step(); }); },
  });
  vm.runInContext(bridgeSource, context); vm.runInContext(nextSource, context); vm.runInContext(headerSource, context);
  const script = context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__.exerciseQuestionScript();
  function run(max = 700) {
    for (let i = 0; timers.length && i < max; i++) { const timer = timers.shift(); clock += timer.delay; timer.callback(); }
    return attrs['data-daguanyuan-408-question-locator'];
  }
  async function clickNavigation(direction = 'next', mobile = false, disabled = false) {
    let stopped = false;
    const button = { disabled, classList: { contains(name) { return name === (mobile ? direction : 'nav-' + direction); } } };
    const event = { target: { closest() { return button; } }, preventDefault() {}, stopImmediatePropagation() { stopped = true; } };
    if (listeners.click) listeners.click(event);
    if (!stopped && !disabled) await context[direction === 'next' ? 'ba' : 'ha']();
    return stopped;
  }
  return { context, model, url, document, listeners, actions, run, clickNavigation, inject() { return vm.runInContext(script, context); }, current };
}

test('知识点中选中实际 ID 后进入单题，网站真实下一题函数跨年份切到同知识点，重复注入不拉回', async () => {
  const page = fixture(); page.inject();
  assert.equal(page.run(), 'success:53:419'); assert.equal(page.current().id, 419);
  await page.context.ba(); assert.equal(page.current().id, 640);
  assert.deepEqual(page.model.nextLoaded, [640]);
  page.inject(); page.run(); assert.equal(page.current().id, 640);
  await page.context.ba(); assert.equal(page.current().id, 640);
  assert.equal(page.url.searchParams.get('knowledgeId'), '53');
});

test('分页和延迟渲染的第 54 道题会被选中，上下题顺序保持分类顺序', async () => {
  const rows = Array.from({ length: 70 }, (_, index) => ({ id: 1000 + index * 2, year: 2010 + index % 16, questionIndex: 1 + index % 47 }));
  const page = fixture(rows, rows[53].id, { pageSize: 17 }); page.inject();
  assert.equal(page.run(), 'success:53:' + rows[53].id);
  assert.ok(page.actions.includes('load')); assert.equal(page.current().id, rows[53].id);
  await page.context.ba(); assert.equal(page.current().id, rows[54].id);
});

test('隐藏大纲仍能通过网站滚动选中；错误题卡校验失败，不报告成功', () => {
  const page = fixture(questions, 419, { noOutline: true }); page.inject();
  assert.equal(page.run(), 'success:53:419');
  const wrong = fixture(questions, 419, { wrongCard: questions[0] }); wrong.inject();
  assert.equal(wrong.run(), 'failed:53:419');
});

test('目标不在分类时限时失败，切换分类和用户操作取消，定位后释放监听', () => {
  const missing = fixture(questions, 843); missing.inject(); assert.equal(missing.run(), 'failed:53:843');
  assert.equal(Object.keys(missing.listeners).length, 0);
  const changed = fixture(); changed.inject(); changed.url.search = '?knowledgeId=54&questionId=419';
  assert.equal(changed.run(), 'cancelled:53:419');
  const cancelled = fixture(); cancelled.inject(); cancelled.listeners.touchstart({ isTrusted: true });
  assert.equal(cancelled.run(), 'cancelled:53:419');
});

test('知识点仅一题时网站原有自动切题不退回年份题卷', async () => {
  const page = fixture([questions[1]]); page.inject(); assert.equal(page.run(), 'success:53:419');
  await page.context.wa(419); assert.equal(page.current().id, 419);
});

test('只有真题的知识点连续切题和分页保留范围，最后一题不进入 Relax，自动切题也停止', async () => {
  const bank = questions.map((question, index) => ({ ...question, sourceType: index === 1 ? 'EXAM' : 'PAST_EXAM' }))
    .concat({ id: 2000, year: 0, questionIndex: 9, sourceType: 'RELAX1000' });
  const page = fixture(bank, 419, { bank: true, sourcePage: 'overview', pageSize: 1 });
  page.inject(); assert.equal(page.run(), 'success:53:419');
  await page.context.ba(); assert.equal(page.current().id, 640);
  await page.context.ba(); assert.equal(page.current().id, 640, '最后一道真题后不能进入 Relax');
  await page.context.wa(640); assert.equal(page.current().id, 640);
  assert.deepEqual(page.model.nextLoaded, [640]);
  assert.equal(page.model.pages.length, 3);
  assert.ok(page.model.pages.every(request => request.sourcePage === 'overview'));
  assert.ok(page.model.messages.includes('已经是最后一题了'));
});

test('未限定真题的知识点继续沿全部来源切题，只有一题的真题范围也正确停止', async () => {
  const bank = [{ ...questions[1], sourceType: 'PAST_EXAM' }, { id: 2000, year: 0, questionIndex: 9, sourceType: 'RELAX1000' }];
  const all = fixture(bank, 419, { bank: true, pageSize: 1 }); all.inject(); all.run();
  await all.context.ba(); assert.equal(all.current().id, 2000);
  const exam = fixture(bank, 419, { bank: true, sourcePage: 'overview', pageSize: 1 }); exam.inject(); exam.run();
  await exam.context.ba(); await exam.context.wa(419);
  assert.equal(exam.current().id, 419); assert.deepEqual(exam.model.nextLoaded, []);
});

test('年份完整题卷定位第 20 题和第 42 题，保留完整列表及模式切换', () => {
  const rows = Array.from({ length: 47 }, (_, index) => ({ id: 800 + index, year: 2026, questionIndex: index + 1 }));
  for (const number of [20, 42]) {
    const page = fixture(rows, rows[number - 1].id, { year: 2026 }); page.inject();
    assert.equal(page.run(), 'success:year:2026:' + rows[number - 1].id);
    assert.equal(page.current().questionIndex, number);
    assert.equal(page.context.K.value.length, 47);
    assert.equal(page.context.G.value, 'single');
    assert.equal(page.context.In.value, null, '不能触发网站独立单题标志');
    assert.equal(page.url.searchParams.get('year'), '2026');
    assert.equal(page.url.searchParams.has('questionId'), false);
    assert.equal(page.context.websiteYearHeader(Object.fromEntries(page.url.searchParams), page.current(), page.context.K.value.length),
      '2026年第' + number + '题', '复用网站实际标题分支验证年份未丢失');
  }
});

test('年份大纲按原题号选择，题型筛选后不按数组位置误选', () => {
  const rows = [{ id: 819, year: 2026, questionIndex: 20 }, { id: 841, year: 2026, questionIndex: 42 }];
  const page = fixture(rows, 841, { year: 2026 }); page.inject();
  assert.equal(page.run(), 'success:year:2026:841');
  assert.equal(page.current().questionIndex, 42);
  const changed = fixture(rows, 841, { year: 2026 }); changed.inject(); changed.url.searchParams.set('year', '2025');
  assert.equal(changed.run(), 'cancelled:year:2026:841');
});

test('用户主动选择列表模式时，整卷定位当前题后停留在列表，不自动切回单题', () => {
  const rows = Array.from({ length: 47 }, (_, index) => ({ id: 800 + index, year: 2026, questionIndex: index + 1 }));
  const page = fixture(rows, 821, { year: 2026 }); page.url.searchParams.set('daguanyuanView', 'list');
  page.inject(); assert.equal(page.run(), 'success:year:2026:821');
  assert.equal(page.current().questionIndex, 22);
  assert.equal(page.context.K.value.length, 47);
  assert.equal(page.context.G.value, 'list');
});

test('旧整卷链接切到单题后，下一题改走直接按 ID 加载的入口', async () => {
  const rows = Array.from({ length: 47 }, (_, index) => ({ id: 800 + index, year: 2026, questionIndex: index + 1 }));
  for (const number of [1, 20, 42, 46]) {
    const page = fixture(rows, rows[number - 1].id, { year: 2026 }); page.inject(); page.run();
    await page.clickNavigation();
    const title = page.context.websiteYearHeader(Object.fromEntries(page.url.searchParams), page.context.Il.value, page.context.K.value.length);
    assert.notEqual(title, '第' + (number + 1) + '题', '下一题不能丢失年份标题');
    const next = new URL(page.model.assigned);
    assert.equal(next.searchParams.get('questionId'), String(rows[number].id));
    assert.equal(next.searchParams.has('daguanyuanQuestionId'), false);
  }
});

test('年份手机上下题入口、边界、重复点击及切换分类不会误跳', async () => {
  const rows = Array.from({ length: 47 }, (_, index) => ({ id: 800 + index, year: 2026, questionIndex: index + 1 }));
  const page = fixture(rows, 819, { year: 2026 }); page.inject(); page.run();
  assert.equal(await page.clickNavigation('prev', true), true);
  assert.equal(new URL(page.model.assigned).searchParams.get('questionId'), '818');
  await page.clickNavigation('next', true);
  assert.equal(new URL(page.model.assigned).searchParams.get('questionId'), '818', '跳转未完成时不能重复发起另一方向');
  for (const [id, direction] of [[800, 'prev'], [846, 'next']]) {
    const edge = fixture(rows, id, { year: 2026 }); edge.inject(); edge.run();
    assert.equal(await edge.clickNavigation(direction, true, true), false);
    assert.equal(edge.model.assigned, null);
  }
  const changed = fixture(rows, 819, { year: 2026 }); changed.inject(); changed.run(); changed.url.search = '?knowledgeId=53';
  assert.equal(await changed.clickNavigation('prev'), false);
  assert.equal(changed.model.assigned, null);
  const knowledge = fixture(); knowledge.inject(); knowledge.run();
  assert.equal(await knowledge.clickNavigation(), false);
  assert.equal(knowledge.current().id, 640);
});

test('年份手机隐藏年份标签时，上下题仍使用当前年份；题卡年份不匹配时不接管', async () => {
  const rows = Array.from({ length: 47 }, (_, index) => ({ id: 800 + index, year: 2026, questionIndex: index + 1 }));
  const page = fixture(rows, 819, { year: 2026 }); page.inject(); page.run();
  const query = page.document.querySelector;
  page.document.querySelector = selector => selector === '.single-question-wrapper .question-card'
    ? { querySelector(tag) { return tag === '.year-tag' ? null : { textContent: '第20题' }; } } : query(selector);
  assert.equal(await page.clickNavigation('next', true), true);
  assert.equal(new URL(page.model.assigned).searchParams.get('questionId'), '820');
  const wrong = fixture(rows, 819, { year: 2026 }); wrong.inject(); wrong.run();
  const originalQuery = wrong.document.querySelector;
  wrong.document.querySelector = selector => selector === '.single-question-wrapper .question-card'
    ? { querySelector(tag) { return { textContent: tag === '.year-tag' ? '2025' : '第20题' }; } } : originalQuery(selector);
  assert.equal(await wrong.clickNavigation('prev'), false);
  assert.equal(wrong.model.assigned, null);
});
