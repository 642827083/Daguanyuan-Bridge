import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function runtime(stored = new Map()) {
  let methods;
  class View {
    constructor(frame) { this.frame=frame; this.layer={}; this.subviews=[]; this.titleLabel={}; }
    get bounds() { return {x:0,y:0,width:this.frame.width,height:this.frame.height}; }
    addSubview(view) { this.subviews.push(view); view.superview=this; }
    removeFromSuperview() { if (this.superview) this.superview.subviews = this.superview.subviews.filter(view => view !== this); this.superview = null; }
    addGestureRecognizer() {}
    addTargetActionForControlEvents(target, action) { this.action=action; }
    setTitleForState(title) { this.title=title; }
    setTitleColorForState() {}
    loadRequest() {}
    evaluateJavaScript(script, callback) { this.lastScript=script; callback(null,null); }
  }
  const color={colorWithAlphaComponent() { return this; }};
  const context={console, JSB:{defineClass(name, instance) { methods=instance; return {}; }},
    UIView:View,UILabel:View,UIButton:View,UIWebView:View,UIScrollView:View,UISwitch:View,UIPanGestureRecognizer:function(){},
    UIColor:new Proxy({},{get(){return ()=>color;}}),UIFont:{boldSystemFontOfSize(){},systemFontOfSize(){}},
    NSUserDefaults:{standardUserDefaults(){return {objectForKey:key=>stored.get(key),setObjectForKey(value,key){stored.set(key,value);}};}},
    NSURL:{URLWithString:url=>url},NSURLRequest:{requestWithURL:url=>url},
    __DAGUANYUAN_CATEGORY_MANAGER_UI_GLOBAL__:{setup(c){c.categoryManagerPage=new View({});},layout(){}},
    __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__:{categoryEnabled(){return false;},categoryJumpEnabled(){return false;},questionLocatorEnabled(){return true;}},
    __DAGUANYUAN_CARD_LOCATOR_GLOBAL__:{mode(){return 'focus';}},
    __DAGUANYUAN_SINGLE_IMPORT_GLOBAL__:{position(){return 'child';},positionTitle(){return '所选卡片的子节点';}},
    __DAGUANYUAN_CARD_LOCATOR_UI_GLOBAL__:{cancelMode(){},layout(){}},
    __DAGUANYUAN_IMPORT_REPORT_GLOBAL__:{layout(){}},
    __DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__:{bindCategoryScript(...values){return JSON.stringify(values);}},
    __DAGUANYUAN_MASTERY_UI_GLOBAL__:{enabled(){return true;}},self:{addon:{window:{}}}
  };
  vm.createContext(context);
  for(const name of ['DaguanyuanSourceLink','DaguanyuanCardComments','DaguanyuanCommentFold','DaguanyuanCardLocatorUI','DaguanyuanVideoBrowser','DaguanyuanCardToolsSettings','DaguanyuanPluginIntegrationSettings','WebPanelController'])
    vm.runInContext(readFileSync(new URL('../src/'+name+'.js',import.meta.url),'utf8'),context);
  methods.viewDidLoad();
  return {controller:context.self,methods,stored,context};
}

test('自动折叠开关保留在外，管理入口与定位方式复用弹窗，窄宽布局均不遮挡', async () => {
  const run = runtime(), c = run.controller, messages = [];
  run.context.Application = { sharedInstance: () => ({ showHUD: message => messages.push(message) }) };
  assert.equal(c.commentFoldSwitch.on, false);
  assert.equal(c.commentFoldTitle.text, '自动折叠原题评论');
  assert.equal(c.cardManagementTitle.text, '已导入题卡管理');
  assert.equal(c.repairCardsButton, undefined); assert.equal(c.foldSourceCommentsButton, undefined); assert.equal(c.unfoldSourceCommentsButton, undefined);
  run.methods.toggleSourceCommentFold({ on: true }); assert.equal(c.commentFoldSwitch.on, true);
  const restored = runtime(run.stored); assert.equal(restored.controller.commentFoldSwitch.on, true);
  run.methods.toggleSourceCommentFold({ on: false });
  for (const width of [560, 960]) {
    c.view.frame = { x: 0, y: 0, width, height: 680 }; run.methods.viewDidLayoutSubviews();
    for (const key of ['commentFoldTitle', 'commentFoldDescription', 'commentFoldSwitch', 'cardManagementTitle', 'cardManagementDescription', 'cardManagementChevron', 'cardManagementButton']) {
      const r = c[key].frame;
      assert.ok(r.x + r.width <= c.cardToolsSettingsSection.frame.width);
      assert.ok(r.y + r.height <= c.cardToolsSettingsSection.frame.height);
    }
    assert.ok(c.pluginIntegrationSettingsSection.frame.y > c.cardToolsSettingsSection.frame.y + c.cardToolsSettingsSection.frame.height);
  }
  const calls = [];
  run.context.__DAGUANYUAN_COMMENT_FOLD_GLOBAL__.batch = async (addon, collapsed) => {
    calls.push(collapsed); return { changed: 1, unchanged: 2, skipped: 0, failed: [] };
  };
  c.activePage = 'settings'; run.methods.openImportedCardManagement();
  let menu = c.cardLocationModeChoice;
  assert.deepEqual(Array.from(menu.buttons, row => row.title), ['修复题卡格式', '折叠原题评论', '展开原题评论', '取消']);
  assert.equal(menu.sheet.frame.width, 360); assert.equal(menu.sheet.layer.cornerRadius, 12);
  assert.equal(menu.sheet.frame.height, 274);
  assert.equal(c.commentFoldSwitch.superview, c.cardToolsSettingsSection);
  run.methods.selectImportedCardManagement(menu.buttons[1]);
  assert.equal(c.cardManagementButton.enabled, false);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(c.cardManagementButton.enabled, true); assert.match(messages.at(-1), /已折叠 1/);
  run.methods.openImportedCardManagement(); menu = c.cardLocationModeChoice;
  run.methods.selectImportedCardManagement(menu.buttons[2]); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, [true, false]); assert.match(messages.at(-1), /已展开 1/);
  c.categoryImportBusy = true; run.methods.openImportedCardManagement(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, 2); assert.match(messages.at(-1), /请先完成/);
});

