import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const catalogSource = readFileSync(new URL("../src/DaguanyuanCategoryCatalog.js", import.meta.url), "utf8");
const catalogStoreSource = readFileSync(new URL("../src/DaguanyuanCategoryCatalogStore.js", import.meta.url), "utf8");
const routesSource = readFileSync(new URL("../src/DaguanyuanCategoryRoutes.js", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");

function runtime() {
  const files = new Map();
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
  vm.runInContext(catalogSource, context);
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

  assert.equal(store.metadata().sourceKind, "bundled");
  assert.equal(store.metadata().size, 1061);

  const result = store.replaceWithTree(remoteTree(), "2026-09-21");
  assert.equal(result.catalog.records.length, 121);
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

test("运行时使用系统网络 API 更新分类且入口加载顺序正确", () => {
  assert.match(catalogStoreSource, /NSURLConnection\.sendAsynchronousRequestQueueCompletionHandler/);
  assert.match(catalogStoreSource, /NSJSONSerialization\.JSONObjectWithDataOptions\(data, 1\)/);
  assert.match(catalogStoreSource, /writeToFileAtomically\(storagePath\(\), true\)/);
  assert.doesNotMatch(catalogStoreSource, /\bfetch\s*\(|localStorage|sessionStorage/);
  assert.ok(mainSource.indexOf('JSB.require("DaguanyuanCategoryCatalogStore")') < mainSource.indexOf('JSB.require("DaguanyuanCategoryRoutes")'));
  assert.ok(mainSource.indexOf('JSB.require("DaguanyuanCategoryManagerUI")') < mainSource.indexOf('JSB.require("WebPanelController")'));
});
