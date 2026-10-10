// 在本地演示页面检查实际浏览器交互和宽窄窗口布局，不写入 MarginNote。
const { chromium } = require(process.env.DAGUANYUAN_PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.DAGUANYUAN_BROWSER_PATH });
  try {
    const page = await browser.newPage({ viewport: { width: 960, height: 680 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:8769');
    for (const id of [223, 321, 327]) await page.locator('summary').filter({ has: page.locator('[data-category="' + id + '"]') }).click();
    await page.locator('[data-category="331"]').check();
    await page.waitForFunction(() => document.querySelectorAll('.question-card').length === 3);
    assert.equal(await page.locator('#commit').textContent(), '导入 3 道题');
    const directory = path.resolve(__dirname, '../../docs/previews'); fs.mkdirSync(directory, { recursive: true });
    for (const [width, height] of [[960, 680], [760, 680], [560, 420], [540, 420], [420, 420]]) {
      await page.setViewportSize({ width, height });
      const bounds = await page.evaluate(() => {
        const footer = document.querySelector('.action-bar').getBoundingClientRect();
        const filters = document.querySelector('.filters').getBoundingClientRect();
        const commit = document.querySelector('#commit').getBoundingClientRect();
        return { scrollWidth: document.documentElement.scrollWidth, width: innerWidth, footerLeft: footer.left, filtersRight: filters.right, filtersBottom: filters.bottom, footerBottom: footer.bottom, commitRight: commit.right, commitBottom: commit.bottom, height: innerHeight };
      });
      assert.ok(bounds.footerLeft >= bounds.filtersRight, '底部操作栏必须从右栏开始，不能占用左侧筛选');
      assert.equal(bounds.filtersBottom, bounds.footerBottom, '左侧筛选必须延伸到面板底部');
      assert.ok(bounds.scrollWidth <= bounds.width); assert.ok(bounds.footerBottom <= bounds.height);
      assert.ok(bounds.commitRight <= bounds.width); assert.ok(bounds.commitBottom <= bounds.height);
      await page.screenshot({ path: path.join(directory, 'import-workspace-' + width + '.png') });
    }
    await page.setViewportSize({ width: 960, height: 680 });
    await page.locator('[data-scope="core"]').click(); assert.equal(await page.locator('[data-scope="core"]').getAttribute('aria-pressed'), 'true');
    for (const subject of ['math_1', 'math_2', 'math_3', 'all']) {
      await page.locator('[data-exam-subject="' + subject + '"]').click();
      await page.waitForFunction(() => !document.getElementById('commit').disabled);
      assert.equal(await page.locator('[data-exam-subject="' + subject + '"]').getAttribute('aria-pressed'), 'true');
    }
    await page.locator('#years input[value="2026"]').check(); assert.equal(await page.locator('.question-card').count(), 1);
    await page.locator('#none').click(); assert.equal(await page.locator('#commit').isDisabled(), true);
    await page.locator('#all').click(); await page.locator('[data-content="questionAnswer"]').click(); await page.locator('#commit').click();
    await page.waitForFunction(() => !document.getElementById('result').hidden);
    assert.match(await page.locator('#result-text').textContent(), /新建 1/);
    await page.locator('#result-text').evaluate(node => { node.textContent += '\n' + Array.from({ length: 100 }, (_, i) => '题目 ' + (i + 1) + '：错误详情').join('\n'); });
    for (const [width, height] of [[960, 680], [560, 420]]) {
      await page.setViewportSize({ width, height });
      const [filters, result] = await Promise.all([page.locator('.filters').boundingBox(), page.locator('#result').boundingBox()]);
      assert.ok(result.x >= filters.x + filters.width);
      assert.ok(result.x + result.width <= width);
      assert.equal(await page.locator('[data-exam-subject="math_2"]').isEnabled(), true);
      await page.locator('#result').evaluate(node => { node.scrollTop = node.scrollHeight; });
      const [summary, copy] = await Promise.all([page.locator('#result').boundingBox(), page.locator('#copy').boundingBox()]);
      assert.ok(copy.y >= summary.y && copy.y + copy.height <= summary.y + summary.height, '滚动到长错误列表末尾时复制详情仍然可见');
      await page.screenshot({ path: path.join(directory, 'import-workspace-result-' + width + '.png') });
    }
    await page.setViewportSize({ width: 960, height: 680 });
    await page.locator('#close-result').click(); assert.equal(await page.locator('#result').isVisible(), false);
    await page.locator('[data-source="408"]').click();
    assert.equal(await page.locator('#scope-field').isVisible(), false);
    assert.equal(await page.locator('#exam-subject-field').isVisible(), false);
    assert.equal(await page.locator('#organization408').isVisible(), true);
    const roots = await page.locator('#tree > .knowledge-tree > .knowledge-node > .knowledge-row .knowledge-name').allTextContents();
    assert.deepEqual(roots, ['数据结构', '计算机组成原理', '操作系统', '计算机网络']);
    await page.locator('#tree input').first().check();
    await page.waitForFunction(() => document.querySelectorAll('.question-card').length === 2);
    for (const [width, height] of [[960, 680], [560, 420]]) {
      await page.setViewportSize({ width, height });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: path.join(directory, 'import-workspace-408-' + width + '.png') });
    }
    await page.setViewportSize({ width: 960, height: 680 });
    await page.locator('[data-organization="year"]').click();
    assert.equal(await page.locator('#tree-field').isVisible(), false);
    assert.equal(await page.locator('#years input').count(), 18);
    await page.locator('#years input[value="2026"]').check();
    await page.waitForFunction(() => document.querySelectorAll('.question-card').length === 1);
    await page.locator('#commit').click();
    await page.waitForFunction(() => !document.getElementById('result').hidden);
    assert.match(await page.locator('#result-text').textContent(), /新建 1/);
    await page.locator('[data-source="math"]').click();
    assert.equal(await page.locator('#scope-field').isVisible(), true);
    assert.deepEqual(errors, []);
    console.log('数学范围、408 四科目录及年份选择、选题和演示回执通过；五种宽度底栏仅占右侧，左侧筛选延伸到底部，无横向溢出。');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