test('管理弹窗修复入口正确分发，取消及旧按钮不触发操作，切换页面清理弹窗', () => {
  const run = runtime(), c = run.controller; c.activePage = 'settings'; const repairs = [];
  run.context.__DAGUANYUAN_CARD_REPAIR_UI_GLOBAL__ = { repair: target => repairs.push(target), cancel() {} };
  run.methods.openImportedCardManagement(); let menu = c.cardLocationModeChoice;
  const old = menu.buttons[0];
  run.methods.selectImportedCardManagement(menu.buttons[3]); assert.equal(repairs.length, 0); assert.equal(c.cardLocationModeChoice, null);
  run.methods.openImportedCardManagement(); menu = c.cardLocationModeChoice;
  run.methods.selectImportedCardManagement(old); assert.equal(repairs.length, 0); assert.equal(c.cardLocationModeChoice, menu);
  run.methods.selectImportedCardManagement(menu.buttons[0]); assert.deepEqual(repairs, [c]); assert.equal(c.cardLocationModeChoice, null);
  run.methods.openImportedCardManagement(); run.methods.openDaguanyuan(); assert.equal(c.cardLocationModeChoice, null);
});

test('设置末尾提供插件联动与默认关闭的 MN Browser 开关，窄宽窗口均可滚动到全部内容', () => {
  const run=runtime(), c=run.controller;
  assert.equal(c.pluginIntegrationTitle.text,'插件联动');assert.equal(c.mnBrowserTitle.text,'MN Browser');
  assert.equal(c.mnBrowserSwitch.on,false);assert.equal(c.mnBrowserSwitch.action,'toggleMNBrowserIntegration:');
  assert.match(c.mnBrowserDescription.text,/关闭跳转哔哩哔哩 App/);
  for(const width of [560,960]){
    c.view.frame={x:0,y:0,width,height:680};run.methods.viewDidLayoutSubviews();
    const section=c.pluginIntegrationSettingsSection.frame, previous=c.cardToolsSettingsSection.frame;
    assert.equal(section.y,previous.y+previous.height+12);
    assert.ok(c.settingsPage.contentSize.height>=section.y+section.height+12);
    for(const key of ['mnBrowserTitle','mnBrowserDescription','mnBrowserSwitch']){
      const frame=c[key].frame;assert.ok(frame.x+frame.width<=section.width);assert.ok(frame.y+frame.height<=section.height);
    }
  }
});

test('选题导入开关默认开启，位于导入题目下方，保存后立即更新网页并在新面板恢复', () => {
  const run=runtime(), c=run.controller;
  assert.equal(c.selectionImportTitle.text,'显示选题导入');
  assert.equal(c.singleImportTitle.text,'显示导入本题');
  assert.equal(c.singleImportPositionTitle.text,'导入本题位置');
  assert.equal(c.selectionImportSwitch.on,true);
  assert.equal(c.selectionImportSwitch.action,'toggleSelectionImportDisplay:');
  for(const width of [560,960]){
    c.view.frame={x:0,y:0,width,height:680};run.methods.viewDidLayoutSubviews();
    assert.ok(c.selectionImportSwitch.frame.y>c.categoryImportSwitch.frame.y);
    assert.ok(c.selectionImportSwitch.frame.y<c.singleImportSwitch.frame.y);
    assert.ok(c.singleImportPositionButton.frame.y+c.singleImportPositionButton.frame.height<=c.questionToolsSettingsSection.frame.height);
    assert.equal(c.cardToolsSettingsSection.frame.y,c.questionToolsSettingsSection.frame.y+c.questionToolsSettingsSection.frame.height+12);
  }
  run.methods.toggleSelectionImportDisplay({on:false});
  assert.equal(c.selectionImportSwitch.on,false); assert.equal(JSON.parse(c.webView.lastScript)[2],false);
  const restored=runtime(run.stored);assert.equal(restored.controller.selectionImportSwitch.on,false);
  restored.methods.toggleSelectionImportDisplay({on:true});
  assert.equal(JSON.parse(restored.controller.webView.lastScript)[2],true);
  assert.equal(runtime(run.stored).controller.selectionImportSwitch.on,true);
});

test('原生联动开关保存选择，新面板恢复相同状态并可关闭', () => {
  const run=runtime();run.methods.toggleMNBrowserIntegration({on:true});assert.equal(run.controller.mnBrowserSwitch.on,true);
  const restored=runtime(run.stored);assert.equal(restored.controller.mnBrowserSwitch.on,true);
  restored.methods.toggleMNBrowserIntegration({on:false});assert.equal(restored.controller.mnBrowserSwitch.on,false);
  assert.equal(runtime(run.stored).controller.mnBrowserSwitch.on,false);
});
