import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../src/Daguanyuan408Page.js", import.meta.url), "utf8");
const simpleFormula = vm.runInNewContext("(" + source.slice(source.indexOf("function simpleFormula(formula)"), source.indexOf("async function markdown(html, baseURL)")).trim() + ")");

function span(classes, textContent = "", children = [], style = "") {
  const classList = classes.split(" ");
  classList.contains = name => classList.includes(name);
  return { nodeType: 1, tagName: "SPAN", classList, children, childNodes: children,
    textContent, getAttribute: name => name === "style" ? style : null };
}
function recover(...tokens) {
  return simpleFormula({ querySelector: () => span("katex-html", "", [span("base", "", tokens)]) });
}

test("408 可可靠还原平面 KaTeX 变量、赋值和集合关系", () => {
  assert.equal(recover(span("mord mathnormal", "a"), span("mrel", "="), span("mord", "1")), "a=1");
  assert.equal(recover(span("mord", "12.1")), "12.1");
  assert.equal(recover(span("mord mathnormal", "e"), span("mrel", "∈"), span("mord mathnormal", "E")), "e\\in E");
  assert.equal(recover(span("mspace"), span("strut"), span("mord mathnormal", "G")), "G");
});

test("408 未知公式结构和字体保留图片兜底，避免按文本顺序错误还原", () => {
  assert.equal(recover(span("mord", "", [span("msupsub", "2")])), "");
  assert.equal(recover(span("mord mathbb", "R")), "");
  assert.equal(recover(span("mord", "x", [], "transform:translateY(-10px)")), "");
  assert.equal(recover(span("mord", "α")), "");
  assert.equal(recover(span("mspace", "x")), "");
});

test("408 普通 HTML 源码换行不会把行内公式拆成多行", () => {
  const start = source.indexOf("function convert(node)");
  const convert = vm.runInNewContext("(" + source.slice(start, source.indexOf("var result = Array.from(parsed.body.childNodes)", start)).trim() + ")");
  const text = textContent => ({ nodeType: 3, textContent });
  const formula = span("katex");
  formula.getAttribute = name => name === "data-daguanyuan-import-image" ? "data:image/png;base64,AQID" : null;
  formula.closest = () => null;
  const paragraph = span("", "", [text("若\n"), formula, text("\n无环，则有限。")]);
  paragraph.tagName = "P";
  assert.equal(convert(paragraph).trim(), "若 ![公式](data:image/png;base64,AQID) 无环，则有限。");
  assert.equal(convert(text("x\t\r\n  y\u00a0z")), "x y\u00a0z");
});
