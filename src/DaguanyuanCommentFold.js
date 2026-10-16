var __DAGUANYUAN_COMMENT_FOLD_GLOBAL__ = (function () {
  const KEY = 'cn.marginnote.daguanyuan-bridge.card-tools.fold-source-comment';
  const C = __DAGUANYUAN_CARD_COMMENTS_GLOBAL__;
  function enabled() {
    try { return NSUserDefaults.standardUserDefaults().objectForKey(KEY) === true; }
    catch (ignored) { return false; }
  }
  function setEnabled(on) { NSUserDefaults.standardUserDefaults().setObjectForKey(Boolean(on), KEY); }
  function failure(message, code) { const error = new Error(message); error.code = code || 'COMMENT_FOLD_FAILED'; return error; }
  function checked(reply) {
    if (!reply || reply.ok !== true) {
      const detail = reply && reply.error;
      throw failure(detail && (detail.message || detail.code) || '评论接口未返回有效结果', detail && detail.code);
    }
    return reply;
  }
  function sourceComments(comments) {
    return comments.filter(function (comment) {
      return Boolean(__DAGUANYUAN_SOURCE_LINK_GLOBAL__.fromComment(C.text(comment)));
    });
  }
  function fold(note, collapsed) {
    if (typeof collapsed !== 'boolean') throw failure('评论折叠状态无效');
    if (!note) throw failure('题卡已删除');
    // 普通评论不调用写接口，个人文字和手写保持原状。
    if (!sourceComments(C.items(C.value(note, 'comments'))).length) return { skipped: true };
    if (typeof note.commentState !== 'function' || typeof note.setCommentsCollapsed !== 'function') {
      throw failure('当前 MarginNote 版本不支持评论折叠，请更新后重试', 'COMMENT_FOLD_UNSUPPORTED');
    }
    const state = checked(note.commentState()), comments = sourceComments(C.items(state.comments));
    if (comments.length !== 1) throw failure('原题评论缺失或重复，请先整理后重试');
    if (typeof state.revision !== 'string' || !state.revision) throw failure('评论版本信息无效');
    const comment = comments[0];
    if (comment.collapsed === collapsed) return { unchanged: true };
    // 原生空 ID 可能是 truthy 的 NSNull，只有非空字符串才能用于身份定位。
    const hasIdentity = typeof comment.commentId === 'string' && comment.commentId.trim().length > 0
      && typeof comment.ownerNoteId === 'string' && comment.ownerNoteId.trim().length > 0;
    const target = hasIdentity
      ? { ownerNoteId: comment.ownerNoteId, commentId: comment.commentId } : { index: comment.index };
    if ('index' in target && (!Number.isSafeInteger(target.index) || target.index < 1)) throw failure('原题评论序号无效');
    // 使用同一次读取的目标与版本，冲突时交给用户重试，不换版本强写。
    const result = checked(note.setCommentsCollapsed([target], collapsed, state.revision));
    if (result.persisted !== true) throw failure('原题评论未确认保存成功', 'COMMENT_NOT_PERSISTED');
    return { changed: true };
  }
  function enqueue(context, note) {
    if (!enabled()) return;
    if (!context.commentFoldPending) context.commentFoldPending = [];
    context.commentFoldPending.push(String(C.value(note, 'noteId') || ''));
  }
  function flush(context) {
    const ids = context.commentFoldPending || []; context.commentFoldPending = [];
    if (!enabled()) return [];
    const warnings = [];
    Array.from(new Set(ids)).forEach(function (id) {
      try { const note = context.database.getNoteById(id); if (note) fold(note, true); }
      catch (error) { warnings.push({ noteId: id, reason: String(error.message || error) }); }
    });
    return warnings;
  }
  function addWarnings(result, warnings) {
    if (warnings.length) result.commentFoldWarnings = (result.commentFoldWarnings || []).concat(warnings);
  }
  function context(addon) {
    const study = Application.sharedInstance().studyController(addon.window), database = Database.sharedInstance();
    const notebookId = String(C.value(study && study.notebookController, 'notebookId') || '');
    const notebook = notebookId && database.getNotebookById(notebookId);
    if (!notebook) throw failure('请先打开目标学习集');
    return { notebookId, notebook, database };
  }
  function batch(addon, collapsed, progress, active) {
    const captured = context(addon), pending = C.items(C.value(captured.notebook, 'notes') || C.value(captured.notebook, 'childNotes'));
    const seen = new Set(), ids = [];
    while (pending.length) {
      const note = pending.pop(), id = String(C.value(note, 'noteId') || '');
      if (!id || seen.has(id)) continue;
      seen.add(id); C.items(C.value(note, 'childNotes')).forEach(child => pending.push(child));
      if (sourceComments(C.items(C.value(note, 'comments'))).length) ids.push(id);
    }
    const result = { total: ids.length, processed: 0, changed: 0, unchanged: 0, skipped: 0, failed: [] };
    return new Promise(function (resolve) {
      function next() {
        try {
          if (active && !active() || context(addon).notebookId !== captured.notebookId) {
            result.interrupted = '操作已停止，已完成的修改保留'; resolve(result); return;
          }
          const end = Math.min(result.processed + 10, ids.length);
          while (result.processed < end) {
            const id = ids[result.processed++], note = captured.database.getNoteById(id);
            if (!note || String(C.value(note, 'notebookId') || '') !== captured.notebookId) { result.skipped++; continue; }
            try {
              const outcome = fold(note, collapsed);
              if (outcome.changed) result.changed++;
              else if (outcome.unchanged) result.unchanged++;
              else result.skipped++;
            } catch (error) {
              result.failed.push({ noteId: id, reason: String(error.message || error) });
              if (error.code === 'COMMENT_FOLD_UNSUPPORTED') { result.interrupted = error.message; resolve(result); return; }
            }
          }
          if (progress) progress(result);
          if (result.processed >= ids.length) resolve(result);
          else NSTimer.scheduledTimerWithTimeInterval(0.01, false, next);
        } catch (error) { result.interrupted = String(error.message || error); resolve(result); }
      }
      next();
    });
  }
  return { enabled, setEnabled, fold, enqueue, flush, addWarnings, batch };
})();
