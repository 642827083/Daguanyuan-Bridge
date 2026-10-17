var __DAGUANYUAN_CARD_LOCATOR_GLOBAL__ = (function () {
  const MODE_KEY = "cn.marginnote.daguanyuan-bridge.question-tools.card-location-mode";

  function mode() {
    try {
      return String(NSUserDefaults.standardUserDefaults().objectForKey(MODE_KEY)) === "locate" ? "locate" : "focus";
    } catch (ignored) { return "focus"; }
  }

  function setMode(requested) {
    if (requested !== "locate" && requested !== "focus") throw new Error("定位卡片方式无效");
    NSUserDefaults.standardUserDefaults().setObjectForKey(requested, MODE_KEY);
  }

  function value(object, key) {
    const item = object && object[key];
    return typeof item === "function" ? item.call(object) : item;
  }

  function items(list) {
    if (!list) return [];
    const count = Number(typeof list.count === "function" ? list.count() : list.length) || 0;
    const result = [];
    for (let index = 0; index < count; index += 1) result.push(typeof list.objectAtIndex === "function" ? list.objectAtIndex(index) : list[index]);
    return result;
  }

  function studyFor(addon) {
    return Application.sharedInstance().studyController(addon.window);
  }

  function studySetId(study) {
    return String(value(study && study.notebookController, "notebookId") || "");
  }

  function ensureActive(operation) {
    if (operation.done || operation.addon.__daguanyuanCardLocation !== operation) throw new Error("已取消定位");
  }

  function clearTimer(operation, timer) {
    if (!timer) return;
    operation.timers.delete(timer);
    timer.invalidate();
  }

  function finish(operation, error, result) {
    if (operation.done) return;
    operation.done = true;
    if (typeof __DAGUANYUAN_DIAGNOSTICS_GLOBAL__ !== 'undefined') {
      const details = { taskId: operation.logTaskId, provider: operation.provider, questionId: operation.questionId, stage: operation.phase, mode: operation.mode };
      if (error) __DAGUANYUAN_DIAGNOSTICS_GLOBAL__.error('card.locate.result', error, details);
      else __DAGUANYUAN_DIAGNOSTICS_GLOBAL__.info('card.locate.result', Object.assign({}, details, { status: 'complete' }));
    }
    operation.timers.forEach(function (timer) { timer.invalidate(); });
    operation.timers.clear();
    operation.waits.forEach(function (reject) { reject(error || new Error("定位已结束")); });
    operation.waits.clear();
    if (operation.selecting) {
      try { __DAGUANYUAN_CARD_LOCATOR_UI_GLOBAL__.cancel(operation.addon.panelController); }
      catch (cleanupError) { console.log(`[Daguanyuan Bridge] 关闭题卡选择列表失败：${cleanupError && cleanupError.message || cleanupError}`); }
    }
    if (operation.addon.__daguanyuanCardLocation === operation) operation.addon.__daguanyuanCardLocation = null;
    if (error) operation.reject(error);
    else operation.resolve(result);
  }

  function later(operation, seconds, action) {
    ensureActive(operation);
    let fired = false;
    const timer = NSTimer.scheduledTimerWithTimeInterval(seconds, false, function () {
      if (fired) return;
      fired = true;
      clearTimer(operation, timer);
      if (operation.done) return;
      try { ensureActive(operation); action(); } catch (error) { finish(operation, error); }
    });
    operation.timers.add(timer);
    return timer;
  }

  function delay(operation, seconds, switching) {
    return new Promise(function (resolve, reject) {
      operation.waits.add(reject);
      const timer = later(operation, seconds, function () {
        operation.waits.delete(reject);
        if (operation.switchTimer === timer) operation.switchTimer = null;
        resolve();
      });
      if (switching) operation.switchTimer = timer;
    });
  }

  function phase(operation, name, seconds, message) {
    clearTimer(operation, operation.deadline);
    operation.phase = name;
    operation.deadline = later(operation, seconds, function () { finish(operation, new Error(message)); });
  }

  function cardPath(note) {
    const path = [];
    const seen = new Set();
    let parent = value(note, "parentNote");
    while (parent && path.length < 20) {
      const id = String(value(parent, "noteId") || "");
      if (seen.has(id)) break;
      seen.add(id);
      const title = String(value(parent, "noteTitle") || "").trim();
      if (title) path.unshift(title);
      parent = value(parent, "parentNote");
    }
    return path.join(" / ");
  }

  async function scanStudySet(operation, notebook) {
    if (!notebook) return [];
    const notebookId = String(value(notebook, "topicId") || "");
    if (!notebookId) return [];
    const pending = items(notebook.notes || notebook.childNotes).reverse();
    const seen = new Set();
    const candidates = [];
    let inspected = 0;
    while (pending.length) {
      ensureActive(operation);
      const note = pending.pop();
      const id = String(value(note, "noteId") || "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const link = __DAGUANYUAN_MATH_IMPORT_GLOBAL__.linkedQuestion(note);
      if (link && link.id === operation.questionId && (link.provider || "math") === operation.provider) {
        candidates.push({ noteId: id, notebookId, studySetTitle: String(value(notebook, "title") || "未命名学习集"),
          title: String(value(note, "noteTitle") || "未命名卡片"), path: cardPath(note) });
      }
      items(note.childNotes).reverse().forEach(function (child) { pending.push(child); });
      // 大学习集分批扫描，让主线程有机会响应；不把网页或缓存当成题卡真源。
      if (++inspected % 150 === 0) await delay(operation, 0.001);
    }
    return candidates;
  }

  function checkedNote(operation, candidate) {
    ensureActive(operation);
    const note = operation.database.getNoteById(candidate.noteId);
    if (!note) throw new Error("目标卡片不存在或尚未同步，请重新定位");
    const actualStudySetId = String(value(note, "notebookId") || candidate.notebookId);
    if (actualStudySetId !== candidate.notebookId) throw new Error("目标卡片已移动到其他学习集，请重新定位");
    const link = __DAGUANYUAN_MATH_IMPORT_GLOBAL__.linkedQuestion(note);
    if (!link || link.id !== operation.questionId || (link.provider || "math") !== operation.provider) throw new Error("题卡的题目来源已变化，请重新定位");
    return note;
  }

  async function execute(operation) {
    const study = studyFor(operation.addon);
    if (!study) throw new Error("当前窗口的学习控制器不可用，请先打开 MarginNote 学习页面");
    const currentId = studySetId(study);
    const database = operation.database;
    phase(operation, "search", 30, "查找学习集题卡超时，请稍后重试");
    let candidates = await scanStudySet(operation, currentId && database.getNotebookById(currentId));
    if (!candidates.length) {
      if (typeof database.allNotebooks !== "function") throw new Error("当前 MarginNote 版本不支持跨学习集查找");
      const seenBooks = new Set([currentId]);
      const notebooks = items(database.allNotebooks());
      for (let index = 0; index < notebooks.length; index += 1) {
        const id = String(value(notebooks[index], "topicId") || "");
        if (!id || seenBooks.has(id)) continue;
        seenBooks.add(id);
        candidates = candidates.concat(await scanStudySet(operation, notebooks[index]));
      }
    }
    ensureActive(operation);
    if (!candidates.length) throw new Error("所有学习集中都没有这道题的脑图卡片，请先导入或等待同步完成");
    let candidate = candidates[0];
    if (candidates.length > 1) {
      phase(operation, "select", 120, "选择题卡超时，请重新点击定位卡片");
      operation.selecting = true;
      candidate = await __DAGUANYUAN_CARD_LOCATOR_UI_GLOBAL__.choose(operation.addon.panelController, candidates);
      operation.selecting = false;
      ensureActive(operation);
      if (!candidate || !candidates.some(function (item) { return item.noteId === candidate.noteId && item.notebookId === candidate.notebookId; })) throw new Error("题卡选择无效");
    }
    checkedNote(operation, candidate);
    if (studySetId(studyFor(operation.addon)) !== candidate.notebookId) {
      phase(operation, "switch", 10, "切换目标学习集超时，请稍后重试");
      // 和 CardLink 一样使用官方卡片链接，不依赖当前打开的来源文档。
      try {
        Application.sharedInstance().openURL(NSURL.URLWithString("marginnote4app://note/" + encodeURIComponent(candidate.noteId)));
      } catch (error) {
        // 宿主可能在派发返回异常后仍完成切换，以实际学习集状态为准。
        console.log(`[Daguanyuan Bridge] 派发题卡链接异常：${error && error.message || error}`);
      }
      while (studySetId(studyFor(operation.addon)) !== candidate.notebookId) await delay(operation, 0.1, true);
      await delay(operation, 0.2);
    }
    phase(operation, "focus", 3, "目标卡片定位超时，请稍后重试");
    function targetStudy() {
      ensureActive(operation);
      const active = studyFor(operation.addon);
      if (studySetId(active) !== candidate.notebookId) throw new Error("学习集已切换，定位停止");
      if (!active || typeof active.focusNoteInMindMapById !== "function" || (operation.mode === "focus" && (!active.notebookController || typeof active.notebookController.changeFocusToNote !== "function"))) {
        throw new Error(operation.mode === "focus" ? "当前 MarginNote 版本不支持进入焦点并定位脑图卡片" : "当前 MarginNote 版本不支持定位脑图卡片");
      }
      return active;
    }
    if (operation.mode === "focus") {
      targetStudy().notebookController.changeFocusToNote(checkedNote(operation, candidate));
      // 和 CardLink 一样，切焦点后等待画布重建，再派发滚动定位。
      await delay(operation, 0.08);
    }
    checkedNote(operation, candidate);
    targetStudy().focusNoteInMindMapById(candidate.noteId);
    await delay(operation, 0.06);
    checkedNote(operation, candidate);
    targetStudy();
    return { questionId: operation.questionId, noteId: candidate.noteId, notebookId: candidate.notebookId };
  }

  function locate(addon, questionId, provider) {
    if (!addon) return Promise.reject(new Error("插件窗口不可用"));
    if (addon.__daguanyuanCardLocation) return Promise.reject(new Error("正在定位上一张卡片，请稍候"));
    const operation = { addon, questionId, provider: provider || "math", mode: mode(), database: Database.sharedInstance(),
      timers: new Set(), waits: new Set(), done: false, selecting: false };
    const result = new Promise(function (resolve, reject) { operation.resolve = resolve; operation.reject = reject; });
    addon.__daguanyuanCardLocation = operation;
    if (typeof __DAGUANYUAN_DIAGNOSTICS_GLOBAL__ !== 'undefined') operation.logTaskId = __DAGUANYUAN_DIAGNOSTICS_GLOBAL__.begin('card.locate', { provider: operation.provider, questionId, mode: operation.mode });
    execute(operation).then(function (value) { finish(operation, null, value); }, function (error) { finish(operation, error); });
    return result;
  }

  function resume(addon) {
    const operation = addon && addon.__daguanyuanCardLocation;
    if (operation && operation.phase === "switch" && operation.switchTimer) operation.switchTimer.fire();
  }

  function cancel(addon) {
    const operation = addon && addon.__daguanyuanCardLocation;
    if (operation) finish(operation, new Error("已取消定位"));
  }

  return { locate, resume, cancel, mode, setMode };
})();
