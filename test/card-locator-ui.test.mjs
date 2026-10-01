import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function runtime() {
  class View {
    constructor(frame) { this.frame = frame; this.bounds = { width: frame.width, height: frame.height }; this.children = []; this.layer = {}; this.titleLabel = {}; }
    addSubview(view) { view.superview = this; this.children.push(view); }
    removeFromSuperview() { this.superview.children = this.superview.children.filter(v => v !== this); this.superview = null; }
    setTitleForState(title) { this.title = title; }
    setTitleColorForState() {}
    addTargetActionForControlEvents(controller, selector) { this.target = controller; this.selector = selector; }
  }
  const context = { console, UIView: View, UIButton: View, UILabel: View, UIScrollView: View,
    UIColor: { whiteColor() { return {}; }, lightGrayColor() { return { colorWithAlphaComponent() { return {}; } }; }, darkGrayColor() { return {}; }, colorWithRedGreenBlueAlpha() { return {}; } },
    UIFont: { systemFontOfSize() { return {}; }, boldSystemFontOfSize() { return {}; } },
  };
  vm.createContext(context); vm.runInContext(fs.readFileSync(new URL('../src/DaguanyuanCardLocatorUI.js', import.meta.url), 'utf8'), context);
  return { controller: { containerView: new View({ width: 800, height: 620 }) }, ui: context.__DAGUANYUAN_CARD_LOCATOR_UI_GLOBAL__ };
}
const candidates = Array.from({ length: 12 }, (_, i) => ({ noteId: 'card-' + i, notebookId: 'book-' + i, studySetTitle: '学习集 ' + i, title: '2026年 第44题', path: '408 / 2026 / 章节' }));

test('题卡选择列表显示学习集和路径，可滚动、调整尺寸并选择指定卡片', async () => {
  const { controller, ui } = runtime(); const pending = ui.choose(controller, candidates); const choice = controller.cardLocationChoice;
  assert.equal(controller.containerView.children.length, 1); assert.equal(choice.buttons.length, 12);
  assert.match(choice.buttons[10].title, /学习集 10\n408 \/ 2026 \/ 章节 \/ 2026年 第44题/);
  assert.equal(choice.buttons[10].selector, 'selectCardLocationChoice:'); assert.equal(choice.buttons[10].tag, 10);
  assert.ok(choice.scroll.contentSize.height > choice.scroll.frame.height);
  controller.containerView.bounds = { width: 960, height: 700 }; ui.layout(controller);
  assert.equal(choice.view.frame.width, 936); assert.equal(choice.buttons[0].frame.width, 912);
  ui.select(controller, 10, choice.buttons[10]); assert.equal((await pending).noteId, 'card-10');
  assert.equal(controller.cardLocationChoice, null); assert.equal(controller.containerView.children.length, 0);
});

test('取消、重开选择列表及迟到的旧按钮事件不会跳到错误卡片', async () => {
  const { controller, ui } = runtime();
  const first = ui.choose(controller, candidates); const oldButton = controller.cardLocationChoice.buttons[0];
  const rejected = assert.rejects(first, /取消/); ui.cancel(controller); await rejected;
  const second = ui.choose(controller, candidates); ui.select(controller, 0, oldButton);
  assert.ok(controller.cardLocationChoice); ui.select(controller, -1); assert.ok(controller.cardLocationChoice);
  const currentButton = controller.cardLocationChoice.buttons[1]; ui.select(controller, 1, currentButton);
  assert.equal((await second).noteId, 'card-1'); assert.equal(controller.containerView.children.length, 0);
  await assert.rejects(ui.choose({}, candidates), /选择窗口不可用/);
});
