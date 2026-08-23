# Category Tree Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import Daguanyuan questions under the visible study path `高等数学 → （一）极限 → 函数 → 函数性质考察 → 有界`, then migrate the existing numeric category node when the user reimports.

**Architecture:** The injected WebView collector returns an ordered `categoryPath` alongside the existing numeric category ID and questions. The JavaScriptCore importer validates non-empty path labels, creates or reuses each path node below `Daguanyuan Bridge`, and uses the final leaf for questions. A legacy `分类 {categoryId}` node is renamed and reparented to that final leaf position before duplicate detection.

**Tech Stack:** MarginNote 4 JavaScriptCore, UIWebView-injected JavaScript, Node.js built-in test runner.

---

### Task 1: Extend the payload contract with an ordered category path

**Files:**
- Modify: `D:\WorkSpace\MN\daguanyuan-bridge\test\page-collector-script.test.mjs`
- Modify: `D:\WorkSpace\MN\daguanyuan-bridge\src\DaguanyuanPageCollector.js`

- [ ] **Step 1: Write a failing collector test**

```js
assert.deepEqual(JSON.parse(raw).categoryPath, [
  "高等数学", "（一）极限", "函数", "函数性质考察", "有界",
]);
```

- [ ] **Step 2: Verify the test fails because the collector does not return `categoryPath`**

Run: `node --test test/page-collector-script.test.mjs`

Expected: failure showing `undefined` rather than the five labels.

- [ ] **Step 3: Implement the smallest collector extension**

```js
function categoryLabels() {
  return Array.prototype.slice.call(
    document.querySelectorAll("[data-category-path] [data-category-label]")
  ).map(function (node) { return text(node); }).filter(Boolean);
}
```

The implementation will use the real active-menu selectors discovered from the practice page, return only labels, and fall back to `[]` if the path is unavailable.

- [ ] **Step 4: Re-run the collector test**

Run: `node --test test/page-collector-script.test.mjs`

Expected: all collector tests pass.

### Task 2: Create and migrate the full category tree

**Files:**
- Modify: `D:\WorkSpace\MN\daguanyuan-bridge\test\compact-card-import.test.mjs`
- Modify: `D:\WorkSpace\MN\daguanyuan-bridge\src\DaguanyuanImport.js`

- [ ] **Step 1: Write a failing importer test for the complete path and legacy node migration**

```js
assert.deepEqual(treeTitles(root), [
  "高等数学", "（一）极限", "函数", "函数性质考察", "有界", "题目 3592｜2004数三",
]);
assert.equal(result.migratedCategoryCount, 1);
```

- [ ] **Step 2: Verify it fails because the importer creates only one `分类 {id}` node**

Run: `node --test test/compact-card-import.test.mjs`

Expected: tree assertion mismatch.

- [ ] **Step 3: Implement path validation and path-node creation**

```js
function findOrCreatePath(root, categoryPath, context) {
  return categoryPath.reduce(function (parent, title) {
    const child = findChildByTitle(parent, title);
    if (child) return child;
    const created = createNote(title, context);
    parent.addChild(created);
    return created;
  }, root);
}
```

The legacy `分类 {categoryId}` node is found only beneath the plugin root, renamed to the final path label, and attached under the preceding path node. Existing child question notes remain attached to that migrated leaf.

- [ ] **Step 4: Re-run the importer test**

Run: `node --test test/compact-card-import.test.mjs`

Expected: compact-card and migration tests pass.

### Task 3: Verify and build the test package

**Files:**
- Verify: `D:\WorkSpace\MN\daguanyuan-bridge\src\*.js`
- Build: `D:\WorkSpace\MN\daguanyuan-bridge\Daguanyuan Bridge Test.mnaddon`

- [ ] **Step 1: Run all tests and JavaScript syntax checks**

Run: `npm test`

Run: `node --check src/DaguanyuanPageCollector.js; node --check src/DaguanyuanImport.js; node --check src/WebPanelController.js`

Expected: all tests pass and all syntax checks exit successfully.

- [ ] **Step 2: Build only the test package and inspect its manifest**

Run: `npm run build`

Run: `tar -xOf "Daguanyuan Bridge Test.mnaddon" mnaddon.json`

Expected: the archive reports version `0.0.1`; no versioned release package is created.
