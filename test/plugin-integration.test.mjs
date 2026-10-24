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
    setTitleColorForState(color, state) { if (state === 0) this.textColor = color; }
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
    UIView:View,UILabel:View,UIButton:View,UIWebView:View,UIScrollView:View,UISwitch:View,UIImageView:View,UIPanGestureRecognizer:Gesture,UITapGestureRecognizer:Gesture,
    UIImage:{imageWithContentsOfFile(file){return {file,size:file.endsWith('alipay.jpg')?{width:600,height:899}:{width:600,height:814}};}},
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
    __DAGUANYUAN_MASTERY_UI_GLOBAL__:{enabled(){return true;}},self:{addon:{window:{},__daguanyuanAddonPath:'/addon'}}
  };
  context.__DAGUANYUAN_PLUGIN_INFO__ = JSON.parse(readFileSync(new URL('../src/mnaddon.json', import.meta.url), 'utf8'));
  vm.createContext(context);
  for(const name of ['DaguanyuanSourceLink','DaguanyuanCardComments','DaguanyuanCommentFold','DaguanyuanCardLocatorUI','DaguanyuanVideoBrowser','DaguanyuanCardToolsSettings','DaguanyuanPluginIntegrationSettings','DaguanyuanAboutSettings','DaguanyuanSupportUI','DaguanyuanDiagnosticUI','DaguanyuanSettingsNavigation','DaguanyuanPanelNavigation','WebPanelController'])
    vm.runInContext(readFileSync(new URL('../src/'+name+'.js',import.meta.url),'utf8'),context);
  methods.viewDidLoad();
  return {controller:context.self,methods,stored,context};
}

test('主导航白底文字在窄宽窗口居中，下划线对齐选中文字，关闭按钮无圆底且保留点击范围', () => {
  const run = runtime(), c = run.controller;
  assert.deepEqual(Array.from(c.mainNavigationButtons, view => view.title), ['数学', '408', '设置']);
  assert.deepEqual(Array.from(c.mainNavigationButtons, view => view.action), ['openDaguanyuan:', 'open408:', 'openSettings:']);
  assert.equal(c.importButton.hidden, true); assert.equal(c.importButton.enabled, false);
  for (const width of [300, 560, 960, 1300]) {
    c.view.frame = { x: 0, y: 0, width, height: 656 }; run.methods.viewDidLayoutSubviews();
    const nav = c.mainNavigation.frame;
    assert.equal(c.titleBar.frame.height, 44); assert.equal(nav.x + nav.width / 2, width / 2); assert.ok(nav.width <= 328);
    assert.ok(nav.x + nav.width < c.closeButton.frame.x);
    assert.equal(c.closeButton.frame.width, 44); assert.equal(c.closeButton.frame.height, 44);
    assert.equal(c.closeButtonBackground, undefined); assert.equal(c.mainNavigationBackground, undefined);
    for (const view of [c.webView, c.importWebView, c.settingsPage]) { assert.equal(view.frame.y, 44); assert.equal(view.frame.height, 612); }
    for (const [index, button] of c.mainNavigationButtons.entries()) {
      assert.equal(button.superview, c.mainNavigation); assert.equal(button.frame.height, 44);
      assert.ok(button.frame.x >= 0 && button.frame.x + button.frame.width <= nav.width);
      if (index) assert.ok(c.mainNavigationButtons[index - 1].frame.x + c.mainNavigationButtons[index - 1].frame.width <= button.frame.x);
    }
    assert.equal(c.mainNavigationIndicator.frame.height, 3); assert.equal(c.mainNavigationIndicator.frame.width, 24);
    assert.equal(c.mainNavigationIndicator.frame.x + 12, c.homeButton.frame.x + c.homeButton.frame.width / 2);
    assert.ok(c.mainNavigationIndicator.frame.y + 3 <= c.titleBar.frame.height);
    assert.equal(c.mainNavigationIndicator.layer.shadowOpacity, undefined);
    assert.equal(c.mainNavigationButtons[0].selected, true);
  }
});

