import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const packageJson = readFileSync(new URL("../package.json", import.meta.url), "utf8");
const packageLock = readFileSync(new URL("../package-lock.json", import.meta.url), "utf8");
const addonManifest = readFileSync(new URL("../src/mnaddon.json", import.meta.url), "utf8");
const buildScript = readFileSync(new URL("../scripts/build-test.js", import.meta.url), "utf8");
const releaseScript = readFileSync(new URL("../scripts/build-release.js", import.meta.url), "utf8");

test("测试构建固定使用 Daguanyuan Bridge Test.mnaddon", () => {
  assert.match(packageJson, /Daguanyuan Bridge Test/);
  assert.match(buildScript, /Daguanyuan Bridge Test\.mnaddon/);
  assert.doesNotMatch(packageJson, /version:patch/);
});

test("正式版本在清单与锁文件中保持一致", () => {
  const version = JSON.parse(packageJson).version, lock = JSON.parse(packageLock);
  assert.match(version, /^\d+\.\d+\.\d+$/);
  assert.equal(lock.version, version);
  assert.equal(lock.packages[''].version, version);
  assert.equal(JSON.parse(addonManifest).version, version);
});

test("正式构建使用版本包名并拒绝覆盖已有文件", () => {
  assert.match(packageJson, /"build:release": "node scripts\/build-release\.js"/);
  assert.match(releaseScript, /Daguanyuan Bridge-v\$\{version\}\.mnaddon/);
  assert.match(releaseScript, /if \(fs\.existsSync\(outputPath\)\)\s*\{\s*throw new Error/);
});
