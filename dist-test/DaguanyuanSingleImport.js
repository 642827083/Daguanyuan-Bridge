var __DAGUANYUAN_SINGLE_IMPORT_GLOBAL__ = (function () {
  function targetFromAddress(address) {
    const match = String(address).match(/[?&]payload=([^&#]+)/);
    const target = match && JSON.parse(decodeURIComponent(match[1]));
    if (!target || typeof target.url !== "string") throw new Error("单题导入参数无效");
    if (target.provider === "math") {
      if (!/^https:\/\/(?:www\.)?cxyonly\.fans\/math\/practice\/\d+(?:[/?#]|$)/.test(target.url)) throw new Error("请在数学题目页导入单题");
      target.id = __DAGUANYUAN_MATH_API_GLOBAL__.positiveInteger(target.id, "题目 ID");
    } else if (target.provider === "408") {
      if (!/^https:\/\/www\.408os\.cn\/exercise\?/.test(target.url)) throw new Error("请在 408 题目页导入单题");
      target.year = __DAGUANYUAN_MATH_API_GLOBAL__.positiveInteger(target.year, "题目年份");
      target.number = __DAGUANYUAN_MATH_API_GLOBAL__.positiveInteger(target.number, "题号");
    } else throw new Error("题目来源无效");
    return target;
  }

  function readMathQuestion(id) {
    return new Promise(function (resolve, reject) {
      let settled = false;
      const timer = NSTimer.scheduledTimerWithTimeInterval(75, false, function () {
        if (settled) return;
        settled = true;
        reject(new Error("数学单题读取超时，请重试"));
      });
      function finish(question, error) {
        if (settled) return;
        settled = true;
        timer.invalidate();
        if (error) reject(error);
        else resolve(question);
      }
      try {
        __DAGUANYUAN_MATH_API_GLOBAL__.questionDetail(id).then(function (question) { finish(question); }, function (error) { finish(null, error); });
      } catch (error) { finish(null, error); }
    });
  }

  function importQuestion(controller, target) {
    // 在任何异步读取开始前固定父卡片，后续切换选择不会改变导入位置。
    const session = __DAGUANYUAN_MATH_IMPORT_GLOBAL__.preparedSingleSession(controller.addon, target.provider);
    if (target.provider === "408") return __DAGUANYUAN_408_IMPORT_GLOBAL__.importSingle(controller, target, session);
    const result = { total: 1, createdCount: 0, updatedCount: 0, skippedCount: 0, failed: [] };
    let stage = "读取题目图文";
    let source = "";
    return readMathQuestion(target.id).then(function (question) {
      if (!question || question.id !== target.id) throw new Error("数学题目 ID 与所点击题目不一致");
      source = question.source;
      stage = "MarginNote 建卡";
      const outcome = session.write(question, { url: target.url.split(/[?#]/)[0] });
      if (outcome === "updated") result.updatedCount = 1;
      else if (outcome) result.createdCount = 1;
      else result.skippedCount = 1;
      return result;
    }).catch(function (error) {
      result.failed.push({ questionId: target.id, source: source, stage: error.stage || stage,
        diagnostics: error.diagnostics, reason: String(error && error.message || error) });
      return result;
    });
  }
  return { targetFromAddress, importQuestion };
})();
