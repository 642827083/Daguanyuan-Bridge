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

test('408 第 42 题数列、省略号、下标和连续大小关系还原为 LaTeX', () => {
  assert.equal(recover(span('mord', '1'), span('mpunct', ','), span('mord', '2'), span('mpunct', ','),
    span('mord', '3'), span('mpunct', ','), span('minner', '…'), span('mpunct', ','), span('mord mathnormal', 'n')),
    '1,2,3,\\ldots ,n');
  assert.equal(recover(span('mord mathnormal', 'i'), span('mrel', '<'), span('mord mathnormal', 'j'),
    span('mrel', '<'), span('mord mathnormal', 'k')), 'i<j<k');
  assert.equal(recover(span('mord mathnormal', 'k'), span('mrel', '>'), span('mord mathnormal', 'j')), 'k>j');
  assert.equal(recover(span('mord', '', [span('mord mathnormal', 'P'), scripts(-2.55, 2.7, span('mord mtight', '1'))]),
    span('mpunct', ','), span('minner', '…'), span('mpunct', ','),
    span('mord', '', [span('mord mathnormal', 'P'), scripts(-2.55, 2.7, span('mord mathnormal mtight', 'n'))])),
    'P_{1},\\ldots ,P_{n}');
});

test("408 第 27 题四条交集与空集条件还原为 LaTeX", () => {
  for (const [left, right] of [['R(Q)', 'W(P)'], ['R(P)', 'R(Q)'], ['W(P)', 'W(Q)'], ['R(P)', 'W(Q)']]) {
    const tokens = text => Array.from(text).map(character => span(/[()]/.test(character) ? 'mopen' : 'mord mathnormal', character));
    assert.equal(recover(...tokens(left), span('mbin', '∩'), ...tokens(right), span('mrel', '='), span('mord amsrm', '∅')),
      left + '\\cap ' + right + '=\\varnothing');
  }
});

test("408 集合运算及包含关系保持语义，未知符号仍交给图片兜底", () => {
  const relations = [
    ['∩', 'cap'], ['∪', 'cup'], ['∅', 'varnothing'],
    ['⊂', 'subset'], ['⊃', 'supset'], ['⊆', 'subseteq'], ['⊇', 'supseteq'],
    ['⊊', 'subsetneq'], ['⊋', 'supsetneq'], ['⊄', 'not\\subset'], ['⊅', 'not\\supset'],
    ['⊈', 'nsubseteq'], ['⊉', 'nsupseteq'], ['∋', 'ni'], ['∌', 'notni'],
  ];
  for (const [symbol, command] of relations) {
    assert.equal(recover(span('mord', 'A'), span('mrel', symbol), span('mord', 'B')), 'A\\' + command + ' B', symbol);
  }
  assert.equal(recover(span('mord', '∅'), span('mrel', '='), span('mopen', '{'), span('mclose', '}')), '\\varnothing =\\{\\}');
  assert.equal(recover(span('mord', 'A'), span('mrel amsrm', '⊊'), span('mord', 'B')), 'A\\subsetneq B');
  assert.equal(recover(span('mord amsrm', 'A')), '');
  assert.equal(recover(span('mord', 'A'), span('mrel', '⊞'), span('mord', 'B')), '');
});

test("408 未知公式结构不能按文本顺序猜测", () => {
  assert.equal(recover(span("mord", "", [span("msupsub", "2")])), "");
  assert.equal(recover(span("mord mathbb", "R")), "");
  assert.equal(recover(span("mord", "x", [], "transform:translateY(-10px)")), "");
  assert.equal(recover(span("mord", "∛")), "");
  assert.equal(recover(span("mspace", "x")), "");
});

