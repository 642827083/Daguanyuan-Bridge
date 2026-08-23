# Daguanyuan Bridge MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a MarginNote 4 plugin that opens the user's Daguanyuan practice page and imports its currently visible questions into a classified MarginNote mind-map branch.

**Architecture:** A local WebView shell loads the selected Daguanyuan practice URL. An injected, page-local collector reads only visible question cards and sends a normalized payload through the established web bridge. JavaScriptCore validates the payload and creates or reuses a root/category node, then creates deduplicated question notes under it within one undo group.

**Tech Stack:** MarginNote 4 JavaScriptCore, JSB, UIKit/MNUWebView, WebView JavaScript, NSUserDefaults, Node.js built-in test runner, mnaddon ZIP packaging.

---

### Task 1: Define and test the page-payload contract

**Files:**
- Create: `D:\WorkSpace\MN\daguanyuan-bridge\test\practice-parser.test.mjs`
- Create: `D:\WorkSpace\MN\daguanyuan-bridge\web\src\domain\practiceParser.mjs`

- [ ] **Step 1: Write the failing tests for question ID extraction, TeX preservation, and category fallback**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { normalizePracticePayload } from "../web/src/domain/practiceParser.mjs";

test("normalizes visible question cards with TeX and stable IDs", () => {
  const payload = normalizePracticePayload({
    practiceId: "329",
    categoryId: "708",
    categoryName: "",
    url: "https://cxyonly.fans/math/practice/329?resumeCategoryId=708",
    questions: [{
      questionId: "3579",
      source: "1990数三",
      stemText: "求极限",
      tex: "\\\\displaystyle\\\\lim_{n\\\\to\\\\infty}x_n",
    }],
  });

  assert.equal(payload.categoryTitle, "分类 708");
  assert.deepEqual(payload.questions[0], {
    questionId: "3579",
    source: "1990数三",
    stemText: "求极限",
    tex: "\\\\displaystyle\\\\lim_{n\\\\to\\\\infty}x_n",
    url: "https://cxyonly.fans/math/questions/3579",
  });
});

test("rejects duplicate or invalid question IDs", () => {
  assert.throws(() => normalizePracticePayload({
    practiceId: "329", categoryId: "708", url: "https://cxyonly.fans/math/practice/329",
    questions: [{ questionId: "3579" }, { questionId: "3579" }],
  }), /题目 ID/);
});
```

- [ ] **Step 2: Run the test and verify it fails because the parser module does not exist**

Run: `node --test test/practice-parser.test.mjs`

Expected: `ERR_MODULE_NOT_FOUND` for `practiceParser.mjs`.

- [ ] **Step 3: Implement the smallest normalizer that validates IDs, assigns the category fallback, and constructs canonical question URLs**

```js
const SITE_ROOT = "https://cxyonly.fans";

