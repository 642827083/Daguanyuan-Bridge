import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function runtime(stored = new Map()) {
  let methods;
  class View {
    constructor(frame) { this.frame=frame; this.layer={}; this.subviews=[]; this.titleLabel={}; }
    get bounds() { return {x:0,y:0,width:this.frame.width,height:this.frame.height}; }
    get center() { return {x:this.frame.x+this.frame.width/2,y:this.frame.y+this.frame.height/2}; }
    set center(point) { this.frame={...this.frame,x:point.x-this.frame.width/2,y:point.y-this.frame.height/2}; }
    addSubview(view) { this.subviews.push(view); view.superview=this; }
    removeFromSuperview() { if (this.superview) this.superview.subviews = this.superview.subviews.filter(view => view !== this); this.superview = null; }
    addGestureRecognizer(gesture) { (this.gestures ||= []).push(gesture); }
    addTargetActionForControlEvents(target, action) { this.action=action; }
    setTitleForState(title) { this.title=title; }
    setTitleColorForState() {}
    loadRequest() {}
    evaluateJavaScript(script, callback) { this.lastScript=script; callback(null,null); }
  }
  const color={colorWithAlphaComponent() { return this; }};
  class Gesture {
    constructor(target, action) { this.target=target; this.action=action; }
    requireGestureRecognizerToFail(other) { this.requiredToFail=other; }
    locationInView() { return this.point; }
  }
  const context={console, JSB:{defineClass(name, instance) { methods=instance; return {}; }},
    UIView:View,UILabel:View,UIButton:View,UIWebView:View,UIScrollView:View,UISwitch:View,UIPanGestureRecognizer:Gesture,UITapGestureRecognizer:Gesture,
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
  context.__DAGUANYUAN_PLUGIN_INFO__ = JSON.parse(readFileSync(new URL('../src/mnaddon.json', import.meta.url), 'utf8'));
  vm.createContext(context);
  for(const name of ['DaguanyuanSourceLink','DaguanyuanCardComments','DaguanyuanCommentFold','DaguanyuanCardLocatorUI','DaguanyuanVideoBrowser','DaguanyuanCardToolsSettings','DaguanyuanPluginIntegrationSettings','DaguanyuanAboutSettings','DaguanyuanSettingsNavigation','WebPanelController'])
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
    assert.equal(c.mnBrowserSwitch.superview, c.questionToolsSettingsSection);
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

test('MN Browser 归入题目工具，保留默认值和视频跳转开关，窄宽窗口可滚动到该行', () => {
  const run=runtime(), c=run.controller;
  run.methods.openSettings(); run.methods.selectSettingsSection(c.settingsNavigationButtons[1]);
  assert.equal(c.pluginIntegrationTitle,undefined);assert.equal(c.pluginIntegrationSettingsSection,undefined);
  assert.equal(c.mnBrowserTitle.text,'MN Browser');
  assert.equal(c.mnBrowserSwitch.on,false);assert.equal(c.mnBrowserSwitch.action,'toggleMNBrowserIntegration:');
  assert.match(c.mnBrowserDescription.text,/关闭跳转哔哩哔哩 App/);
  for(const width of [560,960]){
    c.view.frame={x:0,y:0,width,height:680};run.methods.viewDidLayoutSubviews();
    const section=c.questionToolsSettingsSection.frame;
    assert.equal(c.mnBrowserSwitch.superview,c.questionToolsSettingsSection);
    assert.ok(c.mnBrowserTitle.frame.y>c.singleImportPositionButton.frame.y+c.singleImportPositionButton.frame.height);
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
    assert.equal(c.cardToolsSettingsSection.frame.y,68);
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

test('设置四个导航仅展示对应内容，滚动不遮挡导航，保留各页位置并正确返回', () => {
  const run = runtime(), c = run.controller;
  assert.equal(c.settingsNavigation.hidden, true);
  run.methods.openSettings();
  assert.deepEqual(Array.from(c.settingsNavigationButtons, view => view.title), ['题型工具', '题目工具', '题卡工具', '关于插件']);
  const sections = [c.categorySettingsSection, c.questionToolsSettingsSection, c.cardToolsSettingsSection, c.aboutSettingsSection];
  for (const width of [560, 960]) {
    c.view.frame = { x: 0, y: 0, width, height: 420 }; run.methods.viewDidLayoutSubviews();
    const capsule = c.settingsNavigationCapsule.frame;
    assert.equal(capsule.x + capsule.width / 2, width / 2);
    assert.equal(c.settingsNavigation.frame.height, 48);
    assert.equal(c.settingsNavigation.superview, c.containerView);
    assert.equal(c.settingsPage.frame.y, c.webView.frame.y);
    for (let index = 0; index < 4; index++) {
      run.methods.selectSettingsSection(c.settingsNavigationButtons[index]);
      assert.deepEqual(Array.from(sections, view => view.hidden), sections.map((_, item) => item !== index));
      assert.equal(c.settingsNavigationButtons[index].selected, true);
      assert.ok(c.settingsPage.contentSize.height >= sections[index].frame.y + sections[index].frame.height + 16);
      const target = c.settingsNavigationButtons[index].frame;
      assert.ok(target.x >= 0 && target.x + target.width <= capsule.width);
      assert.equal(sections[index].frame.y, 68);
    }
    run.methods.selectSettingsSection(c.settingsNavigationButtons[1]);
    c.settingsPage.contentOffset = { x: 0, y: 250 };
    run.methods.selectSettingsSection(c.settingsNavigationButtons[2]);
    assert.equal(c.settingsPage.contentOffset.y, 0);
    run.methods.selectSettingsSection(c.settingsNavigationButtons[1]);
    assert.equal(c.settingsPage.contentOffset.y, 250);
    run.methods.selectSettingsSection({ tag: 3 }); assert.equal(c.settingsSection, 'question');
    run.methods.openDaguanyuan(); assert.equal(c.settingsNavigation.hidden, true);
    assert.equal(c.webView.hidden, false);
    run.methods.selectSettingsSection(c.settingsNavigationButtons[3]); assert.equal(c.settingsSection, 'question');
    run.methods.openSettings(); assert.equal(c.settingsNavigation.hidden, false);
    assert.equal(c.settingsSection, 'question'); assert.equal(c.settingsPage.contentOffset.y, 250);
  }
  c.view.frame = { x: 0, y: 0, width: 960, height: 1000 }; run.methods.viewDidLayoutSubviews();
  assert.equal(c.settingsPage.contentOffset.y, 0);
});

test('关于插件显示清单版本与作者，使用说明打开论坛且移除版本更新，重置只调整窗口', () => {
  const run = runtime(), c = run.controller, opened = [], messages = [];
  let studyBounds = { x: 0, y: 0, width: 1200, height: 900 };
  run.context.Application = { sharedInstance: () => ({
    openURL: url => opened.push(url), showHUD: text => messages.push(text),
    studyController: () => ({ view: { bounds: studyBounds } }),
  }) };
  run.methods.openSettings();
  run.methods.openPluginGuide(); assert.deepEqual(opened, []);
  run.methods.selectSettingsSection(c.settingsNavigationButtons[3]);
  const manifest = run.context.__DAGUANYUAN_PLUGIN_INFO__;
  assert.equal(c.aboutSettingsRows[0].description.text, 'v' + manifest.version + ' · ' + manifest.author);
  run.methods.openPluginGuide();
  assert.equal(run.methods.openPluginReleases, undefined);
  assert.equal(c.aboutSettingsRows.length, 3);
  assert.deepEqual(opened, ['https://bbs.marginnote.com.cn/t/topic/68358']);
  for (const width of [560, 960]) {
    c.view.frame = { x: 0, y: 0, width, height: 420 }; run.methods.viewDidLayoutSubviews();
    for (const row of c.aboutSettingsRows) for (const view of [row.title, row.description, row.divider, row.button, row.chevron].filter(Boolean)) {
      assert.ok(view.frame.x + view.frame.width <= c.aboutSettingsSection.frame.width);
      assert.ok(view.frame.y + view.frame.height <= c.aboutSettingsSection.frame.height);
    }
  }
  const before = c.selectionImportSwitch.on;
  run.methods.resetSettingsPanelFrame();
  assert.deepEqual(JSON.parse(JSON.stringify(c.view.frame)), { x: 120, y: 80, width: 960, height: 656 });
  for (const bounds of [{ x: 0, y: 0, width: 1024, height: 768 }, { x: 0, y: 0, width: 760, height: 600 },
    { x: 0, y: 0, width: 560, height: 420 }, { x: 16, y: 20, width: 1180, height: 900 }]) {
    studyBounds = bounds;
    run.methods.resetSettingsPanelFrame();
    assert.equal(c.view.frame.y, bounds.y + 80);
    assert.ok(c.view.frame.y + c.view.frame.height <= bounds.y + bounds.height - 64);
    assert.ok(c.view.frame.height <= 656);
    assert.equal(c.view.frame.x + c.view.frame.width / 2, bounds.x + bounds.width / 2);
  }
  assert.deepEqual(run.stored.get('cn.marginnote.daguanyuan-bridge.panel-frame'), c.view.frame);
  assert.equal(c.activePage, 'settings'); assert.equal(c.settingsSection, 'about');
  assert.equal(c.selectionImportSwitch.on, before); assert.equal(messages.at(-1), '已恢复窗口位置与大小');
  assert.equal(c.resetFrameButton, undefined);
  assert.equal(c.closeButton.action, 'closePanel:');
  assert.equal(c.closeButton.title, '×');
  const doubleTap = c.titleBar.gestures.find(gesture => gesture.numberOfTapsRequired === 2);
  assert.ok(doubleTap);
  assert.equal(doubleTap.cancelsTouchesInView, false);
  assert.equal(doubleTap.delaysTouchesBegan, false);
  assert.equal(doubleTap.delaysTouchesEnded, false);
  assert.equal(doubleTap.requiredToFail.action, 'movePanel:');
  const doubleTapAction = run.methods[doubleTap.action.replace(':', '')];
  const movedFrame = { x: 200, y: 200, width: 560, height: 420 };
  c.view.frame = movedFrame;
  doubleTap.point = { x: 10, y: 15 }; doubleTap.state = 1;
  doubleTapAction(doubleTap); assert.deepEqual(c.view.frame, movedFrame);
  doubleTap.state = 3;
  for (const control of [c.homeButton, c.os408Button, c.importButton, c.settingsButton, c.closeButton]) {
    doubleTap.point = { x: control.frame.x + control.frame.width / 2, y: control.frame.y + control.frame.height / 2 };
    doubleTapAction(doubleTap); assert.deepEqual(c.view.frame, movedFrame);
  }
  c.webView.loadRequest = () => assert.fail('恢复窗口位置不应重新加载网页');
  const currentTask = { status: 'running' }; c.importWorkspaceTask = currentTask;
  for (const page of ['math', '408', 'import', 'settings', 'category-manager']) {
    c.activePage = page; c.view.frame = { x: 200, y: 200, width: 560, height: 420 };
    doubleTap.point = { x: 10, y: 15 }; doubleTapAction(doubleTap);
    assert.equal(c.activePage, page); assert.equal(c.importWorkspaceTask, currentTask);
    assert.equal(currentTask.cancelled, undefined);
    assert.equal(c.view.frame.y, studyBounds.y + 80);
    assert.ok(c.settingsButton.frame.x + c.settingsButton.frame.width < c.closeButton.frame.x);
    assert.deepEqual(run.stored.get('cn.marginnote.daguanyuan-bridge.panel-frame'), c.view.frame);
  }
});

test('仅默认与重置预留底部工具栏，普通恢复、移动和缩放保持原有行为', () => {
  const key = 'cn.marginnote.daguanyuan-bridge.panel-frame';
  for (const bounds of [{x:0,y:0,width:1024,height:768}, {x:0,y:0,width:760,height:600},
    {x:0,y:0,width:560,height:420}, {x:16,y:20,width:1180,height:900}]) {
    const run = runtime(new Map([[key,{x:200,y:200,width:960,height:680}]])), c = run.controller;
    const parent = { bounds, addSubview(view) { view.superview=this; } };
    run.context.Application = { sharedInstance: () => ({ studyController: () => ({view:parent}), showHUD() {} }) };
    const withinTools = () => {
      const frame = c.view.frame;
      assert.ok(frame.y >= bounds.y+80);
      assert.ok(frame.y+frame.height <= bounds.y+bounds.height-64);
      assert.ok(frame.x >= bounds.x+12);
      assert.ok(frame.x+frame.width <= bounds.x+bounds.width-12);
    };
    run.context.__DAGUANYUAN_WEB_PANEL_GLOBAL__.showPanel(c);
    assert.equal(c.view.frame.height,Math.min(680,bounds.height-24));
    if (bounds.height===768) {
      c.view.frame={x:32,y:80,width:960,height:656};
      run.methods.resizePanel({state:3,translationInView:()=>({x:1,y:0}),setTranslationInView(){}});
      assert.equal(c.view.frame.height,656);
      assert.equal(c.view.frame.width,961);
    }
    let translation={x:10000,y:10000};
    const gesture={state:2,translationInView:()=>translation,setTranslationInView(point){translation=point;}};
    run.methods.movePanel(gesture);
    const movedFrame = { ...c.view.frame };
    gesture.state=3; run.methods.movePanel(gesture);
    assert.deepEqual({ ...c.view.frame },movedFrame);
    assert.ok(c.view.frame.y+c.view.frame.height > bounds.y+bounds.height-64);
    assert.deepEqual(run.stored.get(key),c.view.frame);
    translation={x:500,y:2000}; run.methods.resizePanel(gesture);
    assert.equal(c.view.frame.height,bounds.height-24);
    assert.deepEqual(run.stored.get(key),c.view.frame);
    const beforeCancel = { ...c.view.frame };
    translation={x:-10000,y:-10000}; gesture.state=4; run.methods.movePanel(gesture);
    assert.equal(c.view.frame.x,beforeCancel.x-10000);
    assert.equal(c.view.frame.y,beforeCancel.y-10000);
    run.methods.resetSettingsPanelFrame();
    withinTools(); assert.deepEqual(run.stored.get(key),c.view.frame);
    const resetFrame={...c.view.frame};
    run.stored.delete(key);
    run.context.__DAGUANYUAN_WEB_PANEL_GLOBAL__.showPanel(c);
    assert.deepEqual({...c.view.frame},resetFrame);
  }
});

test('窗口靠近顶部、底部或越过边缘时，右下角缩放始终固定左上角', () => {
  const run=runtime(), c=run.controller;
  const bounds={x:0,y:0,width:1024,height:768};
  const parent={bounds,addSubview(view){view.superview=this;}};
  run.context.Application={sharedInstance:()=>({studyController:()=>({view:parent}),showHUD(){}})};
  c.view.superview=parent;
  for (const origin of [{x:32,y:0},{x:0,y:12},{x:350,y:600},{x:-30,y:-20}]) {
    c.view.frame={...origin,width:800,height:500};
    run.methods.resizePanel({state:3,translationInView:()=>({x:1,y:1}),setTranslationInView(){}});
    assert.deepEqual({...c.view.frame},{...origin,width:801,height:501});
    assert.deepEqual(run.stored.get('cn.marginnote.daguanyuan-bridge.panel-frame'),c.view.frame);
  }
  const stored={x:32,y:12,width:800,height:700};
  run.stored.set('cn.marginnote.daguanyuan-bridge.panel-frame',stored);
  run.context.__DAGUANYUAN_WEB_PANEL_GLOBAL__.showPanel(c);
  assert.deepEqual({...c.view.frame},stored);
  run.methods.resetSettingsPanelFrame();
  assert.deepEqual({...c.view.frame},{x:32,y:80,width:960,height:624});
});

test('滚动只移动设置内容，悬浮区域仅占胶囊宽度，连续切换滑块从当前画面接续', () => {
  const run = runtime(), c = run.controller, animations = [];
  run.context.CABasicAnimation = { animationWithKeyPath: keyPath => ({ keyPath }) };
  run.context.CAMediaTimingFunction = { functionWithControlPoints: (...points) => points };
  run.context.CATransaction = { begin() {}, commit() {}, setAnimationDuration(value) { this.duration = value; } };
  run.methods.openSettings();
  assert.ok(c.settingsNavigationSlider);
  const layer = c.settingsNavigationSlider.layer;
  layer.addAnimationForKey = (animation, key) => animations.push({ ...animation, key, duration: run.context.CATransaction.duration });
  layer.removeAnimationForKey = () => {};
  let presentation;
  layer.presentationLayer = () => presentation;
  const nativeFrame = JSON.parse(JSON.stringify(c.settingsNavigation.frame));
  assert.ok(nativeFrame.width < c.view.frame.width);
  c.settingsPage.contentOffset = { x: 0, y: 150 };
  run.methods.viewDidLayoutSubviews();
  assert.deepEqual(JSON.parse(JSON.stringify(c.settingsNavigation.frame)), nativeFrame);
  run.methods.selectSettingsSection(c.settingsNavigationButtons[1]);
  assert.equal(animations.at(-1).keyPath, 'position.x');
  assert.equal(animations.at(-1).duration, 0.45);
  assert.deepEqual(Array.from(animations.at(-1).timingFunction), [0.32, 0.72, 0, 1]);
  presentation = { position: { x: 110 } };
  run.methods.selectSettingsSection(c.settingsNavigationButtons[3]);
  assert.equal(animations.at(-1).fromValue, 110);
  assert.equal(animations.at(-1).toValue, c.settingsNavigationSlider.frame.x + c.settingsNavigationSlider.frame.width / 2);
  assert.equal(c.settingsSection, 'about');
  const target = c.settingsNavigationSlider.frame.x;
  run.methods.selectSettingsSection(c.settingsNavigationButtons[0]);
  assert.ok(c.settingsNavigationSlider.frame.x < target);
  assert.equal(c.settingsNavigationButtons[0].selected, true);
  assert.equal(c.settingsNavigationButtons[3].selected, false);
  layer.presentationLayer = () => { throw new Error('呈现层不可用'); };
  run.context.CABasicAnimation.animationWithKeyPath = () => { throw new Error('动画接口不可用'); };
  run.context.console = { log() {} };
  run.methods.selectSettingsSection(c.settingsNavigationButtons[2]);
  assert.equal(c.settingsSection, 'card'); assert.equal(c.cardToolsSettingsSection.hidden, false);
  assert.equal(c.settingsNavigationSlider.frame.x, c.settingsNavigationButtons[2].frame.x);
});

test('切换设置分类关闭未确认弹窗并使正在折叠的任务失效', async () => {
  const run = runtime(), c = run.controller;
  run.methods.openSettings(); run.methods.selectSettingsSection(c.settingsNavigationButtons[2]);
  run.methods.openImportedCardManagement(); assert.ok(c.cardLocationModeChoice);
  run.methods.selectSettingsSection(c.settingsNavigationButtons[0]); assert.equal(c.cardLocationModeChoice, null);
  run.methods.selectSettingsSection(c.settingsNavigationButtons[2]);
  let complete, isActive;
  run.context.__DAGUANYUAN_COMMENT_FOLD_GLOBAL__.batch = (addon, collapsed, progress, active) => {
    isActive = active; return new Promise(resolve => { complete = resolve; });
  };
  run.methods.openImportedCardManagement();
  run.methods.selectImportedCardManagement(c.cardLocationModeChoice.buttons[1]);
  await new Promise(resolve => setImmediate(resolve)); assert.equal(isActive(), true);
  run.methods.selectSettingsSection(c.settingsNavigationButtons[3]); assert.equal(isActive(), false);
  assert.equal(c.commentFoldOperation, null); assert.equal(c.commentFoldSwitch.enabled, true);
  complete({ changed: 1, unchanged: 0, skipped: 0, failed: [] });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(c.settingsSection, 'about');
});
