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
    if (window.__DAGUANYUAN_NOTE_PASTE__ && window.__DAGUANYUAN_NOTE_PASTE__.version === 2) return true;
    var current = null;
    function validPage() {
      return /(^|\.)cxyonly\.fans$/i.test(window.location.hostname || "")
        && (/^\/math\/practice\/\d+(?:\/|$)/.test(window.location.pathname || "")
          || /^\/math\/retest(?:\/|$)/.test(window.location.pathname || ""));
    }
    function questionRow(id) {
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
      var button = buttonFor(questionRow(current.id) || document);
      if (button) { button.disabled = false; button.textContent = "添加笔记"; }
      current = null;
      sendResult(token, status);
    }
    function prepare(id, token, mimeType, fileName) {
      if (!validPage() || !questionRow(id) || current) return false;
      var row = questionRow(id);
      var button = buttonFor(row);
      if (!button) return false;
      current = { id: id, token: token, mimeType: mimeType, fileName: fileName, chunks: [] };
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
      function check() {
        if (!current || current.token !== token || !validPage()) return;
        var row = questionRow(current.id);
        if (!row) { finish(token, "missing"); return; }
        var scope = row;
        var wrapper = scope.querySelector('[data-note-rich-editor="true"]');
        if (!wrapper && noteOpened) {
          scope = noteDialog();
          wrapper = scope && scope.querySelector('[data-note-rich-editor="true"]');
        }
        var editor = wrapper && wrapper.querySelector('[data-note-editor="true"]');
        if (wrapper && editor) { callback(scope, wrapper, editor); return; }
        if (!noteOpened) {
          var buttons = row.querySelectorAll("button");
          var noteButton = null;
          var moreButton = null;
          for (var index = 0; index < buttons.length; index += 1) {
            if (buttons[index].hasAttribute("data-daguanyuan-practice-add-note")
              || buttons[index].hasAttribute("data-daguanyuan-retest-add-note")) continue;
            var label = String(buttons[index].textContent || "").trim();
            if (label === "查看笔记" || label === "添加笔记") { noteButton = buttons[index]; break; }
            if (label === "更多操作") moreButton = buttons[index];
          }
          if (noteButton) { noteButton.click(); noteOpened = true; }
          else if (!moreOpened && moreButton) { moreButton.click(); moreOpened = true; }
        }
        attempts += 1;
        if (attempts > 60) { finish(token, "missing"); return; }
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
          var before = wrapper.querySelectorAll("img[data-attachment-id]").length;
          editor.focus();
          var range = document.createRange();
          range.selectNodeContents(editor.lastChild || editor);
          range.collapse(false);
          var selection = window.getSelection();
          if (selection) { selection.removeAllRanges(); selection.addRange(range); }
          window.setTimeout(function () {
            if (!current || current.token !== token) return;
            try {
              var event = new Event("paste", { bubbles: true, cancelable: true });
              Object.defineProperty(event, "clipboardData", { value: { files: [file], items: [], getData: function () { return ""; } } });
              wrapper.dispatchEvent(event);
              var started = Date.now();
              function watch() {
                if (!current || current.token !== token || !validPage()) return;
                var imageCount = wrapper.querySelectorAll("img[data-attachment-id]").length;
                var status = scope.querySelector('[aria-label="富文本题目笔记"] [data-state]');
                if (status && status.getAttribute("data-state") === "error") { finish(token, "save"); return; }
                if (imageCount > before && status && status.getAttribute("data-state") === "saved") {
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
      var button = buttonFor(questionRow(current.id) || document);
      if (button) { button.disabled = false; button.textContent = "添加笔记"; }
      current = null;
      return true;
    }
    window.__DAGUANYUAN_NOTE_PASTE__ = { version: 2, prepare: prepare, append: append, commit: commit, cancel: cancel };
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
      if (!/^https:\/\/(?:www\.)?cxyonly\.fans\/math\/(?:practice\/\d+|retest(?:\/|$))/.test(String(url || ""))) {
        throw new Error("请先打开大观园数学题目页或错题复测页");
      }
      image = clipboardImage();
      return evaluate(controller, "(" + pageReceiver.toString() + ")();");
    }).then(function () {
      return evaluate(controller, "String(!!(" + prefix + " && " + prefix + ".version === 2))");
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
    if (status === "save") return "网站未能保存图片，请查看题目笔记";
    if (status === "timeout") return "尚未确认图片保存，请查看题目笔记";
    if (status === "changed") return "408 当前题目已切换，图片未继续添加";
    if (status === "permission") return "当前 408 账号尚未开放笔记图片功能";
    if (status === "limit") return "图片超出 408 网站的数量或大小限制，请查看网站提示";
    if (status === "upload") return "408 题目笔记图片上传失败，请重试";
    return "图片未能添加，请查看题目笔记后重试";
  }

  return { start, result, clipboardImage };
})();
