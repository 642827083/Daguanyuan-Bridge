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
  run.context.Application = { sharedInstance: () => ({
    openURL: url => opened.push(url), showHUD: text => messages.push(text),
    studyController: () => ({ view: { bounds: { x: 0, y: 0, width: 1200, height: 900 } } }),
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
  assert.deepEqual(JSON.parse(JSON.stringify(c.view.frame)), { x: 120, y: 110, width: 960, height: 680 });
  assert.deepEqual(run.stored.get('cn.marginnote.daguanyuan-bridge.panel-frame'), c.view.frame);
  assert.equal(c.activePage, 'settings'); assert.equal(c.settingsSection, 'about');
  assert.equal(c.selectionImportSwitch.on, before); assert.equal(messages.at(-1), '已恢复窗口位置与大小');
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
