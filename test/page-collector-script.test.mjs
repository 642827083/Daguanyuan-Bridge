import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function collectScript() {
  const source = readFileSync(new URL("../src/DaguanyuanPageCollector.js", import.meta.url), "utf8");
  const context = {};
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.__DAGUANYUAN_PAGE_COLLECTOR_GLOBAL__.collectionScript();
}

test("页面采集脚本可被 WebView 解析", () => {
  const script = collectScript();
  assert.doesNotThrow(() => new Function(script));
});

test("页面采集脚本不依赖 URL 构造器", () => {
  const script = collectScript();
  assert.doesNotMatch(script, /new URL\(/);
});

test("页面采集脚本压缩题干中的异常换行", () => {
  const source = readFileSync(new URL("../src/DaguanyuanPageCollector.js", import.meta.url), "utf8");
  const stem = {
    childNodes: [{ nodeType: 3, nodeValue: "设\n函\n数\nf\n(\nx\n)\n连\n续" }],
  };
  const card = {
    querySelector(selector) {
      if (selector === "[data-question-id]") {
        return {
          getAttribute() { return "3592"; },
          querySelector(questionSelector) {
            return questionSelector === ".question-stem" ? stem : null;
          },
        };
      }
      if (selector === "header [title]") return { getAttribute() { return "2002数二"; } };
      return null;
    },
    querySelectorAll() { return [{ textContent: "f(x)" }]; },
  };
  const context = {
    window: { location: { host: "cxyonly.fans", pathname: "/math/practice/329", search: "?resumeCategoryId=708", href: "https://cxyonly.fans/math/practice/329?resumeCategoryId=708" } },
    document: {
      querySelector() { return null; },
      querySelectorAll() { return [card]; },
    },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  const raw = vm.runInContext(context.__DAGUANYUAN_PAGE_COLLECTOR_GLOBAL__.collectionScript(), context);
  assert.equal(JSON.parse(raw).questions[0].markdown, "设函数 f(x) 连续");
  assert.equal(JSON.parse(raw).questions[0].url,
    "https://cxyonly.fans/math/practice/329?resumeCategoryId=708&questionId=3592");
});

test("页面采集脚本读取当前三级章节路径", () => {
  const source = readFileSync(new URL("../src/DaguanyuanPageCollector.js", import.meta.url), "utf8");
  let menuOpen = false;
  const toggle = {
    getAttribute(name) { return name === "aria-expanded" ? String(menuOpen) : ""; },
    click() { menuOpen = !menuOpen; },
  };
  const card = {
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  const context = {
    window: { location: { host: "cxyonly.fans", pathname: "/math/practice/329", search: "?resumeCategoryId=708", href: "https://cxyonly.fans/math/practice/329?resumeCategoryId=708" } },
    document: {
      querySelector(selector) { return selector === 'button[aria-label="切换章节"]' ? toggle : null; },
      querySelectorAll(selector) {
        if (selector === '[data-learning-question-card]') return [card];
        if (selector === '[role="tree"] [role="group"]' && menuOpen) {
          return [
            { querySelector(itemSelector) { return itemSelector === '[role="treeitem"][aria-expanded="true"]' ? { innerText: "函数" } : null; } },
            { querySelector(itemSelector) { return itemSelector === '[role="treeitem"][aria-expanded="true"]' ? { innerText: "函数性质考察" } : null; } },
            { querySelector(itemSelector) { return itemSelector === '[role="treeitem"][aria-selected="true"]' ? { innerText: "有界" } : null; } },
          ];
        }
        return [];
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  const raw = vm.runInContext(context.__DAGUANYUAN_PAGE_COLLECTOR_GLOBAL__.collectionScript(), context);
  assert.deepEqual(JSON.parse(raw).categoryPath, ["函数", "函数性质考察", "有界"]);
  assert.equal(menuOpen, false);
});

function textNode(value) {
  return { nodeType: 3, nodeValue: value };
}

function element(tagName, options) {
  const config = options || {};
  return {
    nodeType: 1,
    tagName,
    className: config.className || "",
    children: config.children || [],
    childNodes: config.childNodes || config.children || [],
    textContent: config.textContent || "",
    getAttribute(name) { return config.attributes && config.attributes[name] || ""; },
    querySelector(selector) { return config.querySelector && config.querySelector(selector) || null; },
    querySelectorAll(selector) { return config.querySelectorAll && config.querySelectorAll(selector) || []; },
  };
}

test("页面采集脚本将题干、公式和选项转换为 Markdown", () => {
  const source = readFileSync(new URL("../src/DaguanyuanPageCollector.js", import.meta.url), "utf8");
  const formula = element("SPAN", {
    className: "katex-display",
    querySelector(selector) {
      return selector === 'annotation[encoding="application/x-tex"]'
        ? { textContent: "f(x)=\\frac{|x|\\sin(x-2)}{x(x-1)(x-2)^2}" }
        : null;
    },
  });
  const optionFormula = element("SPAN", {
    className: "katex",
    querySelector(selector) {
      return selector === 'annotation[encoding="application/x-tex"]'
        ? { textContent: "(-1,0)" }
        : null;
    },
  });
  const stem = element("DIV", {
    className: "question-stem",
    children: [
      element("P", { childNodes: [textNode("函数")] }),
      formula,
      element("P", { childNodes: [textNode("在下列哪个区间内有界（）。")] }),
    ],
  });
  const optionContent = element("DIV", { className: "question-option-content", children: [optionFormula] });
  const option = element("LI", {
    querySelector(selector) {
      if (selector === ".question-option-label") return element("SPAN", { textContent: "A" });
      if (selector === ".question-option-content") return optionContent;
      return null;
    },
  });
  const options = element("OL", { className: "question-options", children: [option] });
  const questionDocument = element("DIV", {
    attributes: { "data-question-id": "3393" },
    getAttribute(name) { return name === "data-question-id" ? "3393" : ""; },
    querySelector(selector) {
      if (selector === ".question-stem") return stem;
      if (selector === ".question-options") return options;
      return null;
    },
  });
  const card = {
    querySelector(selector) {
      if (selector === "[data-question-id]") return questionDocument;
      if (selector === "header [title]") return { getAttribute() { return "2004数三"; } };
      return null;
    },
    querySelectorAll() { return []; },
  };
  const context = {
    window: { location: { host: "cxyonly.fans", pathname: "/math/practice/321", search: "?resumeCategoryId=346", href: "https://cxyonly.fans/math/practice/321?resumeCategoryId=346" } },
    document: {
      querySelector() { return null; },
      querySelectorAll(selector) { return selector === "[data-learning-question-card]" ? [card] : []; },
    },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  const raw = vm.runInContext(context.__DAGUANYUAN_PAGE_COLLECTOR_GLOBAL__.collectionScript(), context);

  assert.equal(JSON.parse(raw).questions[0].markdown, [
    "函数",
    "$$\nf(x)=\\frac{|x|\\sin(x-2)}{x(x-1)(x-2)^2}\n$$",
    "在下列哪个区间内有界（）。",
    "- A. $(-1,0)$",
  ].join("\n\n"));
});

test("页面采集脚本读取 408 当前知识点的题干和选项", () => {
  const source = readFileSync(new URL("../src/DaguanyuanPageCollector.js", import.meta.url), "utf8");
  const questionContent = element("DIV", {
    className: "question-content",
    querySelector(selector) {
      return selector === ".content" ? element("DIV", {
        className: "content",
        children: [element("P", { childNodes: [textNode("打印数据缓冲区的逻辑结构应该是（）。")] })],
      }) : null;
    },
  });
  const option = function (label, value) {
    return element("DIV", {
      className: "option-card",
      querySelector(selector) {
        if (selector === ".option-label") return element("SPAN", { textContent: label });
        if (selector === ".option-content") return element("DIV", { childNodes: [textNode(value)] });
        return null;
      },
    });
  };
  const question = element("DIV", {
    className: "question-card",
    querySelector(selector) {
      if (selector === ".question-content") return questionContent;
      if (selector === ".year-tag") return element("SPAN", { textContent: "2009" });
      if (selector === ".index-tag") return element("SPAN", { textContent: "第1题" });
      return null;
    },
    querySelectorAll(selector) {
      return selector === ".option-card" ? [option("A", "栈"), option("B", "队列")] : [];
    },
  });
  const wrapper = element("DIV", {
    attributes: { "data-question-id": "1" },
    querySelector(selector) { return selector === ".question-card" ? question : null; },
  });
  const context = {
    window: { location: { host: "www.408os.cn", pathname: "/exercise", search: "?knowledgeId=1&knowledgeName=%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84", href: "https://www.408os.cn/exercise?knowledgeId=1&knowledgeName=%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84" } },
    document: {
      querySelector() { return null; },
      querySelectorAll(selector) { return selector === ".question-wrapper[data-question-id]" ? [wrapper] : []; },
    },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  const raw = vm.runInContext(context.__DAGUANYUAN_PAGE_COLLECTOR_GLOBAL__.collectionScript(), context);

  assert.deepEqual(JSON.parse(raw), {
    provider: "408os",
    categoryId: "1",
    categoryPath: ["数据结构"],
    unavailableQuestionCount: 0,
    questions: [{
      questionId: "1",
      source: "2009 第1题",
      markdown: "打印数据缓冲区的逻辑结构应该是（）。\n\n- A. 栈\n- B. 队列",
    }],
  });
});

test("页面采集脚本将 408 双重编码知识点归入对应学科", () => {
  const source = readFileSync(new URL("../src/DaguanyuanPageCollector.js", import.meta.url), "utf8");
  const context = {
    window: {
      location: {
        host: "www.408os.cn",
        pathname: "/exercise",
        search: "?knowledgeId=2&knowledgeName=%25E7%25AE%2597%25E6%25B3%2595",
      },
    },
    document: {
      querySelector() { return null; },
      querySelectorAll() { return []; },
    },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  const raw = vm.runInContext(context.__DAGUANYUAN_PAGE_COLLECTOR_GLOBAL__.collectionScript(), context);

  assert.deepEqual(JSON.parse(raw).categoryPath, ["数据结构", "算法"]);
});

test("页面采集脚本跳过 408 尚未渲染正文的题目", () => {
  const source = readFileSync(new URL("../src/DaguanyuanPageCollector.js", import.meta.url), "utf8");
  const question = element("DIV", {
    className: "question-card",
    querySelector(selector) {
      if (selector === ".question-content") return element("DIV", { className: "question-content" });
      if (selector === ".year-tag") return element("SPAN", { textContent: "2019" });
      if (selector === ".index-tag") return element("SPAN", { textContent: "第41题" });
      return null;
    },
    querySelectorAll() { return []; },
  });
  const wrapper = element("DIV", {
    attributes: { "data-question-id": "511" },
    querySelector(selector) { return selector === ".question-card" ? question : null; },
  });
  const context = {
    window: { location: { host: "www.408os.cn", pathname: "/exercise", search: "?knowledgeId=1&knowledgeName=%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84" } },
    document: {
      querySelector() { return null; },
      querySelectorAll(selector) { return selector === ".question-wrapper[data-question-id]" ? [wrapper] : []; },
    },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  const raw = vm.runInContext(context.__DAGUANYUAN_PAGE_COLLECTOR_GLOBAL__.collectionScript(), context);

  assert.deepEqual(JSON.parse(raw).questions, []);
  assert.equal(JSON.parse(raw).unavailableQuestionCount, 1);
});

test("页面采集脚本保留题干中的网页图片", () => {
  const source = readFileSync(new URL("../src/DaguanyuanPageCollector.js", import.meta.url), "utf8");
  const questionContent = element("DIV", {
    className: "question-content",
    querySelector(selector) {
      return selector === ".content" ? element("DIV", {
        className: "content",
        children: [element("IMG", {
          attributes: { src: "https://cdn.408os.cn/questions/1.png", alt: "题图" },
        })],
      }) : null;
    },
  });
  const question = element("DIV", {
    className: "question-card",
    querySelector(selector) { return selector === ".question-content" ? questionContent : null; },
    querySelectorAll() { return []; },
  });
  const wrapper = element("DIV", {
    attributes: { "data-question-id": "1" },
    querySelector(selector) { return selector === ".question-card" ? question : null; },
  });
  const context = {
    window: { location: { host: "www.408os.cn", pathname: "/exercise", search: "?knowledgeId=1&knowledgeName=%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84" } },
    document: {
      querySelector() { return null; },
      querySelectorAll(selector) { return selector === ".question-wrapper[data-question-id]" ? [wrapper] : []; },
    },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  const raw = vm.runInContext(context.__DAGUANYUAN_PAGE_COLLECTOR_GLOBAL__.collectionScript(), context);

  assert.equal(JSON.parse(raw).questions[0].markdown, "![题图](https://cdn.408os.cn/questions/1.png)");
});
