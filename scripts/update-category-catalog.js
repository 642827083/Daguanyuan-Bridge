const fs = require("fs");
const path = require("path");

const SOURCE_URL = "https://www.cxyonly.fans/api/categories";
const OUTPUT_PATH = path.join(__dirname, "..", "src", "DaguanyuanCategoryCatalog.js");

function flatten(nodes, records) {
  for (const node of nodes) {
    const id = Number(node && node.id);
    const parentId = Number(node && node.parent_id) || 0;
    const name = String(node && node.name || "").trim();
    if (!Number.isSafeInteger(id) || id <= 0 || !name) throw new Error("分类接口返回了无效节点");
    records.push([id, parentId, name]);
    flatten(Array.isArray(node.children) ? node.children : [], records);
  }
}

async function main() {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) throw new Error(`分类接口请求失败：${response.status}`);
  const tree = await response.json();
  if (!Array.isArray(tree) || !tree.length) throw new Error("分类接口没有返回分类树");
  const records = [];
  flatten(tree, records);
  const payload = { source: SOURCE_URL, updatedAt: new Date().toISOString().slice(0, 10), records };
  const source = `var __DAGUANYUAN_CATEGORY_CATALOG_DATA__ = ${JSON.stringify(payload, null, 2)};\n`;
  const temporaryPath = `${OUTPUT_PATH}.tmp`;
  fs.writeFileSync(temporaryPath, source, "utf8");
  fs.renameSync(temporaryPath, OUTPUT_PATH);
  console.log(`已更新 ${records.length} 个分类节点`);
}

main().catch(function (error) {
  console.error(error && error.message || error);
  process.exitCode = 1;
});
