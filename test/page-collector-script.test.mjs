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

test("分类导航脚本按祖先题型逐级点击，并跳过源文件中多出的分类", () => {
  const source = readFileSync(new URL("../src/DaguanyuanPageCollector.js", import.meta.url), "utf8");
  const context = {};
  vm.createContext(context);
  vm.runInContext(source, context);
  const collector = context.__DAGUANYUAN_PAGE_COLLECTOR_GLOBAL__;
  let menuOpen = false;
  const clicked = [];
  function item(text, depth) {
    return {
      innerText: text,
      textContent: text,
      getAttribute(name) {
        if (name === "data-category-filter-depth") return String(depth);
        return "";
      },
      querySelector(selector) {
        return selector === "[title]" ? {
          textContent: text,
          getAttribute(name) { return name === "title" ? text : ""; },
        } : null;
      },
      click() { clicked.push(text); },
    };
  }
  const items = [
    item("极限计算", 0),
    item("函数极限", 1),
    item("0", 2),
    item("0", 3),
  ];
  const toggle = {
    getAttribute(name) { return name === "aria-expanded" ? String(menuOpen) : ""; },
    click() { menuOpen = true; },
  };
  const document = {
    querySelector(selector) {
      return selector === 'button[aria-label="切换章节"]' || selector === 'button[aria-haspopup="tree"]' ? toggle : null;
    },
    querySelectorAll(selector) { return selector === '[role="treeitem"]' ? items : []; },
  };
  const webContext = {
    window: { location: { hostname: "cxyonly.fans" } },
    document,
    setTimeout(callback) { callback(); },
    Number,
    String,
    Array,
    Boolean,
    JSON,
  };
  vm.createContext(webContext);
  vm.runInContext(collector.categoryNavigationScript(["不存在的旧分类", "极限计算", "函数极限", "0/0"]), webContext);
  assert.deepEqual(clicked, ["极限计算", "函数极限", "0", "0"]);
});

test("分类导航将无穷比无穷展开为网页的两个连续层级", () => {
  const source = readFileSync(new URL("../src/DaguanyuanPageCollector.js", import.meta.url), "utf8");
  const context = {};
  vm.createContext(context);
  vm.runInContext(source, context);
  const collector = context.__DAGUANYUAN_PAGE_COLLECTOR_GLOBAL__;
  let menuOpen = false;
  const clicked = [];
  function item(text, depth) {
    return {
      innerText: text,
      textContent: text,
      getAttribute(name) { return name === "data-category-filter-depth" ? String(depth) : ""; },
      querySelector(selector) {
        return selector === "[title]" ? { textContent: text, getAttribute(name) { return name === "title" ? text : ""; } } : null;
      },
      click() { clicked.push(text); },
    };
  }
  const items = [item("极限计算", 0), item("函数极限", 1), item("∞", 2), item("∞", 3)];
  const toggle = {
    getAttribute(name) { return name === "aria-expanded" ? String(menuOpen) : ""; },
    click() { menuOpen = true; },
  };
  const webContext = {
    window: { location: { hostname: "cxyonly.fans" } },
    document: {
      querySelector(selector) {
        return selector === 'button[aria-label="切换章节"]' || selector === 'button[aria-haspopup="tree"]' ? toggle : null;
      },
      querySelectorAll(selector) { return selector === '[role="treeitem"]' ? items : []; },
    },
    setTimeout(callback) { callback(); },
    Number,
    String,
    Array,
    Boolean,
    JSON,
  };
  vm.createContext(webContext);
  vm.runInContext(collector.categoryNavigationScript(["极限计算", "函数极限", "∞/∞"]), webContext);
  assert.deepEqual(clicked, ["极限计算", "函数极限", "∞", "∞"]);
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
  vm.runInContext(context.__DAGUANYUAN_PAGE_COLLECTOR_GLOBAL__.prepareCategoryMenuScript(), context);
  const raw = vm.runInContext(context.__DAGUANYUAN_PAGE_COLLECTOR_GLOBAL__.collectionScript(), context);
  vm.runInContext(context.__DAGUANYUAN_PAGE_COLLECTOR_GLOBAL__.restoreCategoryMenuScript(), context);
  assert.deepEqual(JSON.parse(raw).categoryPath, ["函数", "函数性质考察", "有界"]);
  assert.deepEqual(JSON.parse(raw).fullCategoryPath, []);
  assert.equal(menuOpen, false);
});

