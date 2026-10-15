// 本地复用网页工具代码验证位置与图片粘贴，不连接网站账户或 MarginNote 数据库。
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const port = 8768;
http.createServer((request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${port}`);
  if (url.pathname === '/bridge.js' || url.pathname === '/note-paste.js') {
    let source;
    if (url.pathname === '/bridge.js') {
      source = fs.readFileSync(path.join(root, 'src/DaguanyuanWebsiteBridge.js'), 'utf8')
        .replaceAll('/^www\\.408os\\.cn$/i', '/^127\\.0\\.0\\.1$/i')
        .replaceAll('/(^|\\.)cxyonly\\.fans$/i', '/^127\\.0\\.0\\.1$/i')
        .replace('"daguanyuanbridge://" + command', '"about:blank#" + command');
    } else {
      const context = {}; vm.createContext(context);
      vm.runInContext(fs.readFileSync(path.join(root, 'src/Daguanyuan408NotePaste.js'), 'utf8'), context);
      source = context.__DAGUANYUAN_408_NOTE_PASTE_GLOBAL__.pageScript()
        .replace('"www.408os.cn"', '"127.0.0.1"')
        .replace("'daguanyuanbridge://add-note-result?token='", "'about:blank#add-note-result?token='");
    }
    response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(source); return;
  }
  const math = url.pathname.startsWith('/math/practice/');
  const modalDefault = url.searchParams.get('noteMode') === 'modal';
  const metadata = math ? '<strong class="tag">1</strong><button class="tag" data-question-source>2026数二（1） ▷</button><span class="tag" data-question-category-paths>高等数学 / 极限 / 函数</span>'
    : '<span class="tag year-tag">2026</span><span class="tag index-tag">第44题</span><span class="tag score-tag score">10分</span>';
  const header = math ? `<li data-learning-question-id="843"><article data-learning-question-card><header><div>${metadata}</div></header></article></li>`
    : `<div class="question-card"><div class="question-header"><div class="header-tags">${metadata}</div></div><div class="question-content"><p>假定计算机 C 的部分数据通路如图所示。</p></div><button class="action-btn" id="website-note">笔记</button><div id="editor-container"></div></div>`;
  const html = `<!doctype html><meta charset="utf-8"><title>题目工具位置与图片笔记验证</title>
  <style>body{background:#f5f6f8;color:#263039;font:16px system-ui;margin:0;padding:32px}main{max-width:1120px;margin:auto}h1{font-size:22px;margin:0 0 20px}nav{display:flex;gap:16px;margin-bottom:24px}a{color:#2572d2}.panel{background:white;border-radius:14px;padding:24px;margin:16px 0;border:1px solid #e3e6ea}.settings{display:flex;gap:30px}label{display:flex;align-items:center;gap:10px;font-weight:600}input[type=checkbox]{width:18px;height:18px}.tag{display:inline-flex;padding:9px 10px;border-radius:6px;border:1px solid #e1e5e8;background:#f4f5f6;font-size:14px;line-height:1.4}.year-tag{color:#15996e;background:#edf9f4}.score{color:#a7791c;background:#fffbf3}.header-tags,header>div{display:flex;align-items:center;gap:4px;flex-wrap:wrap}.question-header,header{padding-bottom:24px;border-bottom:1px solid #e3e6ea}li{list-style:none}p{line-height:1.8}.caption{font-size:14px;color:#6b7580}textarea{width:95%;height:100px;margin:12px 0;font:15px system-ui}button{cursor:pointer;padding:6px 12px}#note-preview img{width:64px;height:64px;border:1px solid #ccd3da}.modal.active{background:#fff;border:1px solid #7692bc;padding:16px;margin-top:16px}.note-tabs,.editor-tabs{display:flex;gap:20px;margin:10px 0}.note-tab{cursor:pointer}.auto-save-status,.inline-auto-save-status{color:#15996e}</style>
  <main><h1>题目工具 · 本地位置与图片粘贴验证</h1><nav><a href="/exercise?year=2026">408</a><a href="/math/practice/2">数学</a></nav>
  <div class="panel"><div class="settings"><label><input id="locate-toggle" type="checkbox" checked>显示定位卡片</label><label><input id="note-toggle" type="checkbox">显示添加笔记</label><label><input id="toggle" type="checkbox">显示导入本题</label></div><p class="caption">三个开关独立；工具显示在元数据右侧，使用相同的白底描边样式。</p></div>
  <section class="panel">${header}${math ? '<p>已知函数表达式，求函数并指出其定义域。</p>' : ''}<p class="caption">${math ? '数学' : '408'}题目页面按钮位置样例</p></section>
  <p id="result">等待操作</p>
  ${math ? '' : '<div class="panel"><label>网站笔记布局 <select id="note-mode"><option value="inline">内嵌</option><option value="modal" ' + (modalDefault ? 'selected' : '') + '>弹窗（从仅预览进入）</option></select></label><button id="run-note">运行图片笔记验证</button><p id="note-result">尚未运行</p><div id="note-preview"></div></div>'}
  </main><script src="/bridge.js"></script>${math ? '' : '<script src="/note-paste.js"></script>'}<script>
  const bridge = __DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__;
  eval(bridge.practiceScript(true, false)); eval(bridge.singleImportScript(false));
  const locate = document.querySelector('#locate-toggle'), note = document.querySelector('#note-toggle'), single = document.querySelector('#toggle');
  locate.onchange = note.onchange = function(){eval(bridge.practiceScript(locate.checked,note.checked))};
  single.onchange = function(){eval(bridge.singleImportScript(this.checked))};
  const observer = new MutationObserver(function(records){records.forEach(function(record){record.addedNodes.forEach(function(frame){if(frame.tagName==='IFRAME'){const action=frame.src.split('#')[1];document.querySelector('#result').textContent=decodeURIComponent(action);if(action.startsWith('add-note-result?'))document.querySelector('#note-result').textContent='保存回执：'+action;}})})});
  observer.observe(document.body,{childList:true});
  ${math ? '' : `
  let editorRoot;
  function showEditor(){
    if(editorRoot) return;
    const modal=document.querySelector('#note-mode').value==='modal';
    editorRoot=document.createElement('div'); if(modal)editorRoot.className='modal active';
    editorRoot.innerHTML='<div class="modal-header">笔记</div><div class="note-tabs"><div class="note-tab">我的笔记</div></div><div class="editor-tabs"><button>仅编辑</button><button>仅预览</button></div><span class="'+(modal?'auto-save-status':'inline-auto-save-status')+'">已保存</span><div class="editor-body"></div>';
    document.querySelector(modal?'main':'#editor-container').appendChild(editorRoot);
    function createEditor(){
      if(editorRoot.querySelector('textarea'))return;
      const editor=document.createElement('textarea');editor.className='editor-overlay-textarea';editor.value='已有笔记';editorRoot.querySelector('.editor-body').appendChild(editor);
      editor.addEventListener('paste', async function(event){
        event.preventDefault();const item=event.clipboardData.items[0];if(item.kind!=='file')throw Error('缺少文件项');
        const file=item.getAsFile(), picture=new Image(), imageURL=URL.createObjectURL(file);picture.src=imageURL;await picture.decode();
        editor.value+='\\n\\n[图片1]';editor.dispatchEvent(new Event('input',{bubbles:true}));editorRoot.querySelector('.auto-save-status,.inline-auto-save-status').textContent='自动保存中…';
        document.querySelector('#note-preview').appendChild(picture);window.setTimeout(function(){editorRoot.querySelector('.auto-save-status,.inline-auto-save-status').textContent='已保存'},200);
      });
    }
    editorRoot.querySelector('.editor-tabs button').onclick=createEditor;if(!modal)createEditor();
  }
  document.querySelector('#website-note').onclick=showEditor;
  document.querySelector('#run-note').onclick=function(){
    const receiver=window.__DAGUANYUAN_408_NOTE_PASTE__, token=Date.now()+'-1';
    const target={provider:'408',id:843,year:2026,number:44,url:location.href};
    if(!receiver.prepare(target,token,'image/png','clipboard.png'))throw Error('准备粘贴失败');
    receiver.append(token,'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9ZkAAAAASUVORK5CYII=');receiver.commit(token);
  };`}
  </script>`;
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(html);
}).listen(port, '127.0.0.1', () => console.log(`题目工具验证：http://127.0.0.1:${port}/exercise?year=2026`));
