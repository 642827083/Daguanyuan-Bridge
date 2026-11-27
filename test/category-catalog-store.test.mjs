import { withMathSite } from './helpers/math-site.mjs';
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const catalogStoreSource = withMathSite(readFileSync(new URL("../src/DaguanyuanCategoryCatalogStore.js", import.meta.url), "utf8"));
const routesSource = withMathSite(readFileSync(new URL("../src/DaguanyuanCategoryRoutes.js", import.meta.url), "utf8"));
const mainSource = withMathSite(readFileSync(new URL("../src/main.js", import.meta.url), "utf8"));

function runtime(initialFiles = []) {
  const files = new Map(initialFiles);
  const directories = new Set(["/documents"]);
  const manager = {
    fileExistsAtPath(path) {
      return files.has(String(path)) || directories.has(String(path));
    },
    createDirectoryAtPathWithIntermediateDirectoriesAttributes(path) {
      directories.add(String(path));
      return true;
    },
  };
  const context = {
    Application: { sharedInstance() { return { documentPath: "/documents" }; } },
    NSFileManager: { defaultManager() { return manager; } },
    NSData: {
      dataWithContentsOfFile(path) {
        return files.get(String(path));
      },
    },
    NSJSONSerialization: {
      JSONObjectWithDataOptions(data) {
        return JSON.parse(data.text);
      },
      dataWithJSONObjectOptions(value) {
        return {
          text: JSON.stringify(value),
          writeToFileAtomically(path) {
            files.set(String(path), { text: this.text });
            return true;
          },
        };
      },
    },
    Number, String, Array, Object, JSON, Math, RegExp, Date, Error,
    encodeURIComponent, decodeURIComponent, console,
  };
  vm.createContext(context);
  vm.runInContext(catalogStoreSource, context);
  vm.runInContext(routesSource, context);
  return { context, files };
}

function remoteTree() {
  const children = [];
  for (let index = 0; index < 120; index += 1) {
    children.push({ id: 1000 + index, parent_id: 1, name: `分类 ${index}`, children: [] });
  }
  return [{ id: 1, parent_id: 0, name: "数学", children }];
}

test("分类目录优先读取本地更新数据并可让路由立即重载", () => {
  const { context, files } = runtime();
  const store = context.__DAGUANYUAN_CATEGORY_CATALOG_STORE_GLOBAL__;
  const routes = context.__DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__;

  assert.equal(store.metadata().sourceKind, "empty");
  assert.equal(store.metadata().size, 0);
  assert.equal(routes.size, 0);
  assert.equal(routes.resolve(["高等数学"]).status, "unavailable");
  assert.match(routes.resultForCategoryId(1000).message, /下载分类数据/);

  const result = store.replaceWithTree(remoteTree(), "2026-09-21");
  assert.equal(result.catalog.records.length, 121);
  assert.equal(result.changes.added, 121);
  assert.equal(result.changes.removed, 0);
  assert.equal(store.metadata().sourceKind, "local");
  assert.equal(files.has("/documents/DaguanyuanBridge/category-catalog.json"), true);

  routes.reloadFromStore();
  assert.equal(routes.size, 121);
  assert.equal(routes.updatedAt, "2026-09-21");
  assert.equal(routes.resultForCategoryId(1000).status, "resolved");

  store.resetMemoryCache();
  assert.equal(store.metadata().sourceKind, "local");
  assert.equal(store.metadata().size, 121);
});

test("异常分类响应不会覆盖已经可用的本地数据", () => {
  const { context, files } = runtime();
  const store = context.__DAGUANYUAN_CATEGORY_CATALOG_STORE_GLOBAL__;
  store.replaceWithTree(remoteTree(), "2026-09-21");
  const path = "/documents/DaguanyuanBridge/category-catalog.json";
  const saved = files.get(path).text;

  assert.throws(() => store.replaceWithTree([{ id: 9, parent_id: 0, name: "异常", children: [] }], "2026-09-22"), /分类数量异常/);
  assert.equal(files.get(path).text, saved);
  assert.equal(store.metadata().size, 121);
});

test("已有本地数据启动时直接加载，不因日期久远而过期", () => {
  const first = runtime();
  first.context.__DAGUANYUAN_CATEGORY_CATALOG_STORE_GLOBAL__.replaceWithTree(remoteTree(), "2020-01-01");
  const next = runtime(first.files);
  assert.equal(next.context.__DAGUANYUAN_CATEGORY_CATALOG_STORE_GLOBAL__.metadata().sourceKind, "local");
  assert.equal(next.context.__DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.size, 121);
  assert.equal(next.context.__DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.updatedAt, "2020-01-01");
});

