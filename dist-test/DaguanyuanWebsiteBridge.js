var __DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__ = (function () {
  function sendCommand(command) {
    var frame = document.createElement("iframe");
    frame.style.display = "none";
    frame.src = "daguanyuanbridge://" + command;
    document.body.appendChild(frame);
    window.setTimeout(function () { if (frame.parentNode) frame.parentNode.removeChild(frame); }, 600);
  }

  // 此函数只在网站 WebView 内运行，三个工具共用排列逻辑，避免观察器相互移动按钮。
  function questionToolsPageScript(locateEnabled, noteEnabled, singleEnabled) {
    var state = window.__DAGUANYUAN_QUESTION_TOOLS__;
    if (!state || state.version !== 2) {
      if (state) {
        if (state.timer !== null && typeof window.clearTimeout === 'function') window.clearTimeout(state.timer);
        state.timer = -1;
      }
      state = { version: 2, enabled: false, noteEnabled: false, singleEnabled: false, busy: false, noteBusy: false, locateBusy: false, timer: null };
      window.__DAGUANYUAN_QUESTION_TOOLS__ = state;
      window.__DAGUANYUAN_PRACTICE_CARD_BUTTONS__ = state;
      window.__DAGUANYUAN_SINGLE_IMPORT_BUTTONS__ = state;
      function removeButtons(row) {
        ['data-daguanyuan-practice-locate-card', 'data-daguanyuan-practice-add-note', 'data-daguanyuan-408-locate-card', 'data-daguanyuan-408-add-note', 'data-daguanyuan-single-import'].forEach(function (key) {
          var button = row.querySelector('[' + key + ']');
          if (button && button.parentNode) button.parentNode.removeChild(button);
        });
      }
      function sync() {
        state.timer = null;
        var host = window.location.hostname || '';
        var path = window.location.pathname || '';
        var math = /(^|\.)cxyonly\.fans$/i.test(host) && /^\/math\/practice\/\d+(?:\/|$)/.test(path);
        var search = new URLSearchParams(window.location.search || '');
        var collection = search.get('mode') === 'collection' && /^[1-9]\d*$/.test(search.get('collectionId') || '');
        var os408 = /^www\.408os\.cn$/i.test(host) && /^\/exercise\/?$/.test(path)
          && (collection || /[?&](?:year=\d{4}|knowledgeId=[1-9]\d*)(?:[&#]|$)/.test(window.location.search || '')
            && !search.has('mode') && !search.has('collectionId'));
        var rows = document.querySelectorAll(math ? '[data-learning-question-id], article.question-document[data-question-id]' : '.question-card');
        for (var index = 0; index < rows.length; index += 1) {
          var row = rows[index];
          if (math && row.matches('article.question-document[data-question-id]') && row.closest('[data-learning-question-id]')) continue;
          var metadata = row.querySelector(math ? '[data-learning-question-card] > header > div:first-child' : '.question-header > .header-tags');
          var target = { provider: math ? 'math' : '408', url: String(window.location.href || '') };
          var anchor = null;
          if (math) {
            target.id = Number(row.getAttribute('data-learning-question-id') || row.getAttribute('data-question-id'));
            // 来源可能是带视频入口的按钮，也可能是文本标签，均以网站的来源标记定位。
            anchor = metadata && metadata.querySelector('[data-question-source]');
            if (metadata && !anchor) for (var c = 0; c < metadata.children.length; c += 1) {
              if (metadata.children[c].tagName !== 'BUTTON') anchor = metadata.children[c];
            }
            if (!Number.isSafeInteger(target.id) || target.id < 1) anchor = null;
          } else {
            var year = metadata && metadata.querySelector('.year-tag');
            var number = metadata && metadata.querySelector('.index-tag');
            var yearMatch = year && String(year.textContent).match(/^\s*(\d{4})(?:年)?\s*$/);
            var numberMatch = number && String(number.textContent).match(/^\s*第\s*(\d+)\s*题\s*$/);
            target.year = yearMatch && Number(yearMatch[1]);
            target.number = numberMatch && Number(numberMatch[1]);
            if (target.year && target.number) anchor = metadata.querySelector('.score-tag') || number;
          }
          if ((!math && !os408) || !metadata || !anchor) { removeButtons(row); continue; }
          var specs = [
            { key: math ? 'data-daguanyuan-practice-locate-card' : 'data-daguanyuan-408-locate-card', text: '定位卡片', command: 'locate-card', show: state.enabled, busy: state.locateBusy },
            { key: math ? 'data-daguanyuan-practice-add-note' : 'data-daguanyuan-408-add-note', text: '添加笔记', command: 'add-note', show: state.noteEnabled, busy: state.noteBusy },
            { key: 'data-daguanyuan-single-import', text: '导入单题', command: 'import-single', show: state.singleEnabled, busy: state.busy }
          ];
          specs.forEach(function (spec) {
            var button = row.querySelector('[' + spec.key + ']');
            if (!spec.show) { if (button && button.parentNode) button.parentNode.removeChild(button); return; }
            if (!button) {
              button = document.createElement('button');
              button.type = 'button';
              button.addEventListener('click', function (event) {
                event.preventDefault(); event.stopPropagation();
                if (state[spec.command === 'import-single' ? 'busy' : spec.command === 'add-note' ? 'noteBusy' : 'locateBusy']) return;
                sync();
                if (!this.parentNode) return;
                var clicked = JSON.parse(this.getAttribute('data-daguanyuan-question-target'));
                state[spec.command === 'import-single' ? 'busy' : spec.command === 'add-note' ? 'noteBusy' : 'locateBusy'] = true;
                sync();
                sendCommand(spec.command + (clicked.provider === 'math' && spec.command !== 'import-single'
                  ? '?id=' + encodeURIComponent(clicked.id) : '?payload=' + encodeURIComponent(JSON.stringify(clicked))));
              }, true);
            }
            var payload = JSON.stringify(target);
            var identity = spec.command === 'import-single' ? payload : math ? String(target.id) : target.year + ':' + target.number;
            if (button.getAttribute(spec.key) !== identity) button.setAttribute(spec.key, identity);
            if (button.getAttribute('data-daguanyuan-question-target') !== payload) button.setAttribute('data-daguanyuan-question-target', payload);
            var style = 'display:inline-flex;align-items:center;flex:none;margin:0 4px;padding:5px 10px;border:1px solid #7692bc;border-radius:7px;background:#fff;color:#23528f;font-size:12px;line-height:1.4;white-space:nowrap;cursor:pointer';
            if (button.getAttribute('data-daguanyuan-tool-style') !== 'outline-v1') {
              button.style.cssText = style;
              button.setAttribute('data-daguanyuan-tool-style', 'outline-v1');
            }
            var title = spec.busy ? spec.command === 'import-single' ? '导入中…' : spec.command === 'add-note' ? '添加中…' : '定位中…' : spec.text;
            if (button.textContent !== title) button.textContent = title;
            button.disabled = Boolean(spec.busy);
            if (button.parentNode !== metadata || button.previousElementSibling !== anchor) metadata.insertBefore(button, anchor.nextSibling);
            anchor = button;
          });
        }
      }
      state.schedule = function () { if (state.timer !== null) return; state.timer = window.setTimeout(sync, 80); };
      state.finishImport = function () { state.busy = false; state.schedule(); };
      state.finishNotePaste = function () { state.noteBusy = false; state.schedule(); };
      state.finishLocate = function () { state.locateBusy = false; state.schedule(); };
      new MutationObserver(state.schedule).observe(document.documentElement, { childList: true, subtree: true });
      window.addEventListener('popstate', state.schedule);
    }
    if (locateEnabled !== null) state.enabled = locateEnabled;
    if (noteEnabled !== null) state.noteEnabled = noteEnabled;
    if (singleEnabled !== null) state.singleEnabled = singleEnabled;
    state.schedule();
    return true;
  }

  function practicePageScript(enabled, noteEnabled) { return questionToolsPageScript(enabled, noteEnabled, null); }

  function bindCategoryPageScript(bindEnabled, importEnabled) {
    var state = window.__DAGUANYUAN_BIND_CATEGORY_BUTTON__;
    if (state && state.version === 5) {
      state.bindEnabled = bindEnabled;
      state.importEnabled = importEnabled;
      state.schedule();
      return true;
    }
    var previous = state;
    if (previous) {
      if (previous.timer !== null && typeof window.clearTimeout === 'function') window.clearTimeout(previous.timer);
      previous.timer = -1;
    }
    var oldToolbar = document.querySelector("[data-daguanyuan-bind-category-wrap]");
    if (oldToolbar && oldToolbar.parentNode) oldToolbar.parentNode.removeChild(oldToolbar);
    state = { version: 5, bindEnabled: bindEnabled, importEnabled: importEnabled,
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
        && /[?&](?:year=\d{4}|knowledgeId=[1-9]\d*)(?:[&#]|$)/.test(window.location.search || "")
        && !/[?&](?:mode|collectionId)=/.test(window.location.search || "");
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

  function singleImportPageScript(enabled) { return questionToolsPageScript(null, null, enabled); }

  function toolsScript(receiver, args) {
    return '(function () { var sendCommand = ' + sendCommand.toString() + '; var questionToolsPageScript = ' + questionToolsPageScript.toString() + '; return (' + receiver.toString() + ')(' + args + '); })();';
  }
  function singleImportScript(enabled) { return toolsScript(singleImportPageScript, enabled ? 'true' : 'false'); }
  function practiceScript(enabled, noteEnabled) { return toolsScript(practicePageScript, (enabled === false ? 'false' : 'true') + ',' + (noteEnabled ? 'true' : 'false')); }
  function bindCategoryScript(bindEnabled, importEnabled) {
    return '(function () { var sendCommand = ' + sendCommand.toString() + '; return (' + bindCategoryPageScript.toString() + ')(' + (bindEnabled ? 'true' : 'false') + ',' + (importEnabled ? 'true' : 'false') + '); })();';
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

  return { practiceScript, bindCategoryScript, singleImportScript, importContextScript };
})();
