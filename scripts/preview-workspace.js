const http = require('node:http');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { workspaceHTML } = require('./build-web');
const root = path.resolve(__dirname, '..');
const catalog = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'src/DaguanyuanCategoryCatalog.js'), 'utf8'), catalog);
const records = catalog.__DAGUANYUAN_CATEGORY_CATALOG_DATA__.records;
vm.runInNewContext(fs.readFileSync(path.join(root, 'src/Daguanyuan408Catalog.js'), 'utf8'), catalog);
const catalog408 = catalog.__DAGUANYUAN_408_CATALOG_DATA__;
const questions408 = [
  { id: 40801, source: '2026 年第 1 题', serialNumber: 1, questionType: 'choice', categoryPath: '数据结构 / 线性表', stem: '下列关于顺序表和链表的描述，正确的是哪一项？', options: ['顺序表支持随机访问', '链表支持随机访问', '两者存储结构相同', '两者插入代价相同'] },
  { id: 40802, source: '2025 年第 41 题', serialNumber: 41, questionType: 'subjective', categoryPath: '数据结构 / 线性表', stem: '设有一个递增的单链表，请设计算法删除其中重复的元素，并说明算法的时间复杂度。', options: [] },
];
const questions = [
  { id: 3356, categoryId: 331, source: '1988年·数一二', serialNumber: 1, questionType: 'subjective', categoryPath: '高等数学 / 极限 / 函数 / 求函数表达式', stem: '已知 $f(x)=e^{x^2}$，$f(\\varphi(x))=1-x$，且 $\\varphi(x)\\ge0$，求 $\\varphi(x)$ 并写出它的定义域。', options: [] },
  { id: 3357, categoryId: 331, source: '1990年·数一二', serialNumber: 2, questionType: 'subjective', categoryPath: '高等数学 / 极限 / 函数 / 求函数表达式', stem: '设函数\n$$\nf(x)=\\begin{cases}1, & |x|\\le1,\\\\0, & |x|\\gt1.\\end{cases}\n$$\n则 $f[f(x)]=$ ___', options: [] },
  { id: 3358, categoryId: 331, source: '2026年·数二', serialNumber: 3, questionType: 'choice', categoryPath: '高等数学 / 极限 / 函数 / 求函数表达式', stem: '设函数在区间上连续，选择满足条件的函数表达式。', options: ['$x^2$', '$e^x$', '$\\ln x$', '$\\sin x$'] },
];
// 本地预览只模拟原生回执，示例题目不写入 MarginNote。
function html() {
  const stub = `(function(){
    const append=document.body.appendChild.bind(document.body);
    let token='';
    document.body.appendChild=function(node){
      const result=append(node);
      if(node.tagName==='IFRAME'&&node.src.startsWith('daguanyuanbridge://')){
        const message=JSON.parse(decodeURIComponent(node.src.split('payload=')[1]));
        queueMicrotask(function(){
          let payload={accepted:true}; const ui=window.__DAGUANYUAN_IMPORT_WORKSPACE__;
          if(message.command==='getImportWorkspace')payload={records:${JSON.stringify(records)},records408:${JSON.stringify(catalog408.records)},years408:${JSON.stringify(catalog408.years)},source:'math',scope:'complete',examSubject:'all',content:'question'};
          if(message.command==='getImportWorkspaceCatalog')payload={records:${JSON.stringify(records)},scope:message.payload.scope,examSubject:message.payload.examSubject};
          if(message.command==='prepareImportWorkspace'){
            token=message.payload.token; ui.start(token,{target:'考研学习集（预览示例）'});
            let items=message.payload.source==='408'?${JSON.stringify(questions408)}:${JSON.stringify(questions)};
            if(message.payload.source==='408'&&message.payload.organization==='year')items=items.filter(q=>message.payload.paperYears.some(y=>q.source.startsWith(String(y))));
            ui.append(token,{questions:items,categoryIndex:1,categoryCount:1}); ui.ready(token,{count:items.length,importedIds:[]});
          }
          if(message.command==='commitImportWorkspace'){
            const count=message.payload.count;
            ui.result(token,{text:'本地预览 · 不写入 MarginNote\\n新建 '+count+' 道题',result:{createdCount:count},importedIds:[]});
          }
          window.__DAGUANYUAN_MN_BRIDGE_RECEIVE__({requestId:message.requestId,payload:payload,error:''});
        });
      } return result;
    };
  })();`;
  return workspaceHTML().replace('<script>', () => '<script>' + stub)
    .replace('<body>', '<body><div class="preview-nav" style="height:38px;display:flex;align-items:center;justify-content:center;gap:12px;background:#f5f5f5;font-size:14px"><span>数学</span><span>408</span><strong style="padding:6px 20px;border-radius:15px;background:#e6e6e6;color:#195cb8">导入</strong><span>设置</span><small style="position:absolute;right:12px;color:#777">演示预览</small></div>')
    .replace('</style>', '#root{height:calc(100% - 38px)}</style>');
}
const port = Number(process.env.DAGUANYUAN_PREVIEW_PORT) || 8769;
http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(html());
}).listen(port, '127.0.0.1', () => console.log('导入页预览：http://127.0.0.1:' + port));
