var __DAGUANYUAN_408_NOTE_PASTE_GLOBAL__ = (function () {
  const PREFIX = "window.__DAGUANYUAN_408_NOTE_PASTE__";

  // 此函数只在 408 网站 WebView 中执行，通过已有编辑器粘贴并等待网站确认保存。
  function pageReceiver() {
    if (window.__DAGUANYUAN_408_NOTE_PASTE__) return true;
    var current = null;
    function questionRow(target) {
      if (window.location.hostname !== "www.408os.cn" || !/^\/exercise\/?$/.test(window.location.pathname)) return null;
      var expected = new URL(target.url), actual = new URL(window.location.href);
      [expected, actual].forEach(function (url) { url.hash = ''; url.searchParams.delete('questionId'); });
      if (expected.toString() !== actual.toString()) return null;
      var rows = document.querySelectorAll('.question-card');
      for (var i = 0; i < rows.length; i += 1) {
        var year = rows[i].querySelector('.year-tag'), number = rows[i].querySelector('.index-tag');
        if (year && number && String(year.textContent).trim().replace(/年$/, '') === String(target.year)
          && String(number.textContent).replace(/\s/g, '') === '第' + target.number + '题') return rows[i];
      }
      return null;
    }
    function finish(token, status) {
      if (!current || current.token !== token) return;
      current = null;
      var tools = window.__DAGUANYUAN_QUESTION_TOOLS__;
      if (tools) tools.finishNotePaste();
      var frame = document.createElement('iframe');
      frame.style.display = 'none';
      frame.src = 'daguanyuanbridge://add-note-result?token=' + encodeURIComponent(token) + '&status=' + status;
      document.body.appendChild(frame);
      window.setTimeout(function () { if (frame.parentNode) frame.parentNode.removeChild(frame); }, 600);
    }
    function prepare(target, token, type, name) {
      if (current || !questionRow(target)) return false;
      current = { target: target, token: token, type: type, name: name, chunks: [], started: Date.now() };
      return true;
    }
    function append(token, chunk) {
      if (!current || current.token !== token || !questionRow(current.target)) return false;
      current.chunks.push(chunk); return true;
    }
    function commit(token) {
      if (!current || current.token !== token) return false;
      var transfer = current, file;
      try {
        var binary = atob(transfer.chunks.join('')), bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        file = new File([bytes], transfer.name, { type: transfer.type });
        transfer.chunks = [];
      } catch (error) { finish(token, 'decode'); return true; }
      var noteOpened = false, pasted = false, before = '', imageCountBefore = 0, messagesBefore = [];
      function tick() {
        if (!current || current.token !== token) return;
        var row = questionRow(transfer.target);
        if (!row) { finish(token, 'changed'); return; }
        if (Date.now() - transfer.started > 45000) { finish(token, 'timeout'); return; }
        var scope = row, editor = row.querySelector('textarea.editor-overlay-textarea');
        if (!editor) {
          var modals = document.querySelectorAll('.modal.active, .n-modal');
          for (var m = 0; m < modals.length; m += 1) {
            var candidate = modals[m].querySelector('textarea.editor-overlay-textarea');
            var heading = modals[m].querySelector('.modal-header');
            if (heading && /笔记/.test(heading.textContent)) { scope = modals[m]; editor = candidate; noteOpened = true; break; }
          }
        }
        if (!editor) {
          if (row.querySelector('.note-tabs')) noteOpened = true;
          if (!noteOpened) {
            var buttons = row.querySelectorAll('button');
            for (var b = 0; b < buttons.length; b += 1) {
              if (String(buttons[b].textContent).trim() === '笔记') { buttons[b].click(); noteOpened = true; break; }
            }
          }
          // 仅预览布局或社区笔记中需要先进入自己的编辑区域。
          var tabs = scope.querySelectorAll('.note-tab, .editor-tabs button');
          for (var t = 0; t < tabs.length; t += 1) if (/^(我的笔记|仅编辑)$/.test(String(tabs[t].textContent).trim())) tabs[t].click();
          window.setTimeout(tick, 150); return;
        }
        if (!pasted) {
          if (scope.querySelector('.note-loading, .loading')) { window.setTimeout(tick, 150); return; }
          before = editor.value;
          imageCountBefore = (before.match(/\[图片\d+\]/g) || []).length;
          messagesBefore = Array.from(document.querySelectorAll('.n-message'));
          editor.focus(); editor.setSelectionRange(before.length, before.length);
          var event = new Event('paste', { bubbles: true, cancelable: true });
          Object.defineProperty(event, 'clipboardData', { value: {
            files: [file], items: [{ kind: 'file', type: file.type, getAsFile: function () { return file; } }], getData: function () { return ''; }
          } });
          editor.dispatchEvent(event); pasted = true;
        } else {
          var messages = document.querySelectorAll('.n-message');
          for (var n = 0; n < messages.length; n += 1) {
            if (messagesBefore.indexOf(messages[n]) >= 0) continue;
            var warning = String(messages[n].textContent);
            if (/图片功能.*未|未.*图片功能/.test(warning)) { finish(token, 'permission'); return; }
            if (/图片.*(?:超过|最多|不能)/.test(warning)) { finish(token, 'limit'); return; }
            if (/图片上传失败/.test(warning)) { finish(token, 'upload'); return; }
          }
          var status = scope.querySelector('.inline-auto-save-status, .auto-save-status');
          if (status && /自动保存失败|保存失败/.test(status.textContent)) { finish(token, 'save'); return; }
          // 网站上传图片后插入图片标记，只有新增图片并保存后才报告成功。
          var imageAdded = (editor.value.match(/\[图片\d+\]/g) || []).length > imageCountBefore;
          if (imageAdded && status && String(status.textContent).trim() === '已保存') { finish(token, 'saved'); return; }
          if (imageAdded && !status) {
            var saves = scope.querySelectorAll('button');
            for (var s = 0; s < saves.length; s += 1) {
              if (/^(保存笔记|更新笔记)$/.test(String(saves[s].textContent).trim()) && !saves[s].disabled) { saves[s].click(); break; }
            }
          }
        }
        window.setTimeout(tick, 250);
      }
      tick(); return true;
    }
    window.__DAGUANYUAN_408_NOTE_PASTE__ = {
      prepare: prepare, append: append, commit: commit,
      cancel: function (token) { if (!current || current.token !== token) return false; current = null; return true; }
    };
    return true;
  }

  function evaluate(controller, script) {
    return new Promise(function (resolve, reject) {
      let settled = false;
      const timer = NSTimer.scheduledTimerWithTimeInterval(15, false, function () {
        if (settled) return; settled = true; reject(new Error("408 笔记网页调用超时"));
      });
      function finish(value, error) {
        if (settled) return; settled = true; timer.invalidate();
        if (error) reject(new Error(String(error.localizedDescription || error)));
        else resolve(value);
      }
      try { controller.webView.evaluateJavaScript(script, finish); } catch (error) { finish(null, error); }
    });
  }
  function accepted(value) { if (String(value) !== "true" && value !== true) throw new Error("408 当前题目已切换或笔记编辑器不可用"); }
  function start(controller, target) {
    if (controller.notePasteOperation) return Promise.reject(new Error("上一张图片仍在添加中，请稍候"));
    const token = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    let image;
    controller.notePasteOperation = { id: target.id, token: token };
    return Promise.resolve().then(function () {
      image = __DAGUANYUAN_NOTE_PASTE_GLOBAL__.clipboardImage();
      return evaluate(controller, "String((" + pageReceiver.toString() + ")())");
    }).then(function (ready) {
      accepted(ready);
      return evaluate(controller, "String(" + PREFIX + ".prepare(" + [target, token, image.mimeType, image.fileName].map(JSON.stringify).join(',') + "))");
    }).then(function (ready) {
      accepted(ready);
      function next(offset) {
        if (offset >= image.base64.length) return Promise.resolve();
        return evaluate(controller, "String(" + PREFIX + ".append(" + JSON.stringify(token) + "," + JSON.stringify(image.base64.slice(offset, offset + 131072)) + "))")
          .then(function (ready) { accepted(ready); return next(offset + 131072); });
      }
      return next(0);
    }).then(function () { return evaluate(controller, "String(" + PREFIX + ".commit(" + JSON.stringify(token) + "))"); })
      .then(function (ready) {
        accepted(ready);
        NSTimer.scheduledTimerWithTimeInterval(55, false, function () {
          if (!controller.notePasteOperation || controller.notePasteOperation.token !== token) return;
          controller.notePasteOperation = null;
          evaluate(controller, PREFIX + "&&" + PREFIX + ".cancel(" + JSON.stringify(token) + ")").catch(function () {});
          controller.webView.evaluateJavaScript("window.__DAGUANYUAN_QUESTION_TOOLS__&&window.__DAGUANYUAN_QUESTION_TOOLS__.finishNotePaste()", function () {});
          Application.sharedInstance().showHUD("尚未确认图片保存，请查看 408 题目笔记", controller.addon.window, 2);
        });
        return token;
      }).catch(function (error) {
        if (controller.notePasteOperation && controller.notePasteOperation.token === token) controller.notePasteOperation = null;
        evaluate(controller, PREFIX + "&&" + PREFIX + ".cancel(" + JSON.stringify(token) + ")").catch(function () {});
        throw error;
      });
  }
  return { start: start, pageScript: function () { return "(" + pageReceiver.toString() + ")();"; } };
})();
