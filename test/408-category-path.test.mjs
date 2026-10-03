import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/Daguanyuan408Page.js', import.meta.url), 'utf8');
const tree = [{ id: 46, name: '计算机组成原理', children: [{ id: 50, name: '数据的机器表示', children: [
  { id: 53, name: '数据类型转换' }, { id: 54, name: '数据的大小端和对齐存储' },
] }] }];

async function listing(query, options = {}) {
  const imports = [];
  const requests = [];
  const question = { question: { id: 9001, year: 2026, questionIndex: 1 } };
  const entryURL = 'https://www.408os.cn/assets/index-test.js';
  const request = { async get(url, config) {
    requests.push({ url, params: config.params });
    if (url.includes('/collection/')) return options.collectionResponse ? options.collectionResponse(config.params.pageNum)
      : { data: { rows: [question], total: 1 } };
    if (url.includes('by-knowledge')) return options.knowledgeResponse ? options.knowledgeResponse(config.params.pageNum)
      : { rows: [question], total: 1 };
    return [question];
  } };
  const location = { href: 'https://www.408os.cn/exercise?' + query };
  const context = { console, URL, Map, Set, document: { querySelector() { return { src: entryURL }; } },
    window: { location, setTimeout, clearTimeout, async fetch() { return {
      ok: true, async text() { return options.missingModule ? '' : (options.helperFirst ? 'import{a}from"./knowledge-helper.js";' : '') + 'import{k}from"./knowledge-test.js";'; },
    }; } },
    Function() { return async url => {
      imports.push(url);
      if (url === entryURL) return { r: request };
      if (url.endsWith('/knowledge-helper.js')) return { a() {} };
      if (url.endsWith('/knowledge-test.js')) return { k: options.tree || tree };
      throw new Error('意外模块：' + url);
    }; },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  const receiver = context.__DAGUANYUAN_408_PAGE_GLOBAL__;
  const target = options.single ? { provider: '408', year: 2026, number: 1, url: location.href } : undefined;
  assert.equal(vm.runInContext(receiver.pageScript('category-path', target), context), 'true');
  const state = context.window.__DAGUANYUAN_408_IMPORT_PAGE__;
  for (let attempt = 0; attempt < 20 && !state.ready && !state.error; attempt++) {
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.ok(state.ready || state.error, '分类读取必须完成');
  return { payload: state.ready ? JSON.parse(state.payload) : null, error: state.error, imports, requests };
}

test('408 按知识点 ID 读取完整目录，名称缺失或旧名称也不影响层级', async () => {
  for (const query of ['knowledgeId=53', 'knowledgeId=53&knowledgeName=旧名称']) {
    const result = await listing(query);
    assert.equal(result.error, '');
    assert.deepEqual(result.payload.category.path, ['计算机组成原理', '数据的机器表示', '数据类型转换']);
    assert.equal(result.payload.category.title, '数据类型转换');
  }
});

test('408 知识点导入每一页保留只有真题的范围，保存来源也包含该范围', async () => {
  const result = await listing('knowledgeId=53&sourcePage=overview', { knowledgeResponse(page) {
    return { rows: [{ question: { id: 9000 + page, year: 2026, questionIndex: page } }], total: 2 };
  } });
  assert.equal(result.error, '');
  assert.deepEqual(result.payload.ids, [9001, 9002]);
  assert.equal(new URL(result.payload.category.url).searchParams.get('sourcePage'), 'overview');
  const pages = result.requests.filter(request => request.url.includes('by-knowledge'));
  assert.deepEqual(pages.map(request => request.params.pageNum), [1, 2]);
  assert.ok(pages.every(request => request.params.sourcePage === 'overview'));
});

test('408 不会与不熟题本按集合分页查询当前题目，年份参数不改变数据来源', async () => {
  for (const query of ['mode=collection&collectionId=4&collectionName=不会题本', 'mode=collection&collectionId=8&collectionName=不熟题本&year=2025']) {
    const result = await listing(query, { single: true, collectionResponse(page) {
      return { rows: page === 1 ? [{ question: { id: 8001, year: 2024, questionIndex: 1 } }]
        : [{ question: { id: 9001, year: 2026, questionIndex: 1 } }], total: 2 };
    } });
    assert.equal(result.error, ''); assert.deepEqual(result.payload.ids, [9001]);
    assert.equal(result.requests.length, 2); assert.equal(result.requests[1].params.pageNum, 2);
    assert.equal(result.requests[0].url, '/api/zt/collection/question/list-with-details');
    assert.equal(result.requests[0].params.sortType, 'COLLECT_TIME_DESC');
  }
  const wrapped = await listing('mode=collection&collectionId=4', { single: true });
  assert.equal(wrapped.error, ''); assert.deepEqual(wrapped.payload.ids, [9001]);
});

test('408 题本不接受整类导入，单题不存在或同年同题号重复时明确失败', async () => {
  await assert.rejects(listing('mode=collection&collectionId=4&year=2026'), /知识点分类或年份/);
  for (const rows of [[{ question: { id: 9001, year: 2025, questionIndex: 1 } }],
    [{ question: { id: 9001, year: 2026, questionIndex: 1 } }, { question: { id: 9002, year: 2026, questionIndex: 1 } }]]) {
    const result = await listing('mode=collection&collectionId=4', { single: true, collectionResponse() { return { rows, total: rows.length }; } });
    assert.equal(result.payload, null); assert.match(result.error, /无法唯一确定/);
  }
});

test('408 上级分类保留自身与全部祖先，年份导入不读取知识点模块', async () => {
  const parent = await listing('knowledgeId=50');
  assert.deepEqual(parent.payload.category.path, ['计算机组成原理', '数据的机器表示']);
  const year = await listing('year=2026');
  assert.equal(year.payload.category.title, '2026年真题');
  assert.equal(year.imports.length, 1);
});

test('408 知识点请求模块与目录模块同时存在时，读取真正的目录树', async () => {
  const result = await listing('knowledgeId=53', { helperFirst: true });
  assert.equal(result.error, '');
  assert.deepEqual(result.payload.category.path, ['计算机组成原理', '数据的机器表示', '数据类型转换']);
});

test('408 分类模块缺失、ID 未找到或重名 ID 时明确报错，避免导入错误层级', async () => {
  const results = [await listing('knowledgeId=53', { missingModule: true }),
    await listing('knowledgeId=999'), await listing('knowledgeId=53', { tree: tree.concat(tree) })];
  for (const result of results) {
    assert.equal(result.payload, null);
    assert.match(result.error, /分类|目录|知识点/);
  }
});