function scripts(top, height, content) {
  const node = span('msupsub');
  node.querySelector = () => span('vlist', '', [span('', '', [span('pstrut', '', [], 'height:' + height + 'em'),
    span('sizing reset-size6 size3 mtight', '', [content])], 'top:' + top + 'em')]);
  return node;
}
function underline(content, line = span('underline-line')) {
  const node = span('mord underline', '', []);
  node.children = node.childNodes = [span('vlist-t vlist-t2', '', [span('vlist-r', '', [
    span('vlist', '', [span('', '', [span('pstrut'), line]), span('', '', [span('pstrut'), content])]),
    span('vlist-s', '\u200b'),
  ]), span('vlist-r', '', [span('vlist', '', [span('')])])])];
  return node;
}
test('408 第 43 题下划线填空标记还原为 LaTeX，未知内容仍不猜测', () => {
  for (const number of ['1', '2', '3', '4']) {
    assert.equal(recover(underline(span('mord', '', [span('mspace'), span('mord', number), span('mspace')]))), '\\underline{' + number + '}');
  }
  assert.equal(recover(underline(span('mord', '', [span('mord', 'a'), span('mbin', '+'), span('mord', 'b')]))), '\\underline{a+b}');
  assert.equal(recover(underline(span('mord', '∛'))), '');
  assert.equal(recover(underline(span('mord', '1'), span('unknown-line'))), '');
  assert.equal(recover(underline(span('mord', ''))), '');
});
test('408 幂和下标保持基底分组，未知偏移及孤立上下标不猜测', () => {
  assert.equal(recover(span('mord', '', [span('mord', '2'), scripts(-3.1, 2.7, span('mord mtight', '32'))])), '2^{32}');
  assert.equal(recover(span('mord', '', [span('mord', 'x'), scripts(-2.4, 2.7, span('mord mtight', 'i'))])), 'x_{i}');
  assert.equal(recover(span('mord', '', [span('mord', '', [span('mord', 'a'), span('mbin', '+'), span('mord', 'b')]),
    scripts(-3.1, 2.7, span('mord mtight', '2'))])), '{a+b}^{2}');
  assert.equal(recover(scripts(-3.1, 2.7, span('mord mtight', '2'))), '');
  assert.equal(recover(span('mord', '', [span('mord', '2'), scripts(-2.7, 2.7, span('mord mtight', '32'))])), '');
});

test('408 常用希腊字母和范围符号保留公式语义', () => {
  assert.equal(recover(span('mord mathnormal', 'α'), span('mbin', '+'), span('mord mathnormal', 'β')), '\\alpha +\\beta');
  assert.equal(recover(span('mord', '−'), span('mord', '', [span('mord', '2'), scripts(-3.063, 2.7, span('mord mtight', '20'))]),
    span('mrel', '∼'), span('mord', '', [span('mord', '2'), scripts(-3.063, 2.7, span('mord mtight', '20'))])), '-2^{20}\\sim 2^{20}');
  assert.equal(recover(span('mord', 'Σ'), span('mrel', '='), span('mord', 'π')), '\\Sigma =\\pi');
});

test('408 中文文字下标和转义字符使用 text，不把未知字体当成文字', () => {
  const chinese = span('mord text mtight', '', [span('mord cjk_fallback mtight', '补')]);
  assert.equal(recover(span('mord', '', [span('mord mathnormal', 'x'), scripts(-2.55, 2.7, span('mord mtight', '', [chinese]))]),
    span('mrel', '='), span('mord mathnormal', 'A'), span('mord', '3'), span('mord mathnormal', 'H')), 'x_{\\text{补}}=A3H');
  assert.equal(recover(span('mord text', '', [span('mord cjk_fallback', '补码'), span('mord', ' A_B%')])), '\\text{补码 A\\_B\\%}');
  assert.equal(recover(span('mord text', '', [span('mord mathbb', 'R')])), '');
  assert.equal(recover(span('mord text', '', [span('mfrac', '1/2')])), '');
});

test("408 普通 HTML 源码换行不会把行内公式拆成多行", () => {
  const start = source.indexOf("function convert(node)");
  const convert = vm.runInNewContext("(" + source.slice(start, source.indexOf("var result = Array.from(parsed.body.childNodes)", start)).trim() + ")");
  const text = textContent => ({ nodeType: 3, textContent });
  const formula = span("katex");
  formula.getAttribute = name => name === "data-daguanyuan-import-tex" ? "G" : null;
  formula.querySelector = () => null;
  formula.closest = () => null;
  const paragraph = span("", "", [text("若\n"), formula, text("\n无环，则有限。")]);
  paragraph.tagName = "P";
  assert.equal(convert(paragraph).trim(), "若 $G$ 无环，则有限。");
  assert.equal(convert(text("x\t\r\n  y\u00a0z")), "x y\u00a0z");
  const code = span("", "", [text("int x=1")]); code.tagName = "CODE";
  assert.equal(convert(code), "int x=1", "正文中的变量表达式不应变成红色行内代码");
});