test('主导航连续切换从当前下划线位置接续，重复点击不重播动画，动画缺失仍可切换和缩放', () => {
  const run = runtime(), c = run.controller, animations = []; let presentation;
  run.context.CABasicAnimation = { animationWithKeyPath: keyPath => ({ keyPath }) };
  run.context.CAMediaTimingFunction = { functionWithControlPoints: (...values) => values };
  run.context.CATransaction = { begin() {}, commit() {}, setAnimationDuration(value) { this.duration = value; } };
  const layer = c.mainNavigationIndicator.layer;
  layer.addAnimationForKey = (animation, key) => animations.push({ ...animation, key, duration: run.context.CATransaction.duration });
  layer.removeAnimationForKey = () => {};
  layer.presentationLayer = () => presentation;
  run.methods.openSettings(); assert.equal(c.settingsButton.selected, true); assert.equal(c.homeButton.selected, false);
  assert.equal(animations.at(-1).keyPath, 'position.x'); assert.equal(animations.at(-1).duration, 0.22);
  const count = animations.length; run.methods.openSettings(); assert.equal(animations.length, count);
  presentation = { position: { x: 160 } }; run.methods.open408();
  assert.equal(c.os408Button.selected, true); assert.equal(animations.at(-1).fromValue, 160);
  assert.equal(animations.at(-1).toValue, c.mainNavigationIndicator.frame.x + c.mainNavigationIndicator.frame.width / 2);
  run.context.__DAGUANYUAN_CATEGORY_MANAGER_UI_GLOBAL__.refresh = () => {};
  run.methods.openCategoryManager(); assert.equal(c.settingsButton.selected, true); assert.equal(c.os408Button.selected, false);
  layer.presentationLayer = () => { throw Error('呈现层不可用'); };
  run.context.CABasicAnimation.animationWithKeyPath = () => { throw Error('动画不可用'); };
  run.context.console = { log() {} }; run.methods.openDaguanyuan(); assert.equal(c.homeButton.selected, true);
  c.view.frame = { x: 0, y: 0, width: 300, height: 420 }; run.methods.viewDidLayoutSubviews();
  assert.equal(c.mainNavigationIndicator.frame.x + c.mainNavigationIndicator.frame.width / 2, c.homeButton.frame.x + c.homeButton.frame.width / 2);
  assert.ok(c.mainNavigationIndicator.frame.width < c.homeButton.frame.width);
});

test('拖动和双击只绑定两侧空白区，导航与关闭按钮不包含窗口手势，关闭面板清理下划线动画', () => {
  const run = runtime(), c = run.controller;
  const inside = (rect, point) => point.x >= rect.x && point.x < rect.x + rect.width && point.y >= rect.y && point.y < rect.y + rect.height;
  assert.equal(c.titleBar.gestures, undefined);
  for (const view of [c.mainNavigation, c.mainNavigationIndicator, c.closeButton, ...c.mainNavigationButtons]) assert.equal(view.gestures, undefined);
  for (const view of c.titleBarDragRegions) {
    assert.deepEqual(Array.from(view.gestures, gesture => gesture.action), ['movePanel:', 'resetPanelOnDoubleTap:']);
    const p = { x: view.frame.x + view.frame.width / 2, y: 22 };
    assert.equal(run.context.__DAGUANYUAN_PANEL_NAVIGATION_GLOBAL__.isBlankPoint(c, p), true);
    assert.equal(inside(c.mainNavigation.frame, p), false); assert.equal(inside(c.closeButton.frame, p), false);
  }
  for (const button of c.mainNavigationButtons) {
    const point = { x: c.mainNavigation.frame.x + button.frame.x + button.frame.width / 2, y: 22 };
    assert.equal(run.context.__DAGUANYUAN_PANEL_NAVIGATION_GLOBAL__.isBlankPoint(c, point), false);
  }
  const removed = []; c.mainNavigationIndicator.layer.removeAnimationForKey = key => removed.push(key);
  run.context.NSTimer = { scheduledTimerWithTimeInterval() {} }; run.methods.closePanel();
  assert.deepEqual(removed, ['daguanyuan.panel.navigation']);
});

