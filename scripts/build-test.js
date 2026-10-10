const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const rootDir = path.join(__dirname, "..");
const srcDir = path.join(rootDir, "src");
const stageDir = path.join(rootDir, "dist-test");
const outputPath = path.join(rootDir, "Daguanyuan Bridge Test.mnaddon");
const zipPath = `${outputPath}.zip`;
const packageVersion = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8")).version;
const lock = JSON.parse(fs.readFileSync(path.join(rootDir, "package-lock.json"), "utf8"));
const addonVersion = JSON.parse(fs.readFileSync(path.join(srcDir, "mnaddon.json"), "utf8")).version;
if (packageVersion !== lock.version || packageVersion !== lock.packages[""].version || packageVersion !== addonVersion) {
  throw new Error("package.json、package-lock.json 与 mnaddon.json 版本不一致");
}

function copyDirectory(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) copyDirectory(sourcePath, destinationPath);
    else fs.copyFileSync(sourcePath, destinationPath);
  }
}

if (fs.existsSync(stageDir)) fs.rmSync(stageDir, { recursive: true, force: true });
if (fs.existsSync(outputPath)) fs.rmSync(outputPath, { force: true });
if (fs.existsSync(zipPath)) fs.rmSync(zipPath, { force: true });
require('./build-web').buildWeb();
copyDirectory(srcDir, stageDir);

if (!fs.existsSync(path.join(stageDir, "icon.png"))) {
  throw new Error("测试安装包缺少工具栏图标：src/icon.png");
}

const escapedSource = path.join(stageDir, "*").replace(/'/g, "''");
const escapedZip = zipPath.replace(/'/g, "''");
execFileSync("powershell.exe", [
  "-NoProfile",
  "-NonInteractive",
  "-Command",
  `Compress-Archive -Path '${escapedSource}' -DestinationPath '${escapedZip}' -Force`,
], { stdio: "inherit" });
fs.renameSync(zipPath, outputPath);
console.log(`Build successful: ${path.basename(outputPath)}`);
