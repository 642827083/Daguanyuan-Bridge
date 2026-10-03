// 本地复用真实路由、网页定位器和网站切题函数，不连接网站账户。
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const port = 8769;
http.createServer((request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${port}`);
const scripts = { '/routes.js': 'src/Daguanyuan408Routes.js', '/bridge.js': 'src/DaguanyuanWebsiteBridge.js', '/next.js': 'test/browser/fixtures/408-next-question.js', '/header.js': 'test/browser/fixtures/408-year-header.js' };
  if (scripts[url.pathname]) {
    let source = fs.readFileSync(path.join(root, scripts[url.pathname]), 'utf8');
    if (url.pathname === '/bridge.js') source = source
      .replaceAll('/^www\\.408os\\.cn$/i', '/^127\\.0\\.0\\.1$/i')
      .replaceAll('window.location.hostname !== "www.408os.cn"', 'window.location.hostname !== "127.0.0.1"');
    response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }); response.end(source); return;
  }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(`<!doctype html><meta charset="utf-8"><title>408 知识点切题验证</title>
  <style>body{font:16px system-ui;color:#29313b;background:#f4f5f7;margin:0;padding:32px}main{max-width:1050px;margin:auto}.exercise-header,.question-card{padding:20px;background:white;border:1px solid #e5e7eb;border-radius:12px;margin:16px 0}.header-left,.mode-switch,.header-tags{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.mode-btn,.mode-btn-mobile{display:flex;align-items:center;gap:8px}.icon{width:18px;height:18px}h1{font-size:18px;margin:0}button{padding:8px 12px;border-radius:8px;border:1px solid #ccd1d8;background:white;color:inherit;cursor:pointer}.active{color:#147f60;background:#e6f8ef}.content-area{height:420px;overflow:auto;scroll-behavior:auto}.exercise-outline{display:flex;gap:12px;margin:15px 0}.num-item{padding:8px 14px;background:white;cursor:pointer}.num-item.active{outline:2px solid #147f60}.header-tags{padding-bottom:14px;border-bottom:1px solid #eee}p{line-height:1.7}#result{font-size:13px;overflow-wrap:anywhere}</style>
  <main><div class="exercise-header"><div class="header-left"><h1 class="header-title" data-v-6053f604>数据类型转换</h1><div id="native-modes"></div></div></div>
  <div class="content-area"></div><div class="exercise-outline"></div><button id="prev" class="nav-btn nav-prev">上一题</button> <button id="next" class="nav-btn nav-next">下一题</button> <button id="mobile-prev" class="mobile-nav-btn prev"><span>手机上一题</span></button> <button id="mobile-next" class="mobile-nav-btn next"><span>手机下一题</span></button> <button id="settings">设置</button> <button id="auto">模拟答题后自动切题</button> <button id="repeat">重复注入</button><p id="result"></p></main>
  <script src="/routes.js"></script><script src="/bridge.js"></script><script src="/header.js"></script><script>
  var rows=[{id:12,year:2009,questionIndex:12},{id:419,year:2017,questionIndex:43},{id:640,year:2022,questionIndex:29}];
  var year=Number(new URLSearchParams(location.search).get('year'));
  if(year)rows=Array.from({length:47},(_,index)=>({id:47*(year-2009)+index+1,year:year,questionIndex:index+1}));
  if(new URLSearchParams(location.search).has('only'))rows=[rows[1]];
  var directId=Number(new URLSearchParams(location.search).get('questionId'));
  var K={value:directId?rows.filter(q=>q.id===directId):rows}, le={value:0}, G={value:directId?'single':'list'}, Yn={value:!!new URLSearchParams(location.search).get('knowledgeId')},Tn={value:false},$n={value:false},Mn={value:year||2017},In={value:directId||null},ta=new Map();
  var Il={get value(){return K.value[le.value]}};
  function r(self,args,generator){const it=generator.apply(self,args||[]);return new Promise((resolve,reject)=>{function step(value){let result;try{result=it.next(value)}catch(error){reject(error);return}result.done?resolve(result.value):Promise.resolve(result.value).then(step,reject)}step()})}
  var l={success:message=>{document.querySelector('#result').textContent=message}},n={replace:async value=>{if(!year)throw Error('错误：回到年份网址');history.replaceState(null,'','/exercise?'+new URLSearchParams(value.query))}},t={get query(){return Object.fromEntries(new URLSearchParams(location.search))}},i=Object.assign,u=Object.assign;
  async function Xl(){} async function da(){} async function ua(){throw Error('错误：加载年份题卷')} async function Ul(id){if(!year)throw Error('错误：请求年份下一题 '+id);K.value=[rows.find(q=>q.id===id)];le.value=0;render()} async function fa(id){return K.value.findIndex(q=>q.id===id)<K.value.length-1} async function ka(index){le.value=index;render()}
  function render(){
    document.querySelector('h1').textContent=year?websiteYearHeader(Object.fromEntries(new URLSearchParams(location.search)),Il.value,K.value.length):'数据类型转换';
    var independent=K.value.length===1&&!!new URLSearchParams(location.search).get('questionId');
    document.querySelector('#native-modes').innerHTML=independent?'':'<div class="mode-switch"><button class="mode-btn" id="list">列表模式</button><button class="mode-btn" id="single">单题模式</button></div>';
    if(!independent){document.querySelector('#single').classList.toggle('active',G.value==='single');document.querySelector('#list').classList.toggle('active',G.value==='list');document.querySelector('#single').onclick=()=>{G.value='single';render()};document.querySelector('#list').onclick=()=>{G.value='list';render()}}
    function card(q){return '<div class="question-card"><div class="header-tags"><span class="year-tag">'+q.year+'</span><span class="index-tag">第'+q.questionIndex+'题</span><span class="score-tag">2分</span></div><p>数据类型转换 · 题目 ID '+q.id+'</p></div>'}
    document.querySelector('.content-area').innerHTML=G.value==='list'?K.value.map(q=>'<div class="question-wrapper" data-question-id="'+q.id+'">'+card(q)+'</div>').join(''):'<div class="single-question-wrapper">'+card(Il.value)+'</div>';
    document.querySelector('.exercise-outline').innerHTML=G.value==='list'?K.value.map((q,i)=>'<div class="num-item '+(i===le.value?'active':'')+'" data-index="'+i+'">'+(year?q.questionIndex:i+1)+'</div>').join(''):'';
    document.querySelectorAll('.num-item').forEach(item=>item.onclick=()=>{le.value=Number(item.dataset.index);render()});
    for(const id of ['prev','mobile-prev'])document.querySelector('#'+id).disabled=independent?Il.value.questionIndex===1:le.value===0;
    for(const id of ['next','mobile-next'])document.querySelector('#'+id).disabled=independent?Il.value.questionIndex===47:le.value===K.value.length-1;
    document.querySelector('#result').textContent=JSON.stringify({url:location.search,mode:G.value,loaded:K.value.length,scrolls:scrolls});
  }
  var scrolls=0;var originalScroll=Element.prototype.scrollIntoView;Element.prototype.scrollIntoView=function(){if(this.matches('.question-wrapper'))scrolls++;return originalScroll.apply(this,arguments)};
  document.querySelector('#settings').onclick=()=>{var menu=document.querySelector('.settings-menu');if(menu)menu.remove();else{menu=document.createElement('div');menu.className='settings-menu';document.querySelector('main').appendChild(menu)}};
  document.querySelector('#repeat').onclick=()=>eval(__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__.exerciseQuestionScript());
  render();
  </script><script src="/next.js"></script><script>
  for(const id of ['next','mobile-next'])document.querySelector('#'+id).onclick=async()=>{await ba();render()};
  for(const id of ['prev','mobile-prev'])document.querySelector('#'+id).onclick=async()=>{await ha();render()};
  document.querySelector('#auto').onclick=async()=>{await wa(Il.value.id);render()};
  eval(__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__.exerciseQuestionScript());
  </script>`);
}).listen(port, '127.0.0.1', () => console.log(`知识点切题验证：http://127.0.0.1:${port}/exercise?knowledgeId=53&daguanyuanQuestionId=419`));