test('诊断日志入口只在关于插件可用，导出复制分发正确，清空二次确认且拒绝旧按钮', () => {
  const run = runtime(), c = run.controller, calls = [], messages = [];
  run.context.Application = { sharedInstance: () => ({ showHUD: message => messages.push(message) }) };
  run.context.__DAGUANYUAN_DIAGNOSTICS_GLOBAL__ = { exportFile() { calls.push('export'); }, copy() { calls.push('copy'); }, clear() { calls.push('clear'); return true; } };
  run.methods.openDiagnosticLogs(); assert.equal(c.cardLocationModeChoice, undefined);
  run.methods.openSettings(); run.methods.openDiagnosticLogs(); assert.equal(c.cardLocationModeChoice, undefined);
  run.methods.selectSettingsSection(c.settingsNavigationButtons[3]);
  run.methods.openDiagnosticLogs(); let menu = c.cardLocationModeChoice;
  assert.deepEqual(Array.from(menu.buttons, button => button.title), ['导出日志', '复制日志', '清空日志', '取消']);
  run.methods.selectDiagnosticLogAction(menu.buttons[0]); assert.deepEqual(calls, ['export']);
  run.methods.openDiagnosticLogs(); menu = c.cardLocationModeChoice;
  run.methods.selectDiagnosticLogAction(menu.buttons[1]); assert.deepEqual(calls, ['export', 'copy']); assert.equal(messages.at(-1), '诊断日志已复制');
  run.methods.openDiagnosticLogs(); menu = c.cardLocationModeChoice; const old = menu.buttons[2];
  run.methods.selectDiagnosticLogAction(old); menu = c.cardLocationModeChoice;
  assert.equal(menu.title.text, '确定清空全部诊断日志？'); assert.equal(calls.includes('clear'), false);
  run.methods.selectDiagnosticLogAction(old); assert.equal(c.cardLocationModeChoice, menu);
  run.methods.selectDiagnosticLogAction(menu.buttons[1]); assert.equal(calls.includes('clear'), false);
  run.methods.openDiagnosticLogs(); run.methods.selectDiagnosticLogAction(c.cardLocationModeChoice.buttons[2]);
  run.methods.selectDiagnosticLogAction(c.cardLocationModeChoice.buttons[0]); assert.equal(calls.at(-1), 'clear'); assert.equal(messages.at(-1), '诊断日志已清空');
  run.methods.openDiagnosticLogs(); run.methods.selectSettingsSection(c.settingsNavigationButtons[0]); assert.equal(c.cardLocationModeChoice, null);
  run.methods.selectSettingsSection(c.settingsNavigationButtons[3]); run.methods.openDiagnosticLogs(); run.methods.openDaguanyuan(); assert.equal(c.cardLocationModeChoice, null);
});

test('日志导出失败显示替代操作，清空保存失败不会提示成功', () => {
  const run = runtime(), c = run.controller, messages = [];
  run.context.Application = { sharedInstance: () => ({ showHUD: message => messages.push(message) }) };
  run.context.__DAGUANYUAN_DIAGNOSTICS_GLOBAL__ = { exportFile() { throw Error('日志导出文件写入失败，请使用复制日志'); }, clear() { return false; } };
  run.methods.openSettings(); run.methods.selectSettingsSection(c.settingsNavigationButtons[3]);
  run.methods.openDiagnosticLogs(); run.methods.selectDiagnosticLogAction(c.cardLocationModeChoice.buttons[0]);
  assert.match(messages.at(-1), /使用复制日志/);
  run.methods.openDiagnosticLogs(); run.methods.selectDiagnosticLogAction(c.cardLocationModeChoice.buttons[2]); run.methods.selectDiagnosticLogAction(c.cardLocationModeChoice.buttons[0]);
  assert.match(messages.at(-1), /本机文件清空失败/);
});