test("损坏的本地文件不阻止启动，首次重新下载后可以正常使用", () => {
  const path = "/documents/DaguanyuanBridge/category-catalog.json";
  const { context, files } = runtime([[path, { text: "invalid json" }]]);
  const store = context.__DAGUANYUAN_CATEGORY_CATALOG_STORE_GLOBAL__;
  assert.equal(store.metadata().sourceKind, "empty");
  assert.equal(context.__DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.size, 0);
  assert.equal(files.get(path).text, "invalid json");
  store.replaceWithTree(remoteTree());
  context.__DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.reloadFromStore();
  assert.equal(context.__DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.size, 121);
});

test("首次下载与更新的网络失败均保留原状态，失败后允许重试", () => {
  for (const existing of [false, true]) {
    const { context, files } = runtime();
    const store = context.__DAGUANYUAN_CATEGORY_CATALOG_STORE_GLOBAL__;
    if (existing) store.replaceWithTree(remoteTree(), "2026-09-21");
    const path = store.storagePath();
    const previous = files.get(path)?.text;
    const replies = [];
    Object.assign(context, {
      NSURL: { URLWithString(url) { return url; } },
      NSMutableURLRequest: { requestWithURL() { return { setHTTPMethod() {}, setTimeoutInterval() {}, setAllHTTPHeaderFields() {} }; } },
      NSOperationQueue: { mainQueue() { return {}; } },
      NSURLConnection: { sendAsynchronousRequestQueueCompletionHandler(request, queue, completion) { replies.push(completion); } },
    });
    let error;
    store.fetchLatest(value => { error = value; });
    replies.shift()(null, null, { localizedDescription: "网络不可用" });
    assert.match(error.message, /网络不可用/);
    assert.equal(files.get(path)?.text, previous);
    assert.equal(store.metadata().size, existing ? 121 : 0);
    let downloaded;
    store.fetchLatest((value, result) => { assert.equal(value, null); downloaded = result; });
    const text = JSON.stringify(remoteTree());
    replies.shift()({ statusCode: 200 }, { text, length: text.length }, null);
    assert.equal(downloaded.catalog.records.length, 121);
    assert.equal(store.metadata().sourceKind, "local");
  }
});

test("保存失败不会把尚未持久化的新数据设为当前数据", () => {
  const { context, files } = runtime();
  const store = context.__DAGUANYUAN_CATEGORY_CATALOG_STORE_GLOBAL__;
  context.NSJSONSerialization.dataWithJSONObjectOptions = () => ({ writeToFileAtomically() { return false; } });
  assert.throws(() => store.replaceWithTree(remoteTree()), /保存分类数据失败/);
  assert.equal(store.metadata().size, 0);
  assert.equal(files.has(store.storagePath()), false);
});

test('设置更新分类复用已登录数学网页，持久保存完整目录并在失败时保留旧数据', async () => {
  const { context, files } = runtime();
  const store = context.__DAGUANYUAN_CATEGORY_CATALOG_STORE_GLOBAL__;
  const controller = { webView: {} };
  let fail = false, calls = 0;
  context.__DAGUANYUAN_MATH_API_GLOBAL__ = { async categoryRecords(scope, subject, panel) {
    calls++; assert.equal(scope, 'complete'); assert.equal(subject, 'all'); assert.equal(panel, controller);
    if (fail) throw Error('大观园登录已过期');
    return [[1, 0, '数学']].concat(remoteTree()[0].children.map(node => [node.id, 1, node.name]));
  } };
  context.NSURLConnection = { sendAsynchronousRequestQueueCompletionHandler() { throw Error('禁止绕过网页登录状态请求分类'); } };
  const update = () => new Promise((resolve, reject) => store.fetchLatest((error, result) => error ? reject(error) : resolve(result), controller));
  const result = await update();
  assert.equal(calls, 1); assert.equal(result.catalog.records.length, 121);
  const saved = files.get(store.storagePath()).text;
  fail = true;
  await assert.rejects(update(), /登录已过期/);
  assert.equal(files.get(store.storagePath()).text, saved);
  fail = false;
  assert.equal((await update()).catalog.records.length, 121);
});

test("运行时使用系统网络 API 更新分类且入口加载顺序正确", () => {
  assert.doesNotMatch(mainSource, /JSB\.require\("DaguanyuanCategoryCatalog"\)/);
  assert.match(catalogStoreSource, /NSURLConnection\.sendAsynchronousRequestQueueCompletionHandler/);
  assert.match(catalogStoreSource, /NSJSONSerialization\.JSONObjectWithDataOptions\(data, 1\)/);
  assert.match(catalogStoreSource, /writeToFileAtomically\(storagePath\(\), true\)/);
  assert.doesNotMatch(catalogStoreSource, /\bfetch\s*\(|localStorage|sessionStorage/);
  assert.ok(mainSource.indexOf('JSB.require("DaguanyuanCategoryCatalogStore")') < mainSource.indexOf('JSB.require("DaguanyuanCategoryRoutes")'));
  assert.ok(mainSource.indexOf('JSB.require("DaguanyuanCategoryManagerUI")') < mainSource.indexOf('JSB.require("WebPanelController")'));
});
