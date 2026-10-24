const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
function pageScript() {
  const read = name => fs.readFileSync(path.join(root, 'web/src', name), 'utf8');
  const bridge = read('lib/mnBridge.js').replace('export default MNBridge;', '');
  const page = read('DaguanyuanImportPage.js').replace("import MNBridge from './lib/mnBridge.js';", '');
  const style = "if(!document.getElementById('dgy-style')){var s=document.createElement('style');s.id='dgy-style';s.textContent=" + JSON.stringify(read('DaguanyuanImportDialog.css')) + ";document.head.appendChild(s);}";
  const website = {};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'src/DaguanyuanCategoryRoutes.js'), 'utf8'), website);
  vm.runInNewContext(fs.readFileSync(path.join(root, 'src/DaguanyuanWebsiteBridge.js'), 'utf8'), website);
  const questionDOM = website.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__.questionDOMScript();
  const script = questionDOM + '(function(){if(window.__DAGUANYUAN_IMPORT_UI__){window.__DAGUANYUAN_IMPORT_UI__.refresh();return;}\n' + style + bridge + page + '\n})();';
  new vm.Script(script);
  return script;
}
function buildWeb() {
  const destination = path.join(root, 'src/web-dist'); fs.mkdirSync(destination, { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src/mnaddon.json'), 'utf8'));
  fs.writeFileSync(path.join(destination, 'DaguanyuanPluginInfo.js'), 'var __DAGUANYUAN_PLUGIN_INFO__ = ' + JSON.stringify({ version: manifest.version, author: manifest.author }) + ';\n');
  fs.writeFileSync(path.join(destination, 'DaguanyuanImportPageScript.js'), 'var __DAGUANYUAN_IMPORT_PAGE_SCRIPT__ = ' + JSON.stringify(pageScript()) + ';\n');
  fs.writeFileSync(path.join(destination, 'DaguanyuanImportWorkspaceHTML.js'), 'var __DAGUANYUAN_IMPORT_WORKSPACE_HTML__ = ' + JSON.stringify(workspaceHTML()) + ';\n');
  const imageScript = fs.readFileSync(path.join(root, 'web/src/DaguanyuanMathImagePage.js'), 'utf8');
  const catalogScript = fs.readFileSync(path.join(root, 'web/src/DaguanyuanMathCatalogPage.js'), 'utf8');
  new vm.Script(catalogScript);
  fs.writeFileSync(path.join(destination, 'DaguanyuanMathCatalogPageScript.js'), 'var __DAGUANYUAN_MATH_CATALOG_PAGE_SCRIPT__ = ' + JSON.stringify(catalogScript) + ';\n');
  new vm.Script(imageScript);
  fs.writeFileSync(path.join(destination, 'DaguanyuanMathImagePageScript.js'), 'var __DAGUANYUAN_MATH_IMAGE_PAGE_SCRIPT__ = ' + JSON.stringify(imageScript) + ';\n');
  const masteryScript = fs.readFileSync(path.join(root, 'web/src/DaguanyuanMasteryPage.js'), 'utf8');
  new vm.Script(masteryScript);
  fs.writeFileSync(path.join(destination, 'DaguanyuanMasteryPageScript.js'), 'var __DAGUANYUAN_MASTERY_PAGE_SCRIPT__ = ' + JSON.stringify(masteryScript) + ';\n');
}
function workspaceScript() {
  const read = name => fs.readFileSync(path.join(root, 'web/src', name), 'utf8');
  const script = '(function(){\n' + read('lib/mnBridge.js').replace('export default MNBridge;', '')
    + read('DaguanyuanImportWorkspace.js').replace("import MNBridge from './lib/mnBridge.js';", '') + '\n})();';
  new vm.Script(script);
  return script;
}
function workspaceHTML() {
  const css = fs.readFileSync(path.join(root, 'web/src/DaguanyuanImportWorkspace.css'), 'utf8');
  return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>大观园导入</title><style>'
    + css + '</style></head><body><div id="root"></div><script>' + workspaceScript().replace(/<\/script/gi, '<\\/script') + '</script></body></html>';
}
module.exports = { pageScript, workspaceScript, workspaceHTML, buildWeb };
if (require.main === module) buildWeb();
