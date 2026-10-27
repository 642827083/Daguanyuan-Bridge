var __DAGUANYUAN_408_NOTE_PASTE_GLOBAL__ = (function () {
  const PREFIX = "window.__DAGUANYUAN_408_NOTE_PASTE__";

  // 此函数只在 408 网站 WebView 中执行，通过已有编辑器粘贴并等待网站确认保存。
  function pageReceiver() {
    if (window.__DAGUANYUAN_408_NOTE_PASTE__ && window.__DAGUANYUAN_408_NOTE_PASTE__.version === 2) return true;
    var current = null;
    function findEditor(scope) {
      return scope.querySelector('textarea.editor-overlay-textarea')
        || scope.querySelector('.note-markdown-editor .cm-content[contenteditable="true"]');
    }
    function imageTokens(editor) {
      var content = typeof editor.value === 'string' ? editor.value : String(editor.textContent || '');
      var tokens = content.match(/\[图片\d+\]|【图片\d+】/g) || [];
      // CodeMirror 将图片标记替换成控件，实际标记保存在控件属性中。
      var images = typeof editor.querySelectorAll === 'function' ? editor.querySelectorAll('[data-image-token]') : [];
      for (var i = 0; i < images.length; i += 1) {
        var token = images[i].getAttribute('data-image-token');
        if (token && tokens.indexOf(token) < 0) tokens.push(token);
      }
      return tokens;
    }
    function focusEditorEnd(editor) {
      editor.focus();
      if (typeof editor.value === 'string' && typeof editor.setSelectionRange === 'function') {
        editor.setSelectionRange(editor.value.length, editor.value.length);
      } else {
        var range = document.createRange(), selection = window.getSelection();
        range.selectNodeContents(editor); range.collapse(false);
        selection.removeAllRanges(); selection.addRange(range);
      }
    }
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
      var noteOpened = false, pasted = false, imagesBefore = [], messagesBefore = [];
      function tick() {
        if (!current || current.token !== token) return;
        var row = questionRow(transfer.target);
        if (!row) { finish(token, 'changed'); return; }
        if (Date.now() - transfer.started > 45000) { finish(token, 'timeout'); return; }
        var scope = row, editor = findEditor(row);
        if (!editor) {
          var modals = document.querySelectorAll('.modal.active, .n-modal');
          for (var m = 0; m < modals.length; m += 1) {
            var candidate = findEditor(modals[m]);
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
          imagesBefore = imageTokens(editor);
          messagesBefore = Array.from(document.querySelectorAll('.n-message'));
          try {
            focusEditorEnd(editor);
            var event = new Event('paste', { bubbles: true, cancelable: true });
            Object.defineProperty(event, 'clipboardData', { value: {
              files: [file], items: [{ kind: 'file', type: file.type, getAsFile: function () { return file; } }], getData: function () { return ''; }
            } });
            editor.dispatchEvent(event); pasted = true;
          } catch (error) { finish(token, 'paste'); return; }
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
          // 图片占位符可能早于上传完成出现，须同时确认上传结束与网站保存状态。
          var imageAdded = imageTokens(editor).some(function (token) { return imagesBefore.indexOf(token) < 0; });
          var uploading = (typeof editor.getAttribute === 'function' && editor.getAttribute('aria-busy') === 'true')
            || scope.querySelector('.note-editor-image.is-uploading, .note-editor-image[aria-busy="true"]');
          if (imageAdded && !uploading && status && String(status.textContent).trim() === '已保存') { finish(token, 'saved'); return; }
          if (imageAdded && !uploading && !status) {
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
      version: 2, prepare: prepare, append: append, commit: commit,
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
