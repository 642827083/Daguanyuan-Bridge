const http = require('http');
const { pageScript } = require('./build-web');

// 使用正式页面脚本与样式；只模拟题库列表和原生回执，不写入 MarginNote。
const html = () => `<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>大观园导入交互预览</title>
<style>body{font:15px/1.7 system-ui;background:#f4f6f9;color:#24354a;margin:0;padding:32px}main{max-width:780px;margin:auto}h1{font-size:25px}button{padding:10px 14px;border:1px solid #ccd6e2;border-radius:8px;background:white;color:#245d9f;cursor:pointer}article{background:white;border-radius:12px;padding:24px;margin:24px 0}pre{white-space:pre-wrap}</style>
<main><h1>大观园 · 选题导入</h1><p>交互预览 · 以下为演示题目，导入结果由本地模拟，不会写入 MarginNote。</p><article><h2>高等数学 / 极限与连续</h2><p>在插件的数学或 408 题目页，右下角工具栏可打开导入弹窗。</p><button onclick="previewOpen('selected')">选题导入</button></article><pre id="preview-log" aria-live="polite">尚未提交题目</pre></main>
<script>${pageScript().replace(/<\/script/gi, '<\\/script')}</script>
<script>
let previewToken='', previewActive=false;
const ui=window.__DAGUANYUAN_IMPORT_UI__;
const topics=['求函数在原点处的极限，并说明极限存在的条件。','设函数在闭区间上连续，证明至少存在一个满足条件的点。','利用等价无穷小计算极限，写出主要计算过程。','讨论分段函数在分界点处的连续性与可导性。'];
window.previewOpen=function(scope){
 previewToken=String(Date.now()); previewActive=true;
 ui.loading(previewToken,scope);
 ui.startPlan({token:previewToken,source:'大观园数学 / 极限与连续 / 严选',target:'2027 考研数学'});
 ui.appendQuestions(previewToken,Array.from({length:scope==='single'?1:22},(_,i)=>({id:i+1,title:(2026-Math.floor(i/4))+'年 数学一 第'+(i+1)+'题',summary:topics[i%topics.length]})));
 ui.render(previewToken);
};
const originalAppend=document.body.appendChild.bind(document.body);
document.body.appendChild=function(node){
 if(node.tagName!=='IFRAME'||!node.src.startsWith('daguanyuanbridge://ui?'))return originalAppend(node);
 const m=JSON.parse(decodeURIComponent(node.src.split('payload=')[1]));
 setTimeout(()=>{
  if(m.command==='commitQuestionImport'){
   const ids=JSON.parse(ui.selectionChunk(previewToken,0));
   document.getElementById('preview-log').textContent='本次提交的题目 ID：'+ids.join('、')+'；导入内容：'+(m.payload.content==='questionAnswer'?'题目＋答案':'题目')+'（仅演示）';
   const token=previewToken;
   setTimeout(()=>{if(previewActive&&token===previewToken)ui.result(token,{text:'演示结果：新建 '+ids.length+' 道，更新 0 道，跳过 0 道，失败 0 道。\\n实际插件会将所选题目写入当前学习集。'});},500);
  }
  if(m.command==='cancelQuestionImport')previewActive=false;
  window.__DAGUANYUAN_MN_BRIDGE_RECEIVE__({requestId:m.requestId,payload:{accepted:true}});
 },0);
 return node;
};
</script></html>`;
const port = Number(process.env.PORT || 4178);
http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(html());
}).listen(port, '127.0.0.1', () => console.log('Import preview: http://127.0.0.1:' + port));
