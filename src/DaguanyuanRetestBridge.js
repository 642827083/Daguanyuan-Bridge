var __DAGUANYUAN_RETEST_BRIDGE_GLOBAL__ = (function () {
  function script(enabled, noteEnabled) {
    // 复测页与练题页共用按钮识别、开关和忙碌状态，避免两套观察器重复插入。
    return __DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__.practiceScript(enabled !== false, Boolean(noteEnabled));
  }
  return { script };
})();
