# 题卡分类与复测导航 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复大观园题卡前缀分类、练习复测跳转和题卡链接遮挡问题。

**Architecture:** WebView 页面采集器为每道题生成练习页 URL；原生导入器负责分类树和 Markdown 卡片正文；选中卡片读取器解析隐藏标记并兼容旧链接。三层通过既有 payload 和全局桥接对象通信。

**Tech Stack:** MarginNote JavaScriptCore、WebView JavaScript、Node.js `node:test`、PowerShell ZIP 构建脚本。

---

### Task 1: 写回归测试

**Files:**
- Modify: `test/practice-collector.test.mjs`
- Modify: `test/compact-card-import.test.mjs`
- Modify: `test/selected-question.test.mjs`
- Modify: `test/import-contract.test.mjs`

- [ ] **Step 1: 增加题目练习 URL 断言**

断言采集结果中的第一题 URL 为 `https://cxyonly.fans/math/practice/329?page=1&questionId=3579&resumeCategoryId=708`。

- [ ] **Step 2: 增加隐藏链接和 329 分类断言**

断言题卡正文包含 `<!-- DAGUANYUAN_URL:` 而不包含可见 `[查看原题]`，并断言源码存在 `329` 到 `高等数学`、`（一）极限` 的映射。

- [ ] **Step 3: 增加选中题目兼容性断言**

分别传入隐藏标记和旧可见链接，均应返回完整练习页 URL；按钮契约改为匹配“问AI”。

- [ ] **Step 4: 运行新增测试确认当前实现失败**

运行 `npm test -- test/practice-collector.test.mjs test/compact-card-import.test.mjs test/selected-question.test.mjs test/import-contract.test.mjs`，预期因缺少题目 URL、隐藏标记、329 映射和按钮文字而失败。

### Task 2: 修复采集和导入链路

**Files:**
- Modify: `web/src/site/practiceCollector.mjs`
- Modify: `web/src/domain/practiceParser.mjs`
- Modify: `src/DaguanyuanPageCollector.js`
- Modify: `src/DaguanyuanImport.js`
- Modify: `src/DaguanyuanSelection.js`
- Modify: `src/WebPanelController.js`

- [ ] **Step 1: 生成每题练习页 URL**

使用字符串查询参数处理函数替换或追加 `questionId`，不依赖 JavaScriptCore 不保证存在的浏览器 URL API。

- [ ] **Step 2: 补回 329 前缀**

将 `329` 映射到 `["高等数学", "（一）极限"]`，保留其他已有映射。

- [ ] **Step 3: 使用隐藏 Markdown URL 标记**

题卡正文追加 `<!-- DAGUANYUAN_URL:${question.url} -->`；选中题目解析器先解析隐藏标记，再兼容旧的 `/math/questions/` 链接。

- [ ] **Step 4: 修改面板按钮文字**

只改显示标题为“问AI”，保留现有 selector 和练习页跳转行为。

### Task 3: 运行验证和构建

**Files:**
- Generated: `Daguanyuan Bridge Test.mnaddon`

- [ ] **Step 1: 运行完整测试**

运行 `npm test`，预期全部通过。

- [ ] **Step 2: 运行 JavaScript 语法检查**

运行 `node --check src/main.js; node --check src/DaguanyuanImport.js; node --check src/DaguanyuanPageCollector.js; node --check src/DaguanyuanSelection.js; node --check src/WebPanelController.js`。

- [ ] **Step 3: 构建测试包**

运行 `npm run build`，确认只更新 `Daguanyuan Bridge Test.mnaddon`。
