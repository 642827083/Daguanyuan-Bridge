var __DAGUANYUAN_NOTE_PASTE_GLOBAL__ = (function () {
  const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
  const CHUNK_LENGTH = 131072;

  function nativeValue(object, key) {
    const value = object && object[key];
    return typeof value === "function" ? value.call(object) : value;
  }

  function clipboardImage() {
    const pasteboard = UIPasteboard.generalPasteboard();
    const image = nativeValue(pasteboard, "image");
    if (!image) throw new Error("剪贴板中没有图片，请先复制手写笔记");
    let data = nativeValue(image, "pngData");
    let mimeType = "image/png";
    let fileName = "clipboard-note.png";
    if (Number(nativeValue(data, "length")) > MAX_IMAGE_BYTES) {
      data = image.jpegData(0.88);
      mimeType = "image/jpeg";
      fileName = "clipboard-note.jpg";
    }
    const length = Number(nativeValue(data, "length")) || 0;
    if (length < 1) throw new Error("无法读取剪贴板图片");
    if (length > MAX_IMAGE_BYTES) throw new Error("剪贴板图片超过 20 MB，请先裁剪后重试");
    const base64 = String(nativeValue(data, "base64Encoding") || "");
    if (!base64) throw new Error("剪贴板图片转换失败");
    return { base64, mimeType, fileName };
  }

  function pageReceiver() {
    if (window.__DAGUANYUAN_NOTE_PASTE__ && window.__DAGUANYUAN_NOTE_PASTE__.version === 8) return true;
    var current = null;
    function previewRow(id, expectedRow) {
      var helper = window.__DAGUANYUAN_QUESTION_DOM__;
      return helper && typeof helper.previewRow === 'function' ? helper.previewRow(Number(id), expectedRow) : null;
    }
    function validPage(id) {
      return /^(?:www\.|math\.)?cxyonly\.fans$/i.test(window.location.hostname || "")
        && (/^\/(?:math\/)?(?:practice(?:\/(?:(?:categories|concepts)\/)?[1-9]\d*|\/[^/\s?#]+\/(?:all|[1-9]\d*)\/[1-9]\d*)?|questions\/[1-9]\d*|paper)\/?$/.test(window.location.pathname || "")
          || /^\/(?:math\/)?retest(?:\/|$)/.test(window.location.pathname || "")
          || !!previewRow(id || current && current.id, current && current.preview ? current.row : undefined));
    }
    function questionRow(id) {
      if (current && current.preview) return previewRow(id, current.row);
      var helper = window.__DAGUANYUAN_QUESTION_DOM__;
      var snapshot = helper && helper.read();
      if (snapshot && snapshot.page.preview) {
        for (var item = 0; item < snapshot.questions.length; item += 1) {
          if (String(snapshot.questions[item].id) === String(id)) return snapshot.questions[item].row;
        }
        return null;
      }
      var rows = document.querySelectorAll("[data-learning-question-id], [data-retest-question-id], [data-retest-schedule-question-id]");
      for (var index = 0; index < rows.length; index += 1) {
        var row = rows[index];
        if (String(row.getAttribute("data-learning-question-id") || row.getAttribute("data-retest-question-id")
          || row.getAttribute("data-retest-schedule-question-id")) === String(id)) return row;
      }
      return null;
    }
    function sendResult(token, status) {
      var frame = document.createElement("iframe");
      frame.style.display = "none";
      frame.src = "daguanyuanbridge://add-note-result?token=" + encodeURIComponent(token) + "&status=" + encodeURIComponent(status);
      document.body.appendChild(frame);
      window.setTimeout(function () { if (frame.parentNode) frame.parentNode.removeChild(frame); }, 600);
    }
    function buttonFor(row) {
      return row.querySelector("[data-daguanyuan-practice-add-note], [data-daguanyuan-retest-add-note]");
    }
    function visible(node) {
      for (var ancestor = node; ancestor; ancestor = ancestor.parentElement) {
        if (ancestor.hasAttribute && (ancestor.hasAttribute('hidden') || ancestor.hasAttribute('inert'))) return false;
        if (typeof window.getComputedStyle === 'function') {
          var style = window.getComputedStyle(ancestor);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
        }
      }
      return true;
    }
    function externalNoteButton(row) {
      if (typeof document.querySelector !== 'function') return null;
      // 专注模式的工具栏位于题卡外，仅在页面明确只有当前题目时使用，避免串题。
      var rows = document.querySelectorAll('[data-learning-question-id]');
      var active = [];
      for (var index = 0; index < rows.length; index += 1) if (visible(rows[index])) active.push(rows[index]);
      if (active.length !== 1 || active[0] !== row) return null;
      var button = document.querySelector('[aria-label="当前题目工具"] button[aria-controls="focus-tool-panel-note"]');
      return button && !button.disabled && visible(button) ? button : null;
    }
    function stillCurrent(token) {
      if (!current || current.token !== token) return false;
      if (!validPage() || current.url !== String(window.location.href || '') || questionRow(current.id) !== current.row || !visible(current.row)) {
        finish(token, 'question-changed'); return false;
      }
      return true;
    }
    function noteDialog() {
      var dialogs = document.querySelectorAll('[role="dialog"][data-kind="dialog"]');
      for (var index = 0; index < dialogs.length; index += 1) {
        var heading = dialogs[index].querySelector("h2");
        if (heading && String(heading.textContent || "").trim() === "题目笔记") return dialogs[index];
      }
      return null;
    }
    function finish(token, status) {
      if (!current || current.token !== token) return;
      var button = current.button;
      if (button) { button.disabled = false; button.textContent = "添加笔记"; }
      current = null;
      sendResult(token, status);
    }
    function prepare(id, token, mimeType, fileName) {
      if (!validPage(id) || current) return false;
      var row = questionRow(id);
      if (!row || !visible(row)) return false;
      var button = buttonFor(row);
      if (!button) return false;
      current = { id: id, token: token, mimeType: mimeType, fileName: fileName, chunks: [], row: row, button: button, url: String(window.location.href || ''), preview: previewRow(id) === row };
      button.disabled = true;
      button.textContent = "添加中…";
      return true;
    }
    function append(token, chunk) {
      if (!validPage() || !current || current.token !== token) return false;
      current.chunks.push(chunk);
      return true;
    }
    function openEditor(token, callback) {
      var attempts = 0;
      var noteOpened = false;
      var moreOpened = false;
      var editRequested = false;
      function check() {
        if (!stillCurrent(token)) return;
        var row = current.row;
        var scope = row;
        var wrapper = scope.querySelector('[data-note-rich-editor="true"], [data-note-markdown-editor="true"]');
        if (!wrapper && noteOpened) {
          scope = current.editorId && typeof document.getElementById === 'function' && document.getElementById(current.editorId) || noteDialog();
          wrapper = scope && scope.querySelector('[data-note-rich-editor="true"], [data-note-markdown-editor="true"]');
        }
        var editor = wrapper && wrapper.querySelector('[data-note-editor="true"]');
        if (wrapper && editor && visible(wrapper)) {
          var preview = wrapper.getAttribute && wrapper.getAttribute('data-note-preview') === 'true';
          var readOnly = editor.getAttribute && editor.getAttribute('contenteditable') === 'false';
          if (!preview && !readOnly && visible(editor) && !editor.disabled) { callback(scope, wrapper, editor); return; }
          if (!editRequested) {
            var edit = wrapper.querySelector('button[aria-label="返回编辑"]');
            if (edit && !edit.disabled) { edit.click(); editRequested = true; }
          }
        }
        if (!noteOpened) {
          var buttons = row.querySelectorAll("button");
          var noteButton = null;
          var moreButton = null;
          for (var index = 0; index < buttons.length; index += 1) {
            if (buttons[index].hasAttribute("data-daguanyuan-practice-add-note")
              || buttons[index].hasAttribute("data-daguanyuan-retest-add-note")) continue;
            if (!visible(buttons[index])) continue;
            var label = String(buttons[index].getAttribute && buttons[index].getAttribute('aria-label') || buttons[index].textContent || "").trim();
            if (label === "查看笔记" || label === "添加笔记" || label === "笔记" || label === "隐藏笔记") { noteButton = buttons[index]; break; }
            if (label === "更多操作") moreButton = buttons[index];
          }
          noteButton = externalNoteButton(row) || noteButton;
          if (noteButton && !noteButton.disabled) {
            current.editorId = noteButton.getAttribute && noteButton.getAttribute('aria-controls');
            if (!noteButton.getAttribute || noteButton.getAttribute('aria-expanded') !== 'true') noteButton.click();
            noteOpened = true;
          }
          else if (!moreOpened && moreButton) { moreButton.click(); moreOpened = true; }
        }
        attempts += 1;
        if (attempts > 60) { finish(token, "editor-missing"); return; }
        window.setTimeout(check, 150);
      }
      check();
    }
    function commit(token) {
      if (!validPage() || !current || current.token !== token) return false;
      var transfer = current;
      var file;
      try {
        var binary = atob(transfer.chunks.join(""));
        var bytes = new Uint8Array(binary.length);
        for (var index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
        file = new File([bytes], transfer.fileName, { type: transfer.mimeType });
      } catch (error) { finish(token, "decode"); return true; }
      transfer.chunks = [];
      openEditor(token, function (scope, wrapper, editor) {
        try {
          var markdown = String(editor.tagName || '').toLowerCase() === 'textarea';
          function attachments() {
            // Markdown 上传后会新增网站附件路径，不以预览图片或旧的保存状态判断成功。
            return String(editor.value || '').match(/\/v1\/user\/note-attachments\/[^)\s#]+/g) || [];
          }
          var beforeAttachments = markdown ? attachments() : [];
          var before = wrapper.querySelectorAll("img[data-attachment-id]").length;
          editor.focus();
          if (markdown) editor.setSelectionRange(editor.value.length, editor.value.length);
          else {
            var range = document.createRange();
            range.selectNodeContents(editor.lastChild || editor);
            range.collapse(false);
            var selection = window.getSelection();
            if (selection) { selection.removeAllRanges(); selection.addRange(range); }
          }
          window.setTimeout(function () {
            if (!stillCurrent(token)) return;
            if (!visible(wrapper) || current.editorId && typeof document.getElementById === 'function' && document.getElementById(current.editorId) !== scope) {
              finish(token, 'editor-missing'); return;
            }
            try {
              var event = new Event("paste", { bubbles: true, cancelable: true });
              Object.defineProperty(event, "clipboardData", { value: { files: [file], items: [], getData: function () { return ""; } } });
              (markdown ? editor : wrapper).dispatchEvent(event);
              var started = Date.now();
              function watch() {
                if (!stillCurrent(token)) return;
                var imageCount = wrapper.querySelectorAll("img[data-attachment-id]").length;
                var status = scope.querySelector('[data-note-save-feedback] [data-state], [aria-label="富文本题目笔记"] [data-state]');
                var uploadError = wrapper.querySelector('[role="status"][data-tone="error"]');
                if (uploadError) { finish(token, "upload"); return; }
                var added = markdown ? attachments().some(function (id) { return beforeAttachments.indexOf(id) < 0; }) : imageCount > before;
                if (status && status.getAttribute("data-state") === "error") { finish(token, "save"); return; }
                if (added && status && status.getAttribute("data-state") === "saved") {
                  finish(token, "saved"); return;
                }
                if (Date.now() - started > 45000) { finish(token, "timeout"); return; }
                window.setTimeout(watch, 250);
              }
              watch();
            } catch (error) { finish(token, "paste"); }
          }, 80);
        } catch (error) { finish(token, "paste"); }
      });
      return true;
    }
    function cancel(token) {
      if (!current || current.token !== token) return false;
      var button = current.button;
      if (button) { button.disabled = false; button.textContent = "添加笔记"; }
      current = null;
      return true;
    }
    window.__DAGUANYUAN_NOTE_PASTE__ = { version: 8, prepare: prepare, append: append, commit: commit, cancel: cancel };
    return true;
  }

  function evaluate(controller, script) {
    return new Promise(function (resolve, reject) {
      try {
        controller.webView.evaluateJavaScript(script, function (result, error) {
          if (error) reject(new Error(String(nativeValue(error, "localizedDescription") || error)));
          else resolve(result);
        });
      } catch (error) { reject(error); }
    });
  }

  function accepted(value) {
    if (value === true || value === 1) return true;
    const native = nativeValue(value, "booleanValue");
    return native === true || native === 1 || String(value).toLowerCase() === "true";
  }

  function start(controller, questionId) {
    if (controller.notePasteOperation) return Promise.reject(new Error("上一张图片仍在添加中，请稍候"));
    const id = Number(questionId);
    if (!Number.isSafeInteger(id) || id < 1) return Promise.reject(new Error("题目 ID 无效"));
    let image;
    const token = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const prefix = "window.__DAGUANYUAN_NOTE_PASTE__";
    controller.notePasteOperation = { id, token };
    return evaluate(controller, "String(window.location.href || '')").then(function (url) {
      if (!/^https:\/\/(?:www\.|math\.)?cxyonly\.fans\/(?:math\/)?(?:practice(?:\/(?:(?:categories|concepts)\/)?[1-9]\d*|\/[^/\s<>?#]+\/(?:all|[1-9]\d*)\/[1-9]\d*)?|questions\/[1-9]\d*|retest(?:\/(?:practice|plans))?|paper)\/?(?:[?#][^\s<>]*)?$/.test(String(url || ""))) {
        // 首页搜索不改变网址，额外核对已加载预览中的题号后才读取剪贴板。
        if (!/^https:\/\/(?:www\.|math\.)?cxyonly\.fans\/[^\s<>]*$/.test(String(url || ""))
          || typeof __DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__ === 'undefined') throw new Error("请先打开大观园数学题目页或错题复测页");
        return evaluate(controller, __DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__.questionDOMScript()
          + ";String(!!window.__DAGUANYUAN_QUESTION_DOM__.previewRow(" + id + "))").then(function (ready) {
          if (!accepted(ready)) throw new Error("请先打开大观园数学题目页或错题复测页");
        });
      }
    }).then(function () {
      image = clipboardImage();
      return evaluate(controller, "(" + pageReceiver.toString() + ")();");
    }).then(function () {
      return evaluate(controller, "String(!!(" + prefix + " && " + prefix + ".version === 8))");
    }).then(function (ready) {
      if (!accepted(ready)) throw new Error("无法连接题目笔记编辑器");
      return evaluate(controller, "String(" + prefix + ".prepare(" + [id, token, image.mimeType, image.fileName].map(JSON.stringify).join(",") + "))");
    }).then(function (ready) {
      if (!accepted(ready)) throw new Error("当前题目的添加笔记按钮不可用");
      function send(offset) {
        if (offset >= image.base64.length) return Promise.resolve();
        const part = image.base64.slice(offset, offset + CHUNK_LENGTH);
        return evaluate(controller, "String(" + prefix + ".append(" + JSON.stringify(token) + "," + JSON.stringify(part) + "))").then(function (received) {
          if (!accepted(received)) throw new Error("图片传输中断，请重试");
          return send(offset + CHUNK_LENGTH);
        });
      }
      return send(0);
    }).then(function () {
      return evaluate(controller, "String(" + prefix + ".commit(" + JSON.stringify(token) + "))");
    }).then(function (started) {
      if (!accepted(started)) throw new Error("网站未能开始添加图片");
      NSTimer.scheduledTimerWithTimeInterval(55, false, function () {
        if (controller.notePasteOperation && controller.notePasteOperation.token === token) {
          controller.notePasteOperation = null;
          evaluate(controller, prefix + " && " + prefix + ".cancel(" + JSON.stringify(token) + ")").catch(function () {});
          evaluate(controller, "window.__DAGUANYUAN_QUESTION_TOOLS__&&window.__DAGUANYUAN_QUESTION_TOOLS__.finishNotePaste()").catch(function () {});
        }
      });
      return token;
    }).catch(function (error) {
      if (controller.notePasteOperation && controller.notePasteOperation.token === token) controller.notePasteOperation = null;
      evaluate(controller, prefix + " && " + prefix + ".cancel(" + JSON.stringify(token) + ")").catch(function () {});
      throw error;
    });
  }

  function result(controller, token, status) {
    if (!controller.notePasteOperation || controller.notePasteOperation.token !== token) return null;
    controller.notePasteOperation = null;
    if (status === "saved") return "图片已添加到题目笔记";
    if (status === "upload") return "网站图片上传失败，请查看题目笔记后重试，原有笔记已保留";
    if (status === "save") return "网站未能保存图片，请查看题目笔记";
    if (status === "timeout") return "尚未确认图片保存，请查看题目笔记";
    if (status === "editor-missing") return "未能打开当前题目的笔记编辑器，请先点击网站的“笔记”后重试";
    if (status === "question-changed") return "当前题目已切换，已停止添加图片；如已开始上传，请查看原题笔记确认";
    if (status === "paste") return "图片未能粘贴到笔记编辑器，请打开笔记的编辑模式后重试";
    if (status === "decode") return "图片数据无法读取，请重新复制图片后重试";
    if (status === "changed") return "408 当前题目已切换，图片未继续添加";
    if (status === "permission") return "当前 408 账号尚未开放笔记图片功能";
    if (status === "limit") return "图片超出 408 网站的数量或大小限制，请查看网站提示";
    return "图片未能添加，请查看题目笔记后重试";
  }

  return { start, result, clipboardImage };
})();
