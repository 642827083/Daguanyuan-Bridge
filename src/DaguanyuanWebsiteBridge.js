var __DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__ = (function () {
  function sendCommand(command) {
    var frame = document.createElement("iframe");
    frame.style.display = "none";
    frame.src = "daguanyuanbridge://" + command;
    document.body.appendChild(frame);
    window.setTimeout(function () { if (frame.parentNode) frame.parentNode.removeChild(frame); }, 600);
  }

  function practicePageScript(enabled, noteEnabled) {
    var state = window.__DAGUANYUAN_PRACTICE_CARD_BUTTONS__;
    if (state && state.version === 5) { state.enabled = enabled; state.noteEnabled = noteEnabled; state.schedule(); return true; }
    var previous = state;
    if (previous) previous.timer = -1;
    state = { version: 5, enabled: enabled, noteEnabled: noteEnabled, timer: null, schedule: null };
    window.__DAGUANYUAN_PRACTICE_CARD_BUTTONS__ = state;
    function sync() {
      state.timer = null;
      if (previous) previous.timer = -1;
      var active = /(^|\.)cxyonly\.fans$/i.test(window.location.hostname || "")
        && /^\/math\/practice\/\d+(?:\/|$)/.test(window.location.pathname || "");
      var rows = document.querySelectorAll("[data-learning-question-id], article.question-document[data-question-id]");
      for (var index = 0; index < rows.length; index += 1) {
        var row = rows[index];
        if (row.matches("article.question-document[data-question-id]") && row.closest("[data-learning-question-id]")) continue;
        var id = Number(row.getAttribute("data-learning-question-id") || row.getAttribute("data-question-id"));
        var button = row.querySelector("[data-daguanyuan-practice-locate-card]");
        var noteButton = row.querySelector("[data-daguanyuan-practice-add-note]");
        if (!active || !Number.isSafeInteger(id) || id < 1) {
          if (button && button.parentNode) button.parentNode.removeChild(button);
          if (noteButton && noteButton.parentNode) noteButton.parentNode.removeChild(noteButton);
          continue;
        }
        var metadata = row.querySelector('[data-learning-question-card] > header > div:first-child');
        var number = metadata && metadata.querySelector("strong");
        if (!number) {
          if (button && button.parentNode) button.parentNode.removeChild(button);
          if (noteButton && noteButton.parentNode) noteButton.parentNode.removeChild(noteButton);
          continue;
        }
        if (!state.enabled && button && button.parentNode) button.parentNode.removeChild(button);
        if (!state.noteEnabled && noteButton && noteButton.parentNode) noteButton.parentNode.removeChild(noteButton);
        if (state.enabled && !button) {
          button = document.createElement("button");
          button.type = "button";
          button.textContent = "定位卡片";
          button.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            sendCommand("locate-card?id=" + encodeURIComponent(this.getAttribute("data-daguanyuan-practice-locate-card")));
          }, true);
        }
        if (state.enabled) {
          button.setAttribute("data-daguanyuan-practice-locate-card", String(id));
          button.style.cssText = "display:inline-flex;align-items:center;flex:none;margin:0 4px;padding:5px 10px;border:1px solid #7692bc;border-radius:7px;background:#fff;color:#23528f;font-size:12px;line-height:1.4;white-space:nowrap;cursor:pointer";
          if (button.parentNode !== metadata || button.previousElementSibling !== number) {
            metadata.insertBefore(button, number.nextSibling);
          }
        }
        if (state.noteEnabled && !noteButton) {
          noteButton = document.createElement("button");
          noteButton.type = "button";
          noteButton.textContent = "添加笔记";
          noteButton.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            sendCommand("add-note?id=" + encodeURIComponent(this.getAttribute("data-daguanyuan-practice-add-note")));
          }, true);
        }
        if (state.noteEnabled) {
          noteButton.setAttribute("data-daguanyuan-practice-add-note", String(id));
          noteButton.style.cssText = "display:inline-flex;align-items:center;flex:none;margin:0 4px;padding:5px 10px;border:1px solid #7692bc;border-radius:7px;background:#fff;color:#23528f;font-size:12px;line-height:1.4;white-space:nowrap;cursor:pointer";
          var preceding = state.enabled ? button : number;
          if (noteButton.parentNode !== metadata || noteButton.previousElementSibling !== preceding) {
            metadata.insertBefore(noteButton, preceding.nextSibling);
          }
        }
      }
    }
    state.schedule = function () {
      if (state.timer !== null) return;
      state.timer = window.setTimeout(sync, 80);
    };
    new MutationObserver(state.schedule).observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener("popstate", state.schedule);
    state.schedule();
    return true;
  }

  function bindCategoryPageScript(bindEnabled, importEnabled) {
    var state = window.__DAGUANYUAN_BIND_CATEGORY_BUTTON__;
    if (state && state.version === 4) {
      state.bindEnabled = bindEnabled;
      state.importEnabled = importEnabled;
      state.schedule();
      return true;
    }
    var previous = state;
    if (previous) previous.timer = -1;
    var oldToolbar = document.querySelector("[data-daguanyuan-bind-category-wrap]");
    if (oldToolbar && oldToolbar.parentNode) oldToolbar.parentNode.removeChild(oldToolbar);
    state = { version: 4, bindEnabled: bindEnabled, importEnabled: importEnabled,
      importBusy: false, timer: null, schedule: null, finishImport: null, contextStyle: null };
    window.__DAGUANYUAN_BIND_CATEGORY_BUTTON__ = state;
    function restoreContextStyle() {
      var saved = state.contextStyle;
      if (!saved) return;
      saved.element.style.display = saved.display;
      saved.element.style.alignItems = saved.alignItems;
      saved.element.style.gap = saved.gap;
      state.contextStyle = null;
    }
    function sync() {
      state.timer = null;
      if (previous) previous.timer = -1;
      var host = window.location.hostname || "";
      var path = window.location.pathname || "";
      var math = /(^|\.)cxyonly\.fans$/i.test(host) && /^\/math\/practice\/\d+(?:\/|$)/.test(path);
      var os408 = /^www\.408os\.cn$/i.test(host) && /^\/exercise\/?$/.test(path)
        && /[?&](?:year=\d{4}|knowledgeId=[1-9]\d*)(?:[&#]|$)/.test(window.location.search || "");
      var canBind = math || os408 && /[?&]year=\d{4}(?:[&#]|$)/.test(window.location.search || "");
      var active = (math || os408) && (state.importEnabled || state.bindEnabled && canBind);
      var toolbar = document.querySelector("[data-daguanyuan-bind-category-wrap]");
      if (!active) {
        if (toolbar && toolbar.parentNode) toolbar.parentNode.removeChild(toolbar);
        restoreContextStyle();
        return;
      }
      var target = math
        ? document.querySelector('[data-learning-question-practice-toolbar] [data-slot="context"]')
        : document.querySelector(".exercise-header > .header-left");
      if (!target) {
        restoreContextStyle();
        return;
      }
      var selector = math && target.querySelector('[class*="chapterSelector"]');
      if (math && !selector) {
        if (toolbar && toolbar.parentNode) toolbar.parentNode.removeChild(toolbar);
        restoreContextStyle();
        return;
      }
      if (toolbar && toolbar.parentNode !== target) {
        toolbar.parentNode.removeChild(toolbar);
      }
      if (!toolbar) {
        toolbar = document.createElement("div");
        toolbar.setAttribute("data-daguanyuan-bind-category-wrap", "");
      }
      var bindButton = toolbar.querySelector("[data-daguanyuan-bind-category]");
      if (state.bindEnabled && canBind && !bindButton) {
        bindButton = document.createElement("button");
        bindButton.type = "button";
        bindButton.setAttribute("data-daguanyuan-bind-category", "");
        bindButton.textContent = "绑定当前分类";
        bindButton.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          sendCommand("bind-category");
        }, true);
        toolbar.insertBefore(bindButton, toolbar.firstChild);
      }
      if ((!state.bindEnabled || !canBind) && bindButton && bindButton.parentNode) {
        bindButton.parentNode.removeChild(bindButton);
        bindButton = null;
      }
      var importButton = toolbar.querySelector("[data-daguanyuan-import-category]");
      if (state.importEnabled && !importButton) {
        importButton = document.createElement("button");
        importButton.type = "button";
        importButton.setAttribute("data-daguanyuan-import-category", "");
        importButton.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          if (state.importBusy) return;
          state.importBusy = true;
          sync();
          sendCommand("import-category");
        }, true);
        toolbar.appendChild(importButton);
      }
      if (!state.importEnabled && importButton && importButton.parentNode) {
        importButton.parentNode.removeChild(importButton);
        importButton = null;
      }
      var buttonStyle = "padding:7px 12px;border:0;border-radius:8px;background:#2572d2;color:#fff;font-size:13px;white-space:nowrap;cursor:pointer";
      if (bindButton) bindButton.style.cssText = buttonStyle;
      if (importButton) {
        importButton.style.cssText = buttonStyle;
        importButton.textContent = state.importBusy ? "导入中…" : "导入当前题目";
        importButton.title = "导入当前分类的全部题目";
        importButton.disabled = state.importBusy;
      }
      toolbar.style.cssText = math
        ? "display:inline-flex;align-items:center;gap:8px;flex:none;position:relative;z-index:10"
        : "display:inline-flex;align-items:center;gap:8px;flex:none;margin-left:8px;position:relative;z-index:10";
      if (math) {
        if (!state.contextStyle || state.contextStyle.element !== target) {
          restoreContextStyle();
          state.contextStyle = {
            element: target,
            display: target.style.display,
            alignItems: target.style.alignItems,
            gap: target.style.gap,
          };
        }
        target.style.display = "flex";
        target.style.alignItems = "center";
        target.style.gap = "8px";
      } else restoreContextStyle();
      if (toolbar.parentNode !== target || math && toolbar.previousElementSibling !== selector || os408 && toolbar.nextSibling) {
        target.insertBefore(toolbar, math ? selector.nextSibling : null);
      }
    }
    state.schedule = function () {
      if (state.timer !== null) return;
      state.timer = window.setTimeout(sync, 80);
    };
    state.finishImport = function () {
      state.importBusy = false;
      state.schedule();
    };
    new MutationObserver(state.schedule).observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener("popstate", state.schedule);
    state.schedule();
    return true;
  }

  function practiceScript(enabled, noteEnabled) {
    return "(function () { var sendCommand = " + sendCommand.toString() + "; return (" + practicePageScript.toString() + ")(" + (enabled === false ? "false" : "true") + "," + (noteEnabled ? "true" : "false") + "); })();";
  }

  function bindCategoryScript(bindEnabled, importEnabled) {
    return "(function () { var sendCommand = " + sendCommand.toString() + "; return (" + bindCategoryPageScript.toString() + ")(" + (bindEnabled ? "true" : "false") + "," + (importEnabled ? "true" : "false") + "); })();";
  }

  function readImportContext() {
    var scopeControl = document.querySelector(".learning-shell__scope-toggle[data-scope]");
    var scope = scopeControl ? String(scopeControl.getAttribute("data-scope") || "") : "";
    if (!scope) {
      try {
        var stored = window.localStorage.getItem("daguan:question-bank-scope");
        scope = stored === "core" || stored === "exam" ? stored : "complete";
      } catch (ignored) {}
    }
    return JSON.stringify({
      url: String(window.location.href || ""),
      scope: scope,
    });
  }

  function importContextScript() {
    return "(" + readImportContext.toString() + ")();";
  }

  return { practiceScript, bindCategoryScript, importContextScript };
})();