test('自动折叠开关与独立修复入口保留在外，查看原题显示使用弹窗，窄宽布局均不遮挡', async () => {
  const run = runtime(), c = run.controller, messages = [];
  run.context.Application = { sharedInstance: () => ({ showHUD: message => messages.push(message) }) };
  assert.equal(c.commentFoldSwitch.on, false);
  assert.equal(c.commentFoldTitle.text, '自动折叠查看原题');
  assert.equal(c.cardManagementTitle.text, '查看原题显示');
  assert.equal(c.repairCardsTitle.text, '修复题卡格式'); assert.equal(c.repairCardsButton.action, 'repairImportedCards:');
  assert.equal(c.foldSourceCommentsButton, undefined); assert.equal(c.unfoldSourceCommentsButton, undefined);
  run.methods.toggleSourceCommentFold({ on: true }); assert.equal(c.commentFoldSwitch.on, true);
  const restored = runtime(run.stored); assert.equal(restored.controller.commentFoldSwitch.on, true);
  run.methods.toggleSourceCommentFold({ on: false });
  for (const width of [560, 960]) {
    c.view.frame = { x: 0, y: 0, width, height: 680 }; run.methods.viewDidLayoutSubviews();
    for (const key of ['commentFoldTitle', 'commentFoldDescription', 'commentFoldSwitch', 'cardManagementTitle', 'cardManagementDescription', 'cardManagementChevron', 'cardManagementButton', 'repairCardsTitle', 'repairCardsDescription', 'repairCardsChevron', 'repairCardsButton']) {
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
  assert.deepEqual(Array.from(menu.buttons, row => row.title), ['折叠查看原题', '展开查看原题', '取消']);
  assert.equal(menu.sheet.frame.width, 360); assert.equal(menu.sheet.layer.cornerRadius, 12);
  assert.equal(menu.sheet.frame.height, 224);
  assert.equal(c.commentFoldSwitch.superview, c.cardToolsSettingsSection);
  run.methods.selectImportedCardManagement(menu.buttons[0]);
  assert.equal(c.cardManagementButton.enabled, false);
  assert.equal(c.repairCardsButton.enabled, false);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(c.cardManagementButton.enabled, true); assert.match(messages.at(-1), /已折叠 1/);
  run.methods.openImportedCardManagement(); menu = c.cardLocationModeChoice;
  run.methods.selectImportedCardManagement(menu.buttons[1]); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, [true, false]); assert.match(messages.at(-1), /已展开 1/);
  c.categoryImportBusy = true; run.methods.openImportedCardManagement(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, 2); assert.match(messages.at(-1), /请先完成/);
});

test('修复使用独立入口，查看原题弹窗取消及旧按钮不触发操作，切换页面清理弹窗', () => {
  const run = runtime(), c = run.controller; c.activePage = 'settings'; const repairs = [];
  run.context.Application = { sharedInstance: () => ({ showHUD() {} }) };
  run.context.__DAGUANYUAN_CARD_REPAIR_UI_GLOBAL__ = { repair: target => repairs.push(target), cancel() {} };
  run.methods.openImportedCardManagement(); let menu = c.cardLocationModeChoice;
  const old = menu.buttons[0];
  run.methods.selectImportedCardManagement(menu.buttons[2]); assert.equal(repairs.length, 0); assert.equal(c.cardLocationModeChoice, null);
  run.methods.openImportedCardManagement(); menu = c.cardLocationModeChoice;
  run.methods.selectImportedCardManagement(old); assert.equal(repairs.length, 0); assert.equal(c.cardLocationModeChoice, menu);
  run.methods.repairImportedCards(); assert.deepEqual(repairs, [c]);
  c.commentFoldOperation = {}; run.methods.repairImportedCards(); assert.equal(repairs.length, 1); c.commentFoldOperation = null;
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
    const capsule = c.settingsNavigation.frame;
    assert.equal(capsule.x + capsule.width / 2, width / 2);
    assert.equal(c.settingsNavigation.frame.height, 48);
    assert.equal(c.settingsNavigation.superview, c.containerView);
    assert.ok(c.containerView.subviews.indexOf(c.settingsNavigation) > c.containerView.subviews.indexOf(c.settingsPage));
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

test('关于插件说明与反馈打开论坛，视频教程打开小红书，重置只调整窗口', () => {
  const run = runtime(), c = run.controller, opened = [], messages = [];
  let studyBounds = { x: 0, y: 0, width: 1200, height: 900 };
  run.context.Application = { sharedInstance: () => ({
    openURL: url => opened.push(url), showHUD: text => messages.push(text),
    studyController: () => ({ view: { bounds: studyBounds } }),
  }) };
  run.methods.openSettings();
  run.methods.openPluginGuide(); run.methods.openPluginVideoGuide(); assert.deepEqual(opened, []);
  run.methods.selectSettingsSection(c.settingsNavigationButtons[3]);
  const manifest = run.context.__DAGUANYUAN_PLUGIN_INFO__;
  assert.equal(c.aboutSettingsRows[0].description.text, 'v' + manifest.version + ' · ' + manifest.author);
  run.methods.openPluginGuide();
  run.methods.openPluginVideoGuide();
  assert.equal(run.methods.openPluginReleases, undefined);
  assert.equal(c.aboutSettingsRows.length, 6);
  assert.equal(c.aboutSettingsRows[2].title.text, '插件说明与反馈');
  assert.equal(c.aboutSettingsRows[2].description.text, '查看使用说明，反馈问题与建议');
  assert.equal(c.aboutSettingsRows[2].button.action, 'openPluginGuide:');
  assert.equal(c.aboutSettingsRows[3].title.text, '视频教程');
  assert.equal(c.aboutSettingsRows[3].description.text, '前往小红书，观看视频教程');
  assert.equal(c.aboutSettingsRows[3].button.action, 'openPluginVideoGuide:');
  assert.equal(c.aboutSettingsRows[4].title.text, '诊断日志');
  assert.equal(c.aboutSettingsRows[4].button.action, 'openDiagnosticLogs:');
  assert.equal(c.aboutSettingsRows[4].chevron.text, c.cardManagementChevron.text);
  assert.equal(c.aboutSettingsRows[5].title.text, '支持项目');
  assert.equal(c.aboutSettingsRows[5].description.text, '喜欢此插件？请开发者喝杯咖啡，支持持续更新');
  assert.equal(c.aboutSettingsRows[5].chevron.text, c.cardManagementChevron.text);
  assert.equal(c.aboutSettingsRows[5].button.action, 'openSupportProject:');
  assert.deepEqual(opened, ['https://bbs.marginnote.com.cn/t/topic/68358',
    'https://www.xiaohongshu.com/discovery/item/6ad57577000000002f0300d6?source=webshare&xhsshare=pc_web&xsec_token=ABZn-MWTtkL0pF7UItkEfZpMpyI0adIy5yJMHE20GAnqw=&xsec_source=pc_share']);
  for (const width of [560, 960]) {
    c.view.frame = { x: 0, y: 0, width, height: 420 }; run.methods.viewDidLayoutSubviews();
    for (const row of c.aboutSettingsRows) for (const view of [row.title, row.description, row.divider, row.button, row.chevron].filter(Boolean)) {
      assert.ok(view.frame.x + view.frame.width <= c.aboutSettingsSection.frame.width);
      assert.ok(view.frame.y + view.frame.height <= c.aboutSettingsSection.frame.height);
    }
    assert.ok(c.settingsPage.contentSize.height >= c.aboutSettingsSection.frame.y + c.aboutSettingsSection.frame.height);
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
  const doubleTap = c.titleBarDragRegions[0].gestures.find(gesture => gesture.numberOfTapsRequired === 2);
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
  for (const control of [c.homeButton, c.os408Button, c.settingsButton, c.closeButton]) {
    doubleTap.point = { x: (control.superview === c.mainNavigation ? c.mainNavigation.frame.x : 0) + control.frame.x + control.frame.width / 2, y: control.frame.y + control.frame.height / 2 };
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
    assert.ok(c.mainNavigation.frame.x + c.mainNavigation.frame.width < c.closeButton.frame.x);
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

test('支持弹窗使用本地原图，宽窗并列、窄窗滚动，缩放保持比例与关闭按钮可见', () => {
  const run = runtime(), c = run.controller;
  run.methods.openSupportProject(); assert.equal(c.supportProjectPopup, undefined);
  run.methods.openSettings(); run.methods.selectSettingsSection(c.settingsNavigationButtons[3]);
  run.methods.openSupportProject(); const popup = c.supportProjectPopup;
  assert.equal(popup.title.text, '💗 支持项目');
  assert.equal(popup.intro.text, '插件功能全部免费，任意打赏，感谢你的支持，让插件持续更新！');
  assert.equal(popup.intro.numberOfLines, 0);
  assert.equal(popup.closeButton.action, 'closeSupportProject:');
  assert.equal(popup.closeButton.superview, popup.header);
  assert.deepEqual(Array.from(popup.cards, card => card.imageView.image.file), ['/addon/support/alipay.jpg', '/addon/support/wechat.jpg']);
  const count = c.containerView.subviews.length; run.methods.openSupportProject();
  assert.equal(c.supportProjectPopup, popup); assert.equal(c.containerView.subviews.length, count);
  for (const [width, height] of [[560, 420], [960, 656], [1300, 900], [300, 250]]) {
    c.view.frame = { x: 0, y: 0, width, height }; popup.scroll.contentOffset = { y: 10000 };
    run.methods.viewDidLayoutSubviews();
    assert.ok(popup.sheet.frame.x >= 0 && popup.sheet.frame.y >= 0);
    assert.ok(popup.sheet.frame.x + popup.sheet.frame.width <= width);
    assert.equal(popup.overlay.frame.y, c.titleBar.frame.height);
    assert.ok(popup.sheet.frame.y + popup.sheet.frame.height <= height - c.titleBar.frame.height);
    assert.equal(popup.closeButton.frame.width, 44); assert.equal(popup.closeButton.frame.height, 44);
    assert.ok(popup.closeButton.frame.x + 44 <= popup.sheet.frame.width);
    const [alipay, wechat] = popup.cards;
    assert.ok(popup.intro.frame.y + popup.intro.frame.height <= alipay.imageView.frame.y);
    assert.ok(popup.intro.frame.height >= Math.ceil(popup.intro.text.length * 15 / popup.intro.frame.width) * 20);
    assert.equal(alipay.imageView.frame.y === wechat.imageView.frame.y, width >= 960);
    for (const card of popup.cards) {
      const image = card.imageView.frame;
      assert.ok(image.width > 0 && image.x >= 0 && image.x + image.width <= popup.sheet.frame.width);
      assert.ok(Math.abs(image.height / image.width - card.ratio) < 1e-8);
      assert.ok(card.caption.frame.y + card.caption.frame.height <= popup.scroll.contentSize.height);
    }
    assert.ok(popup.scroll.contentOffset.y <= Math.max(0, popup.scroll.contentSize.height - popup.scroll.frame.height));
    if (width === 560) assert.ok(popup.scroll.contentSize.height > popup.scroll.frame.height);
  }
  run.methods.closeSupportProject(); assert.equal(c.supportProjectPopup, null);
  assert.equal(popup.overlay.superview, null); assert.equal(c.settingsSection, 'about');
  assert.equal(c.settingsPage.hidden, false);
});

test('切换页面、设置分类和关闭面板清理支持弹窗，图片缺失时提示且允许重试', () => {
  const run = runtime(), c = run.controller, messages = [];
  run.context.Application = { sharedInstance: () => ({ showHUD: message => messages.push(message) }) };
  run.context.NSTimer = { scheduledTimerWithTimeInterval() {} };
  const open = () => { run.methods.openSettings(); run.methods.selectSettingsSection(c.settingsNavigationButtons[3]); run.methods.openSupportProject(); assert.ok(c.supportProjectPopup); };
  open(); run.methods.selectSettingsSection(c.settingsNavigationButtons[0]); assert.equal(c.supportProjectPopup, null);
  open(); c.currentContentPage = 'math'; run.methods.openDaguanyuan(); assert.equal(c.supportProjectPopup, null);
  open(); run.methods.closePanel(); assert.equal(c.supportProjectPopup, null);
  run.methods.openSettings(); run.methods.selectSettingsSection(c.settingsNavigationButtons[3]);
  const load = run.context.UIImage.imageWithContentsOfFile;
  run.context.UIImage.imageWithContentsOfFile = () => null;
  run.methods.openSupportProject(); assert.equal(c.supportProjectPopup, null); assert.match(messages.at(-1), /图片读取失败/);
  run.context.UIImage.imageWithContentsOfFile = load;
  run.methods.openSupportProject(); assert.ok(c.supportProjectPopup); run.methods.closeSupportProject();
  c.addon.__daguanyuanAddonPath = ''; run.methods.openSupportProject(); assert.match(messages.at(-1), /资源目录/);
});

test('入口将宿主提供的插件根路径保存到对应实例，供支持弹窗读取包内图片', () => {
  const addon = { window: {} }, context = { console, self: addon, JSB: { require() {}, defineClass(name, methods) { return methods; } },
    __DAGUANYUAN_WEB_PANEL_GLOBAL__: { createController(owner) { assert.equal(owner, addon); return { addon: owner }; } } };
  vm.createContext(context);
  for (const name of ['WebAddon', 'main']) vm.runInContext(readFileSync(new URL('../src/' + name + '.js', import.meta.url), 'utf8'), context);
  const methods = context.JSB.newAddon('/installed/DaguanyuanBridge'); methods.sceneWillConnect();
  assert.equal(addon.__daguanyuanAddonPath, '/installed/DaguanyuanBridge');
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
