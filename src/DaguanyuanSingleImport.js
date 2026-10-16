var __DAGUANYUAN_SINGLE_IMPORT_GLOBAL__ = (function () {
  const POSITION_KEY = "cn.marginnote.daguanyuan-bridge.question-tools.single-import-position";

  function position() {
    try {
      return String(NSUserDefaults.standardUserDefaults().objectForKey(POSITION_KEY)) === "sibling" ? "sibling" : "child";
    } catch (ignored) { return "child"; }
  }

  function setPosition(requested) {
    if (requested !== "child" && requested !== "sibling") throw new Error("导入本题位置无效");
    NSUserDefaults.standardUserDefaults().setObjectForKey(requested, POSITION_KEY);
  }

  function positionTitle(requested) {
    return requested === "sibling" ? "同级节点" : "子节点";
  }

  function targetFromAddress(address) {
    const match = String(address).match(/[?&]payload=([^&#]+)/);
    const target = match && JSON.parse(decodeURIComponent(match[1]));
    if (!target || typeof target.url !== "string") throw new Error("单题导入参数无效");
    if (target.provider === "math") {
      if (!/^https:\/\/(?:www\.)?cxyonly\.fans\/math\/(?:practice(?:\/(?:categories\/)?[1-9]\d*)?|questions\/[1-9]\d*|paper)\/?(?:[?#][^\s<>]*)?$/.test(target.url)) throw new Error("请在数学题目页导入本题");
      target.id = __DAGUANYUAN_MATH_API_GLOBAL__.positiveInteger(target.id, "题目 ID");
    } else if (target.provider === "408") {
      if (!/^https:\/\/www\.408os\.cn\/exercise\?/.test(target.url)) throw new Error("请在 408 题目页导入本题");
      target.year = __DAGUANYUAN_MATH_API_GLOBAL__.positiveInteger(target.year, "题目年份");
      target.number = __DAGUANYUAN_MATH_API_GLOBAL__.positiveInteger(target.number, "题号");
    } else throw new Error("题目来源无效");
    return target;
  }

  function readMathQuestion(id, controller) {
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
        const readImage = typeof __DAGUANYUAN_MATH_IMAGES_GLOBAL__ !== 'undefined' ? __DAGUANYUAN_MATH_IMAGES_GLOBAL__.reader(controller) : undefined;
        __DAGUANYUAN_MATH_API_GLOBAL__.questionDetail(id, 'question', readImage).then(function (question) { finish(question); }, function (error) { finish(null, error); });
      } catch (error) { finish(null, error); }
    });
  }

  function importQuestion(controller, target, requestedPosition, beforeImport, onProgress) {
    // 在任何异步读取开始前固定所选卡片和导入位置，后续切换选择或设置不改变本次落点。
    const session = __DAGUANYUAN_MATH_IMPORT_GLOBAL__.preparedSingleSession(controller.addon, target.provider, requestedPosition || position());
    if (target.provider === "408") return __DAGUANYUAN_408_IMPORT_GLOBAL__.importSingle(controller, target, session, beforeImport, onProgress);
    const result = { total: 1, createdCount: 0, answerAddedCount: 0, skippedCount: 0, failed: [] };
    if (session.hasQuestion(target.id)) {
      result.skippedCount = 1; return Promise.resolve(result);
    }
    let stage = "读取题目图文";
    let source = "";
    return readMathQuestion(target.id, controller).then(function (question) {
      if (!question || question.id !== target.id) throw new Error("数学题目 ID 与所点击题目不一致");
      source = question.source;
      return Promise.resolve(typeof beforeImport === "function" ? beforeImport({
        source: "大观园数学 / 单题", target: session.targetTitle,
        questions: [{ id: question.id, title: question.source || "题目 " + question.id, summary: question.stem }],
      }) : true).then(function (accepted) {
        if (accepted === false) { result.cancelled = true; return result; }
        __DAGUANYUAN_MATH_IMPORT_GLOBAL__.selectQuestions([{ id: question.id }], accepted);
        if (beforeImport && beforeImport.check) beforeImport.check();
        stage = "MarginNote 建卡";
        const outcome = session.write(question, { url: target.url.split(/[?#]/)[0] });
        if (session.takeCommentFoldWarnings) {
          const warnings = session.takeCommentFoldWarnings();
          if (warnings.length) result.commentFoldWarnings = warnings;
        }
        if (outcome) result.createdCount = 1;
        else result.skippedCount = 1;
        return result;
      });
    }).catch(function (error) {
      result.failed.push({ questionId: target.id, source: source, stage: error.stage || stage,
        diagnostics: error.diagnostics, reason: String(error && error.message || error) });
      return result;
    });
  }
  return { targetFromAddress, importQuestion, position, setPosition, positionTitle };
})();