export function normalizePracticePayload(input) {
  const categoryId = String(input && input.categoryId || "").trim();
  const practiceId = String(input && input.practiceId || "").trim();
  if (!practiceId || !categoryId) throw new Error("缺少练习分类信息");
  const seen = new Set();
  const questions = (Array.isArray(input.questions) ? input.questions : []).map((item) => {
    const questionId = String(item && item.questionId || "").trim();
    if (!/^\\d+$/.test(questionId) || seen.has(questionId)) throw new Error("题目 ID 无效或重复");
    seen.add(questionId);
    return {
      questionId,
      source: String(item.source || "").trim(),
      stemText: String(item.stemText || "").trim(),
      tex: String(item.tex || "").trim(),
      url: `${SITE_ROOT}/math/questions/${questionId}`,
    };
  });
  if (!questions.length) throw new Error("当前页面没有可导入题目");
  const categoryName = String(input.categoryName || "").trim();
  return {
    practiceId,
    categoryId,
    categoryTitle: categoryName || `分类 ${categoryId}`,
    sourceUrl: String(input.url || "").trim(),
    questions,
  };
}
```

- [ ] **Step 4: Run the parser tests and verify they pass**

Run: `node --test test/practice-parser.test.mjs`

Expected: `2 passing`.

### Task 2: Implement the visible-page collector and bridge request

**Files:**
- Create: `D:\WorkSpace\MN\daguanyuan-bridge\web\src\site\practiceCollector.js`
- Create: `D:\WorkSpace\MN\daguanyuan-bridge\web\src\App.jsx`
- Create: `D:\WorkSpace\MN\daguanyuan-bridge\web\src\lib\mnBridge.js`
- Create: `D:\WorkSpace\MN\daguanyuan-bridge\web\src\main.jsx`
- Create: `D:\WorkSpace\MN\daguanyuan-bridge\web\index.html`

- [ ] **Step 1: Write a failing test for an HTML-like question-card collector**

```js
test("collects the data-question-id and MathML TeX annotation", () => {
  const result = collectPracticeCards(fakeDocument);
  assert.equal(result.questions[0].questionId, "3579");
  assert.equal(result.questions[0].tex, "\\\\displaystyle x");
});
```

- [ ] **Step 2: Run the test and verify it fails because `collectPracticeCards` is unavailable**

Run: `node --test test/practice-collector.test.mjs`

Expected: import failure for `practiceCollector.js`.

- [ ] **Step 3: Implement the collector without clicking any Daguanyuan page control**

```js
export function collectPracticeCards(doc, location) {
  const params = new URL(location.href).searchParams;
  const practiceId = location.pathname.split("/").filter(Boolean).pop();
  const categoryId = params.get("resumeCategoryId") || "";
  const questions = Array.from(doc.querySelectorAll("[data-learning-question-card]"))
    .map((card) => {
      const documentNode = card.querySelector("[data-question-id]");
      const annotation = card.querySelector('annotation[encoding="application/x-tex"]');
      return {
        questionId: documentNode && documentNode.getAttribute("data-question-id"),
        source: card.querySelector("[title]")?.getAttribute("title") || "",
        stemText: documentNode?.innerText || "",
        tex: annotation?.textContent || "",
      };
    }).filter((item) => item.questionId);
  return { practiceId, categoryId, categoryName: "", url: location.href, questions };
}
```

- [ ] **Step 4: Add a local import button that sends only this collected payload through `MNBridge.send("importCurrentPractice", payload)`**

```js
async function importCurrentPractice() {
  const payload = collectPracticeCards(document, window.location);
  const result = await MNBridge.send("importCurrentPractice", payload);
  setStatus(`已导入 ${result.createdCount} 题，跳过 ${result.skippedCount} 题`);
}
```

- [ ] **Step 5: Run the parser and collector tests**

Run: `node --test test/practice-parser.test.mjs test/practice-collector.test.mjs`

Expected: all tests pass.

### Task 3: Add the MarginNote importer with idempotent parent/child creation

**Files:**
- Create: `D:\WorkSpace\MN\daguanyuan-bridge\src\DaguanyuanImport.js`
- Create: `D:\WorkSpace\MN\daguanyuan-bridge\src\WebBridgeCommands.js`
- Create: `D:\WorkSpace\MN\daguanyuan-bridge\test\import-contract.test.mjs`

- [ ] **Step 1: Write contract tests that require one undo group, `Note.createWithTitleNotebookDocument`, `addChild`, a hidden stable question marker, and `refreshAfterDBChanged`**

```js
test("native importer creates category children and skips known question IDs", () => {
  assert.match(source, /UndoManager\.sharedInstance\(\)\.undoGrouping/);
  assert.match(source, /Note\.createWithTitleNotebookDocument/);
  assert.match(source, /addChild\(/);
  assert.match(source, /DAGUANYUAN_QUESTION_ID:/);
  assert.match(source, /refreshAfterDBChanged/);
});
```

- [ ] **Step 2: Run the contract test and verify it fails because the importer is absent**

Run: `node --test test/import-contract.test.mjs`

Expected: `ENOENT` for `src/DaguanyuanImport.js`.

- [ ] **Step 3: Implement native importing in a single `UndoManager.undoGrouping` call**

```js
function importCurrentPractice(addon, payload) {
  const context = currentNotebookContext(addon);
  const category = findOrCreateCategory(context, payload.categoryTitle, payload.categoryId);
  const result = { createdCount: 0, skippedCount: 0 };
  UndoManager.sharedInstance().undoGrouping("导入大观园练习题", context.topicId, function () {
    payload.questions.forEach(function (question) {
      if (findQuestionByMarker(category, question.questionId)) {
        result.skippedCount += 1;
        return;
      }
      const note = Note.createWithTitleNotebookDocument(questionTitle(question), context.notebook, context.document);
      note.appendMarkdownComment(questionBody(question));
      category.addChild(note);
      result.createdCount += 1;
    });
  });
  Application.sharedInstance().refreshAfterDBChanged(context.topicId);
  return result;
}
```

- [ ] **Step 4: Expose only the `importCurrentPractice` bridge command and validate the input before native calls**

```js
function importCurrentPractice(context, payload) {
  const normalized = __DAGUANYUAN_PRACTICE_IMPORT_GLOBAL__.validatePayload(payload);
  return __DAGUANYUAN_PRACTICE_IMPORT_GLOBAL__.importCurrentPractice(context.addon, normalized);
}
```

- [ ] **Step 5: Run all Node tests**

Run: `node --test test/*.test.mjs`

Expected: all tests pass.

### Task 4: Add the native panel, package configuration, and test build

**Files:**
- Create: `D:\WorkSpace\MN\daguanyuan-bridge\src\main.js`
- Create: `D:\WorkSpace\MN\daguanyuan-bridge\src\WebPanelController.js`
- Create: `D:\WorkSpace\MN\daguanyuan-bridge\src\WebAddon.js`
- Create: `D:\WorkSpace\MN\daguanyuan-bridge\src\mnaddon.json`
- Create: `D:\WorkSpace\MN\daguanyuan-bridge\package.json`
- Create: `D:\WorkSpace\MN\daguanyuan-bridge\scripts\build-test.js`
- Create: `D:\WorkSpace\MN\daguanyuan-bridge\README.md`

- [ ] **Step 1: Write a packaging contract test**

```js
test("test build uses the fixed Daguanyuan Bridge Test.mnaddon filename", () => {
  assert.match(packageJson, /Daguanyuan Bridge Test\\.mnaddon/);
  assert.doesNotMatch(packageJson, /version:patch/);
});
```

- [ ] **Step 2: Run the test and verify it fails before package configuration exists**

Run: `node --test test/package-contract.test.mjs`

Expected: `ENOENT` for `package.json`.

- [ ] **Step 3: Implement a local WebView shell that allows the user to navigate to Daguanyuan and invokes the collector only through an explicit Import button**

```js
JSB.newAddon = function (mainPath) {
  return createDaguanyuanWebAddon(mainPath);
};
```

The controller must load the local panel first. The panel opens the target practice URL only after the user presses its login/open button; no Cookie extraction, session serialization, background navigation, or automatic website state changes are permitted.

- [ ] **Step 4: Implement the test-only build script and preserve version `0.1.0` in `package.json`, `package-lock.json`, and `src/mnaddon.json`**

```js
// package.json
{
  "scripts": {
    "test": "node --test test/*.test.mjs",
    "build": "node scripts/build-test.js"
  },
  "mnaddonFileName": "Daguanyuan Bridge Test"
}
```

- [ ] **Step 5: Run the complete test suite and build the test package**

Run: `npm test`

Expected: all tests pass.

Run: `npm run build`

Expected: `Daguanyuan Bridge Test.mnaddon` is created or replaced; no versioned release package is written.

- [ ] **Step 6: Manually review all JavaScript files for JavaScriptCore restrictions and run a MarginNote device smoke test**

Verify: launch panel, log in by QR code, open a practice page, invoke explicit import, inspect category/children, run import again and verify the second result reports all questions skipped, then use MarginNote undo to remove the first import.