test("插件可临时展开新版分类菜单后读取路径并恢复页面状态", () => {
  const source = readFileSync(new URL("../src/DaguanyuanPageCollector.js", import.meta.url), "utf8");
  let menuOpen = false;
  const toggle = {
    getAttribute(name) { return name === "aria-expanded" ? String(menuOpen) : ""; },
    click() { menuOpen = !menuOpen; },
  };
  const card = { querySelector() { return null; }, querySelectorAll() { return []; } };
  const context = {
    window: { location: { host: "cxyonly.fans", pathname: "/math/practice/329", search: "?resumeCategoryId=708", href: "https://cxyonly.fans/math/practice/329?resumeCategoryId=708" } },
    document: {
      querySelector(selector) { return selector === 'button[aria-label="切换章节"]' ? toggle : null; },
      querySelectorAll(selector) {
        if (selector === "[data-learning-question-card]") return [card];
        if (selector === '[role="tree"] [role="group"]' && menuOpen) {
          return [
            { querySelector(itemSelector) { return itemSelector === '[role="treeitem"][aria-expanded="true"]' ? { innerText: "极限" } : null; } },
            { querySelector(itemSelector) { return itemSelector === '[role="treeitem"][aria-expanded="true"]' ? { innerText: "极限计算" } : null; } },
            { querySelector(itemSelector) { return itemSelector === '[role="treeitem"][aria-selected="true"]' ? { innerText: "∞➖∞" } : null; } },
          ];
        }
        return [];
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  vm.runInContext(context.__DAGUANYUAN_PAGE_COLLECTOR_GLOBAL__.prepareCategoryMenuScript(), context);
  const raw = vm.runInContext(context.__DAGUANYUAN_PAGE_COLLECTOR_GLOBAL__.collectionScript(), context);
  vm.runInContext(context.__DAGUANYUAN_PAGE_COLLECTOR_GLOBAL__.restoreCategoryMenuScript(), context);

  assert.deepEqual(JSON.parse(raw).categoryPath, ["极限", "极限计算", "∞➖∞"]);
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

  const parsed = JSON.parse(raw);
  assert.equal(parsed.provider, "408os");
  assert.deepEqual(parsed.categoryPath, ["数据结构"]);
  assert.equal(parsed.questions[0].questionId, "1");
  assert.equal(parsed.questions[0].markdown, "打印数据缓冲区的逻辑结构应该是（）。\n\n- A. 栈\n- B. 队列");
  assert.match(parsed.questions[0].html, /border-radius:8px/);
  assert.deepEqual(parsed.questions[0].htmlSize, { width: 960, height: 230 });
});

test("大观园题目固定采集为 Markdown 题卡", () => {
  const script = collectScript();
  const daguanyuanCollector = script.slice(script.indexOf("function collectDaguanyuan"), script.indexOf("function collect408"));
  assert.match(script, /markdown: questionMarkdown\(stem, optionNodes\)/);
  assert.doesNotMatch(daguanyuanCollector, /item\.html = html/);
});

test("408 HTML 题卡不依赖数学 KaTeX 资源", () => {
  const source = readFileSync(new URL("../src/DaguanyuanPageCollector.js", import.meta.url), "utf8");
  const context = {};
  vm.createContext(context);
  vm.runInContext(source, context);
  const script = context.__DAGUANYUAN_PAGE_COLLECTOR_GLOBAL__.collectionScript();
  assert.doesNotMatch(script, /embeddedKatexStylesheet/);
  assert.doesNotMatch(script, /KaTeX_Size/);
  assert.match(script, /return simplifiedQuestionHTML\(stem, questionCard/);
});

test("导入预加载会自动触发加载更多并等待网页资源", () => {
  const source = readFileSync(new URL("../src/DaguanyuanPageCollector.js", import.meta.url), "utf8");
  const context = {};
  vm.createContext(context);
  vm.runInContext(source, context);
  const collector = context.__DAGUANYUAN_PAGE_COLLECTOR_GLOBAL__;
  assert.match(collector.preloadScript(), /加载更多题目/);
  assert.match(collector.preloadScript(), /loading", "eager/);
  assert.match(collector.preloadStatusScript(), /__DAGUANYUAN_IMPORT_PRELOAD_STATE__/);
  assert.match(collector.pageStatusScript(), /importable/);
});

test("数学题卡不再复制 KaTeX HTML 结构", () => {
  const source = readFileSync(new URL("../src/DaguanyuanPageCollector.js", import.meta.url), "utf8");
  const clone = {
    tagName: "DIV",
    attributes: [],
    innerHTML: '<span class="katex"><span class="katex-mathml">重复公式</span><span class="katex-html">可见公式</span></span>',
    setAttribute() {},
    querySelectorAll(selector) {
      if (selector === ".katex-mathml") {
        return [{ remove: () => { this.innerHTML = '<span class="katex"><span class="katex-html">可见公式</span></span>'; } }];
      }
      return [];
    },
  };
  const stem = {
    tagName: "DIV",
    childNodes: [textNode("公式题")],
    querySelectorAll() { return []; },
    cloneNode() { return clone; },
  };
  const questionDocument = {
    getAttribute(name) { return name === "data-question-id" ? "3592" : ""; },
    querySelector(selector) {
      if (selector === ".question-stem") return stem;
      if (selector === ".question-options") return null;
      return null;
    },
    querySelectorAll() { return []; },
  };
  const card = {
    querySelector(selector) {
      if (selector === "[data-question-id]") return questionDocument;
      if (selector === "header [title]") return { getAttribute() { return "2020数一"; } };
      return null;
    },
    querySelectorAll() { return []; },
  };
  const context = {
    window: {
      location: { host: "cxyonly.fans", pathname: "/math/practice/329", search: "?resumeCategoryId=708", href: "https://cxyonly.fans/math/practice/329?resumeCategoryId=708" },
      getComputedStyle() { return { getPropertyValue() { return ""; } }; },
    },
    document: {
      querySelector() { return null; },
      querySelectorAll(selector) { return selector === "[data-learning-question-card]" ? [card] : []; },
    },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  const parsed = JSON.parse(vm.runInContext(context.__DAGUANYUAN_PAGE_COLLECTOR_GLOBAL__.collectionScript(), context));
  assert.equal(parsed.questions[0].html, undefined);
  assert.equal(parsed.questions[0].markdown, "公式题");
});

test("页面采集脚本为 408 已渲染题目保留 HTML 与显示尺寸", () => {
  const source = readFileSync(new URL("../src/DaguanyuanPageCollector.js", import.meta.url), "utf8");
  const clone = {
    tagName: "DIV",
    attributes: [],
    outerHTML: '<div><img src="https://cdn.408os.cn/questions/2.png"></div>',
    querySelectorAll() { return []; },
  };
  const stem = {
    cloneNode() { return clone; },
  };
  const content = {
    tagName: "DIV",
    childNodes: [textNode("按网页排版导入")],
    querySelector(selector) { return selector === ".content" ? stem : null; },
    querySelectorAll() { return []; },
    cloneNode() { return clone; },
  };
  const question = {
    cloneNode() { return clone; },
    querySelector(selector) {
      if (selector === ".question-content") return content;
      if (selector === ".year-tag") return element("SPAN", { textContent: "2011" });
      if (selector === ".index-tag") return element("SPAN", { textContent: "第25题" });
      return null;
    },
    querySelectorAll(selector) { return selector === ".option-card" ? [] : []; },
  };
  const wrapper = {
    scrollWidth: 980,
    scrollHeight: 640,
    getAttribute(name) { return name === "data-question-id" ? "2" : ""; },
    querySelector(selector) { return selector === ".question-card" ? question : null; },
  };
  const context = {
    window: {
      location: { host: "www.408os.cn", pathname: "/exercise", search: "?knowledgeId=1&knowledgeName=%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84" },
      getComputedStyle() { return { getPropertyValue() { return ""; } }; },
    },
    document: {
      querySelector() { return null; },
      querySelectorAll(selector) { return selector === ".question-wrapper[data-question-id]" ? [wrapper] : []; },
    },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  const parsed = JSON.parse(vm.runInContext(context.__DAGUANYUAN_PAGE_COLLECTOR_GLOBAL__.collectionScript(), context));

  assert.match(parsed.questions[0].html, /cdn\.408os\.cn\/questions\/2\.png/);
  assert.deepEqual(parsed.questions[0].htmlSize, { width: 960, height: 220 });
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
