// 复用网站公开资源的标题分支与独立单题判断，验证年份入口的真实显示规则。
function websiteYearHeader(query, question, count) {
  var Tn={value:false},Yn={value:false},Rn={value:false},$n={value:false},dl={value:false},Il={value:question},Mn={value:Number(query.year)},rl={value:!!query.year};
  var Du={},h={},t=[];
  function x() {} function C(value) { return String(value); } function I(value) { return value; }
  function f(tag, props, children) { return children; } function g(tag, props, children) { return children; }
  (function(e,t){const n=1===e&&!!t;dl.value=n})(count,query.questionId);
  return f("h1",Du,[Tn.value?(x(),g(h,{key:0},[t[68]||(t[68]=f("svg",{class:"title-icon",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor","stroke-width":"2"},[f("path",{d:"M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"})],-1)),I(" "+C(Nn.value),1)],64)):Yn.value?(x(),g(h,{key:1},[t[69]||(t[69]=f("svg",{class:"title-icon",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor","stroke-width":"2"},[f("path",{d:"M4 19.5A2.5 2.5 0 016.5 17H20"}),f("path",{d:"M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"})],-1)),I(" "+C(Gn.value||"知识点专项"),1)],64)):Rn.value?(x(),g(h,{key:2},[I(C(zn.value),1)],64)):$n.value&&Il.value?(x(),g(h,{key:3},[I(C(Tl.value),1)],64)):dl.value&&Il.value?(x(),g(h,{key:4},[I(" 第"+C(Il.value.questionIndex)+"题 ",1)],64)):rl.value&&Il.value?(x(),g(h,{key:5},[I(C(Mn.value)+"年第"+C(Il.value.questionIndex)+"题 ",1)],64)):(x(),g(h,{key:6},[I(C(Mn.value)+"年真题套卷 ",1)],64))]).flat(Infinity).join('').trim();
}
