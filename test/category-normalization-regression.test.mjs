import { withMathSite } from './helpers/math-site.mjs';
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const catalogFixture = JSON.parse(withMathSite(readFileSync(new URL("./fixtures/math-category-catalog.json", import.meta.url), "utf8")));
const routesSource = withMathSite(readFileSync(new URL("../src/DaguanyuanCategoryRoutes.js", import.meta.url), "utf8"));

function routesRuntime() {
  const context = { Number, String, Array, Object, JSON, Math, RegExp, console };
  vm.createContext(context);
  vm.runInContext(routesSource, context);
  context.__DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.replaceCatalog(catalogFixture);
  return context.__DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__;
}

test("普通文本与网站 LaTeX 名称不同，保留为未匹配并交给用户处理", () => {
  const routes = routesRuntime();
  const plain = routes.resolve(["高等数学", "极限", "极限计算", "函数极限", "0/0"]);
  const website = routes.resolve(["高等数学", "极限", "极限计算", "函数极限", "$\\frac{0}{0}$ 型"]);
  assert.equal(plain.status, "missing");
  assert.equal(website.status, "resolved");
  assert.equal(website.categoryId, 704);
});
