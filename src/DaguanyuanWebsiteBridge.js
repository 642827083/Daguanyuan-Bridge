var __DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__ = (function () {
  function sendCommand(command) {
    var frame = document.createElement("iframe");
    frame.style.display = "none";
    frame.src = "daguanyuanbridge://" + command;
    document.body.appendChild(frame);
    window.setTimeout(function () { if (frame.parentNode) frame.parentNode.removeChild(frame); }, 600);
  }

  // 在网站内安装一次；题目工具与选题快照共用身份、可见性和来源位置的判断。
  function questionDOMPageScript() {
    if (window.__DAGUANYUAN_QUESTION_DOM__) return window.__DAGUANYUAN_QUESTION_DOM__;
    function context() {
      var current = window.location || location;
      var address = current.hostname ? current : new URL(current.href);
      var host = address.hostname || '', path = address.pathname || '';
      var provider = address.protocol && address.protocol !== 'https:' ? ''
        : /^(?:www\.)?cxyonly\.fans$/i.test(host) ? 'math' : /^www\.408os\.cn$/i.test(host) ? '408' : '';
      var search = new URLSearchParams(address.search || '');
      var retest = provider === 'math' && /^\/math\/retest(?:\/|$)/.test(path);
      var collection = search.get('mode') === 'collection' && /^[1-9]\d*$/.test(search.get('collectionId') || '');
      var supported = provider === 'math'
        ? /^\/math\/(?:practice(?:\/(?:(?:categories|concepts)\/)?[1-9]\d*|\/[^/\s?#]+\/(?:all|[1-9]\d*)\/[1-9]\d*)?|questions\/[1-9]\d*|paper|retest(?:\/[^?#]*)?)\/?$/.test(path)
        : provider === '408' && /^\/exercise\/?$/.test(path) && (collection || !search.has('mode') && !search.has('collectionId')
          && /[?&](?:year=\d{4}|knowledgeId=[1-9]\d*)(?:[&#]|$)/.test(address.search || ''));
      return { provider: provider, supported: supported, retest: retest, url: String(current.href || '') };
    }
    function visible(row) {
      for (var node = row; node; node = node.parentElement || node.parentNode) {
        if (node.hidden || node.getAttribute && (node.getAttribute('hidden') !== null || node.getAttribute('aria-hidden') === 'true'
          || node.getAttribute('inert') !== null)) return false;
        if (node.nodeType === 1 && typeof window.getComputedStyle === 'function') {
          var style = window.getComputedStyle(node);
          if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
        }
      }
      return true;
    }
    function read() {
      var page = context(), math = page.provider === 'math', questions = [], seen = [];
      if (!page.provider) return { page: page, questions: questions };
      var selector = math ? '[data-learning-question-id], article.question-document[data-question-id], [data-retest-question-id], [data-retest-schedule-question-id]' : '.question-card';
      var rows = Array.prototype.slice.call(document.querySelectorAll(selector));
      if (page.retest) rows = rows.concat(Array.prototype.slice.call(document.querySelectorAll('[role="dialog"]')));
      rows.forEach(function (original) {
        if (original.closest('#dgy-dialog, #dgy-toolbar')) return;
        if (math && original.matches('article.question-document[data-question-id]')
          && original.closest('[data-learning-question-id], [data-retest-question-id], [data-retest-schedule-question-id]')) return;
        if (page.retest && original.getAttribute('role') !== 'dialog' && original.closest('[role="dialog"]')) return;
        var id = math ? Number(original.getAttribute('data-learning-question-id') || original.getAttribute('data-question-id')
          || original.getAttribute('data-retest-question-id') || original.getAttribute('data-retest-schedule-question-id')) : 0;
        var row = math && original.matches('article.question-document[data-question-id]') ? original.closest('[data-learning-question-card]') || original : original;
        if (seen.indexOf(row) >= 0) return;
        seen.push(row);
        if (!visible(row)) return;
        if (page.retest && row.getAttribute('role') === 'dialog') {
          var headingId = row.getAttribute('aria-labelledby');
          var heading = headingId && document.getElementById(headingId) || row.querySelector('h1, h2, [role="heading"]');
          var title = heading && String(heading.textContent).match(/^\s*题目\s+([1-9]\d*)\s*$/);
          id = title ? Number(title[1]) : 0;
        }
        var focus = math && row.querySelector('[data-focus-question-metadata]');
        var metadata = focus && focus.querySelector('[data-question-source]') ? focus
          : row.querySelector(math ? '[data-learning-question-card] > header > div:first-child' : '.question-header > .header-tags');
        var source = row.querySelector('[data-question-source]');
        var anchor = metadata && metadata.querySelector(math ? '[data-question-source]' : '.score-tag');
        var target = { provider: page.provider, url: page.url };
        if (math) {
          target.id = id;
          if (!page.retest && metadata && !anchor) for (var c = 0; c < metadata.children.length; c += 1) {
            if (metadata.children[c].tagName !== 'BUTTON') anchor = metadata.children[c];
          }
          // 复测计划摘要只提供预览入口，不是完整题目。
          if (page.retest && original.getAttribute('data-retest-schedule-question-id') && !source && !original.querySelector('[data-learning-question-card], article.question-document')) return;
        } else {
          var year = row.querySelector('.year-tag'), number = row.querySelector('.index-tag');
          var yearMatch = year && String(year.textContent).match(/^\s*(\d{4})(?:年)?\s*$/);
          var numberMatch = number && String(number.textContent).match(/^\s*第\s*(\d+)\s*题\s*$/);
          target.year = yearMatch ? Number(yearMatch[1]) : 0;
          target.number = numberMatch ? Number(numberMatch[1]) : 0;
          if (target.year < 2009 || target.year > 2100 || target.number < 1 || target.number > 47) return;
          id = (target.year - 2009) * 47 + target.number;
          anchor = anchor || metadata && metadata.querySelector('.index-tag');
        }
        if (!Number.isSafeInteger(id) || id < 1) return;
        questions.push({ row: row, id: id, target: target, metadata: metadata, anchor: anchor,
          title: math ? source && String(source.textContent).trim() : target.year + '年 第' + target.number + '题' });
      });
      return { page: page, questions: questions };
    }
    window.__DAGUANYUAN_QUESTION_DOM__ = { read: read };
    return window.__DAGUANYUAN_QUESTION_DOM__;
  }

  function questionDOMScript() { return '(' + questionDOMPageScript.toString() + ')();'; }

  // 此函数只在网站 WebView 内运行，三个工具共用排列逻辑，避免观察器相互移动按钮。
  function questionToolsPageScript(locateEnabled, noteEnabled, singleEnabled) {
    var state = window.__DAGUANYUAN_QUESTION_TOOLS__;
    if (!state || state.version !== 7) {
      if (state) {
        if (state.timer !== null && typeof window.clearTimeout === 'function') window.clearTimeout(state.timer);
        state.timer = -1;
      }
      var oldRetest = window.__DAGUANYUAN_RETEST_CARD_BUTTONS__;
      if (oldRetest) {
        if (typeof window.clearTimeout === 'function') window.clearTimeout(oldRetest.timer);
        oldRetest.timer = -1;
      }
      var legacy = document.querySelectorAll('[data-daguanyuan-locate-card], [data-daguanyuan-retest-add-note]');
      for (var l = 0; l < legacy.length; l += 1) if (legacy[l].parentNode) legacy[l].parentNode.removeChild(legacy[l]);
      state = { version: 7, enabled: false, noteEnabled: false, singleEnabled: false, busy: false, noteBusy: false, locateBusy: false, timer: null };
      window.__DAGUANYUAN_QUESTION_TOOLS__ = state;
      window.__DAGUANYUAN_PRACTICE_CARD_BUTTONS__ = state;
      window.__DAGUANYUAN_SINGLE_IMPORT_BUTTONS__ = state;
      window.__DAGUANYUAN_RETEST_CARD_BUTTONS__ = state;
      function removeButtons(row) {
        ['data-daguanyuan-practice-locate-card', 'data-daguanyuan-practice-add-note', 'data-daguanyuan-408-locate-card', 'data-daguanyuan-408-add-note', 'data-daguanyuan-single-import'].forEach(function (key) {
          var button = row.querySelector('[' + key + ']');
          if (button && button.parentNode) button.parentNode.removeChild(button);
        });
      }
      function sync() {
        state.timer = null;
        var snapshot = window.__DAGUANYUAN_QUESTION_DOM__.read();
        var math = snapshot.page.provider === 'math', retest = snapshot.page.retest;
        if (!snapshot.page.supported) {
          // 离开题目页时清理旧按钮，避免同页导航后遗留可点击的旧题目操作。
          var stale = document.querySelectorAll('[data-daguanyuan-question-target]');
          for (var s = 0; s < stale.length; s += 1) if (stale[s].parentNode) stale[s].parentNode.removeChild(stale[s]);
          return;
        }
        var kept = [];
        for (var index = 0; index < snapshot.questions.length; index += 1) {
          var question = snapshot.questions[index], row = question.row;
          if (!retest && !row.getAttribute('data-learning-question-id') && (row.getAttribute('data-retest-question-id') || row.getAttribute('data-retest-schedule-question-id') || row.getAttribute('role') === 'dialog')) { removeButtons(row); continue; }
          var metadata = question.metadata, target = question.target, anchor = question.anchor;
          if (!metadata || !anchor) { removeButtons(row); continue; }
          var specs = [
            { key: math ? 'data-daguanyuan-practice-locate-card' : 'data-daguanyuan-408-locate-card', text: '定位卡片', command: 'locate-card', show: state.enabled, busy: state.locateBusy },
            { key: math ? 'data-daguanyuan-practice-add-note' : 'data-daguanyuan-408-add-note', text: '添加笔记', command: 'add-note', show: state.noteEnabled, busy: state.noteBusy },
            { key: 'data-daguanyuan-single-import', text: '导入本题', command: 'import-single', show: state.singleEnabled && !retest, busy: state.busy }
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
                if (!this.parentNode || typeof document.documentElement.contains === 'function' && !document.documentElement.contains(this)) return;
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
            kept.push(button);
            anchor = button;
          });
        }
        var unused = document.querySelectorAll('[data-daguanyuan-question-target]');
        for (var u = 0; u < unused.length; u += 1) if (kept.indexOf(unused[u]) < 0 && unused[u].parentNode) unused[u].parentNode.removeChild(unused[u]);
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

  function bindCategoryPageScript(bindEnabled, importEnabled, selectionEnabled) {
    var state = window.__DAGUANYUAN_BIND_CATEGORY_BUTTON__;
    if (state && state.version === 8) {
      state.bindEnabled = bindEnabled;
      state.importEnabled = importEnabled;
      state.selectionEnabled = selectionEnabled;
      state.schedule();
      return true;
    }
    var previous = state;
    if (previous) {
      if (previous.timer !== null && typeof window.clearTimeout === 'function') window.clearTimeout(previous.timer);
      previous.timer = -1;
      var saved = previous.contextStyle;
      if (saved) {
        saved.element.style.display = saved.display;
        saved.element.style.alignItems = saved.alignItems;
        saved.element.style.gap = saved.gap;
      }
    }
    state = { version: 8, bindEnabled: bindEnabled, importEnabled: importEnabled, selectionEnabled: selectionEnabled,
      importBusy: Boolean(previous && previous.importBusy), timer: null, schedule: null, finishImport: null };
    window.__DAGUANYUAN_BIND_CATEGORY_BUTTON__ = state;
    function sync() {
      state.timer = null;
      if (previous) previous.timer = -1;
      // 绑定与直接导入统一放在右下角，移除旧页顶入口。
      var toolbar = document.querySelector('[data-daguanyuan-bind-category-wrap]');
      if (toolbar && toolbar.parentNode) toolbar.parentNode.removeChild(toolbar);
      if (window.__DAGUANYUAN_IMPORT_UI__) window.__DAGUANYUAN_IMPORT_UI__.refresh();
    }
    state.schedule = function () {
      if (state.timer !== null) return;
      state.timer = window.setTimeout(sync, 80);
    };
    state.finishImport = function () {
      state.importBusy = false;
      var ui = window.__DAGUANYUAN_IMPORT_UI__;
      if (ui && typeof ui.finishDirectImport === 'function') ui.finishDirectImport();
      state.schedule();
    };
    new MutationObserver(state.schedule).observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('popstate', state.schedule);
    state.schedule();
    return true;
  }

  function singleImportPageScript(enabled) { return questionToolsPageScript(null, null, enabled); }

  function toolsScript(receiver, args) {
    return questionDOMScript() + '(function () { var sendCommand = ' + sendCommand.toString() + '; var questionToolsPageScript = ' + questionToolsPageScript.toString() + '; return (' + receiver.toString() + ')(' + args + '); })();';
  }
  function singleImportScript(enabled) { return toolsScript(singleImportPageScript, enabled ? 'true' : 'false'); }
  function practiceScript(enabled, noteEnabled) { return toolsScript(practicePageScript, (enabled === false ? 'false' : 'true') + ',' + (noteEnabled ? 'true' : 'false')); }
  function bindCategoryScript(bindEnabled, importEnabled, selectionEnabled) {
    return '(function () { var sendCommand = ' + sendCommand.toString() + '; return (' + bindCategoryPageScript.toString() + ')(' + (bindEnabled ? 'true' : 'false') + ',' + (importEnabled ? 'true' : 'false') + ',' + (selectionEnabled === false ? 'false' : 'true') + '); })();';
  }

  function readImportContext() {
    var query = new URLSearchParams(window.location.search || '');
    var scopeControl = document.querySelector(".learning-shell__scope-toggle[data-scope]");
    var scope = query.get('scope') || (scopeControl ? String(scopeControl.getAttribute("data-scope") || "") : "");
    if (!scope && query.get('listId')) scope = 'complete';
    if (!scope) {
      try {
        var stored = window.localStorage.getItem("daguan:question-bank-scope");
        scope = stored === "core" || stored === "exam" ? stored : "complete";
      } catch (ignored) {}
    }
    return JSON.stringify({
      url: String(window.location.href || ""),
      scope: scope,
      selection: { listId: query.get('listId') || '' },
    });
  }

  function importContextScript() {
    return "(" + readImportContext.toString() + ")();";
  }

  // 年份单题直接由网站按 ID 加载；这里只补齐标题和按需进入整卷的模式入口。
  function directYearQuestionPageScript() {
    var state = window.__DAGUANYUAN_408_DIRECT_YEAR__;
    var marker = "data-daguanyuan-408-direct-modes";
    function source() {
      var query = new URLSearchParams(window.location.search || "");
      var year = query.get("year"), id = query.get("questionId");
      if (window.location.hostname !== "www.408os.cn" || !/^\/exercise\/?$/.test(window.location.pathname)
        || query.get("knowledgeId") || query.get("mode") || query.get("collectionId")
        || !/^\d{4}$/.test(year || "") || Number(year) < 2009 || Number(year) > 2100
        || !/^[1-9]\d*$/.test(id || "") || !Number.isSafeInteger(Number(id))) return null;
      var number = Number(id) - 47 * (Number(year) - 2009);
      return number >= 1 && number <= 47 ? { year: year, id: id, number: number } : null;
    }
    function removeModes() {
      var modes = document.querySelectorAll("[" + marker + "]");
      for (var index = 0; index < modes.length; index++) modes[index].remove();
    }
    var initial = source();
    if (!initial) { if (state) state.dispose(); return false; }
    if (state) { state.sync(); return "direct:" + initial.year + ":" + initial.id; }
    state = { timer: null, observer: null, sync: sync, dispose: dispose };
    window.__DAGUANYUAN_408_DIRECT_YEAR__ = state;
    function dispose() {
      if (state.observer) state.observer.disconnect();
      window.clearTimeout(state.timer);
      window.removeEventListener("popstate", schedule);
      window.removeEventListener("resize", schedule);
      removeModes();
      if (window.__DAGUANYUAN_408_DIRECT_YEAR__ === state) window.__DAGUANYUAN_408_DIRECT_YEAR__ = null;
    }
    function schedule() {
      if (state.timer !== null) return;
      state.timer = window.setTimeout(function () { state.timer = null; sync(); }, 80);
    }
    function scoped(element, reference) {
      // 继承页面实际作用域属性，复用网站按钮样式，不访问 Vue 私有实例。
      var attributes = reference.attributes || [];
      var nodes = [element].concat(Array.prototype.slice.call(element.querySelectorAll("*")));
      for (var index = 0; index < attributes.length; index++) {
        if (!/^data-v-/.test(attributes[index].name)) continue;
        for (var nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) nodes[nodeIndex].setAttribute(attributes[index].name, "");
      }
    }
    function addModes(parent, title, mobile) {
      if (!parent || parent.querySelector("[" + marker + "]")) return;
      if (parent.querySelector(mobile ? ".mode-switch-mobile" : ".mode-switch")) return;
      var wrap = document.createElement("div");
      wrap.setAttribute(marker, "");
      wrap.className = mobile ? "settings-section" : "mode-switch mode-switch-left";
      var modes = wrap;
      if (mobile) {
        var label = document.createElement("div"); label.className = "settings-label"; label.textContent = "显示模式";
        wrap.appendChild(label);
        modes = document.createElement("div"); modes.className = "mode-switch-mobile"; wrap.appendChild(modes);
      }
      var shapes = [
        '<rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="9" y1="9" x2="21" y2="9"></line><line x1="9" y1="15" x2="21" y2="15"></line>',
        '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline>',
      ];
      for (var index = 0; index < 2; index++) {
        var button = document.createElement("button"); button.type = "button";
        button.className = (mobile ? "mode-btn-mobile" : "mode-btn") + (index ? " active" : "");
        button.setAttribute("aria-label", index ? "单题模式" : "列表模式");
        button.setAttribute("aria-pressed", index ? "true" : "false");
        button.innerHTML = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + shapes[index] + '</svg><span>'
          + (mobile ? (index ? "单题" : "列表") : (index ? "单题模式" : "列表模式")) + '</span>';
        button.addEventListener("click", index ? function (event) { event.preventDefault(); event.stopPropagation(); }
          : function (event) {
            event.preventDefault(); event.stopPropagation();
            var current = source();
            if (!current) return;
            // 用户主动进入列表时才加载整卷，并在列表中选中当前题；普通切题不会经过这里。
            window.location.assign("/exercise?year=" + current.year + "&daguanyuanQuestionId=" + current.id + "&daguanyuanView=list");
          });
        modes.appendChild(button);
      }
      scoped(wrap, title);
      if (mobile) parent.insertBefore(wrap, parent.firstChild);
      else parent.insertBefore(wrap, title.nextSibling);
    }
    function sync() {
      var current = source();
      if (!current) return dispose();
      var title = document.querySelector(".exercise-header .header-title") || document.querySelector(".exercise-header h1");
      // 网站恢复整卷（例如答题后自动切题）时会重新创建原有模式按钮，移除补充入口以免重复。
      var nativeModes = document.querySelectorAll(".mode-switch, .mode-switch-mobile");
      for (var modeIndex = 0; modeIndex < nativeModes.length; modeIndex++) {
        if (!nativeModes[modeIndex].closest("[" + marker + "]")) { removeModes(); break; }
      }
      var card = document.querySelector(".single-question-wrapper .question-card");
      var number = card && card.querySelector(".index-tag"), year = card && card.querySelector(".year-tag");
      if (!title || !number || String(number.textContent || "").trim() !== "第" + current.number + "题"
        || year && String(year.textContent || "").trim() !== current.year) return;
      var text = current.year + "年第" + current.number + "题";
      if (String(title.textContent || "").trim() !== text) title.textContent = text;
      var left = document.querySelector(".exercise-header .header-left");
      // 桌面入口沿用网站位置；窄屏入口沿用网站设置菜单中的显示模式区域。
      if (window.innerWidth >= 640) addModes(left, title, false);
      else if (left) {
        var desktop = left.querySelector("[" + marker + "]");
        if (desktop) desktop.remove();
      }
      addModes(document.querySelector(".settings-menu"), title, true);
    }
    state.observer = new MutationObserver(schedule);
    state.observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    window.addEventListener("popstate", schedule);
    window.addEventListener("resize", schedule);
    sync();
    return "direct:" + initial.year + ":" + initial.id;
  }

  // 知识点保持分类顺序；整卷入口仅用于旧链接和用户主动切换到列表模式。
  function exerciseQuestionPageScript() {
    var query = new URLSearchParams(window.location.search || "");
    var knowledgeId = query.get("knowledgeId"), questionId = query.get("daguanyuanQuestionId") || query.get("questionId");
    var yearId = query.get("year");
    var byKnowledge = /^[1-9]\d*$/.test(knowledgeId || "");
    var byYear = !knowledgeId && /^\d{4}$/.test(yearId || "") && Number(yearId) >= 2009 && Number(yearId) <= 2100
      && !!query.get("daguanyuanQuestionId") && !query.get("mode") && !query.get("collectionId");
    if (window.location.hostname !== "www.408os.cn" || !/^\/exercise\/?$/.test(window.location.pathname)
      || !(byKnowledge || byYear) || !/^[1-9]\d*$/.test(questionId || "")) return false;
    if (byYear) {
      var navigation = window.__DAGUANYUAN_408_YEAR_NAVIGATION__;
      if (!navigation || navigation.year !== yearId) {
        if (navigation) document.removeEventListener("click", navigation.click, true);
        navigation = { year: yearId, busy: false, click: null };
        navigation.click = function (event) {
          var current = new URLSearchParams(window.location.search || "");
          if (!/^\/exercise\/?$/.test(window.location.pathname) || current.get("year") !== yearId
            || current.get("knowledgeId") || current.get("mode") || current.get("collectionId")
            || current.get("questionId") || !current.get("daguanyuanQuestionId")) return;
          var button = event.target && typeof event.target.closest === "function" && event.target.closest(
            ".nav-btn.nav-prev, .nav-btn.nav-next, .mobile-nav-btn.prev, .mobile-nav-btn.next"
          );
          if (!button || button.disabled || !active(mode("单题"))) return;
          if (navigation.busy) { event.preventDefault(); event.stopImmediatePropagation(); return; }
          var card = document.querySelector(".single-question-wrapper .question-card");
          var year = card && card.querySelector(".year-tag"), number = card && card.querySelector(".index-tag");
          var match = number && String(number.textContent || "").trim().match(/^第\s*(\d+)\s*题$/);
          // 网站手机布局可能隐藏年份标签，此时仍按当前年份入口和可见题号切题。
          if (!match || year && String(year.textContent || "").trim() !== yearId) return;
          var next = Number(match[1]) + (button.classList.contains("nav-next") || button.classList.contains("next") ? 1 : -1);
          if (next < 1 || next > 47) return;
          // 从整卷切到单题后，下一次切题进入直接按 ID 加载的路径，不再重走整卷滚动。
          event.preventDefault(); event.stopImmediatePropagation(); navigation.busy = true;
          window.location.assign("/exercise?year=" + yearId + "&questionId=" + (47 * (Number(yearId) - 2009) + next));
        };
        window.__DAGUANYUAN_408_YEAR_NAVIGATION__ = navigation;
        document.addEventListener("click", navigation.click, true);
      }
    }
    var key = (byKnowledge ? knowledgeId : "year:" + yearId) + ":" + questionId;
    var previous = window.__DAGUANYUAN_408_QUESTION_LOCATOR__;
    if (previous && previous.key === key) return key;
    if (previous) previous.finish("cancelled");
    var marker = "data-daguanyuan-408-question-locator";
    var state = { key: key, pending: true, timer: null, finish: null };
    window.__DAGUANYUAN_408_QUESTION_LOCATOR__ = state;
    var deadline = Date.now() + 90000;
    var lastLoad = "", lastScroll = "", lastJump = "", phase = "find", expectedYear = "", expectedNumber = "";
    var wanted = 0;
    document.documentElement.setAttribute(marker, "pending:" + key);
    state.finish = function (status) {
      if (!state.pending) return;
      state.pending = false;
      window.clearTimeout(state.timer);
      document.documentElement.setAttribute(marker, status + ":" + key);
      ["touchstart", "wheel", "keydown"].forEach(function (name) { document.removeEventListener(name, cancel, true); });
    };
    function cancel(event) { if (event.isTrusted) state.finish("cancelled"); }
    ["touchstart", "wheel", "keydown"].forEach(function (name) { document.addEventListener(name, cancel, true); });
    function mode(label) {
      var buttons = document.querySelectorAll(".mode-switch .mode-btn, .mode-btn-mobile");
      for (var index = 0; index < buttons.length; index++) {
        if (String(buttons[index].textContent || "").trim().indexOf(label) === 0) return buttons[index];
      }
      return null;
    }
    function active(element) { return element && element.classList.contains("active"); }
    function tick() {
      state.timer = null;
      if (!state.pending) return;
      var current = new URLSearchParams(window.location.search || "");
      if (current.get("knowledgeId") !== knowledgeId || (current.get("daguanyuanQuestionId") || current.get("questionId")) !== questionId
        || byYear && (current.get("year") !== yearId || current.get("mode") || current.get("collectionId"))
        || !/^\/exercise\/?$/.test(window.location.pathname)) return state.finish("cancelled");
      if (Date.now() >= deadline) return state.finish("failed");
      try {
        if (document.querySelector(".progress-restore-overlay")) return;
        var single = mode("单题"), list = mode("列表");
        if (phase === "verify") {
          var card = document.querySelector(".single-question-wrapper .question-card");
          var year = card && card.querySelector(".year-tag"), number = card && card.querySelector(".index-tag");
          if (active(single) && year && number) {
            return state.finish(String(year.textContent || "").trim() === expectedYear
              && String(number.textContent || "").trim() === expectedNumber ? "success" : "failed");
          }
          return;
        }
        if (active(single)) { if (list) list.click(); return; }
        if (!active(list)) return;
        var rows = document.querySelectorAll(".question-wrapper[data-question-id]");
        var target = null;
        for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
          if (rows[rowIndex].getAttribute("data-question-id") === questionId) {
            target = rows[rowIndex]; wanted = rowIndex + 1;
            // 年份大纲使用原题号；知识点大纲使用分类内顺序，过滤题型后两者可能不同。
            if (byYear) {
              var indexTag = target.querySelector(".index-tag");
              var indexMatch = indexTag && String(indexTag.textContent || "").trim().match(/^第\s*(\d+)\s*题$/);
              if (!indexMatch) return state.finish("failed");
              wanted = Number(indexMatch[1]);
            }
            break;
          }
        }
        if (target) {
          var items = document.querySelectorAll(".exercise-outline .num-item");
          var candidate = null;
          for (var itemIndex = 0; itemIndex < items.length; itemIndex++) {
            var value = Number(String(items[itemIndex].textContent || "").trim());
            if (items[itemIndex].classList.contains("unloaded")) continue;
            if (value === wanted && active(items[itemIndex])) { phase = "selected"; break; }
            if (value === wanted) { candidate = items[itemIndex]; break; }
            if (!candidate || Math.abs(value - wanted) < Math.abs(Number(candidate.textContent.trim()) - wanted)) candidate = items[itemIndex];
          }
          if (phase === "selected" || !items.length && lastScroll === "target:" + questionId) {
            if (byYear && query.get("daguanyuanView") === "list") return state.finish("success");
            var yearTag = target.querySelector(".year-tag"), numberTag = target.querySelector(".index-tag");
            if (!yearTag || !numberTag || !single) return state.finish("failed");
            expectedYear = String(yearTag.textContent || "").trim(); expectedNumber = String(numberTag.textContent || "").trim();
            phase = "verify"; single.click(); return;
          }
          if (candidate) {
            var jump = String(candidate.textContent || "").trim();
            if (jump !== lastJump) { lastJump = jump; candidate.click(); }
          } else {
            lastScroll = "target:" + questionId;
            target.scrollIntoView({ behavior: "auto", block: "center" });
            var scroller = document.querySelector(".content-area");
            if (scroller) scroller.dispatchEvent(new Event("scroll"));
          }
          return;
        }
        // 先让网站渲染已加载的后续题卡；仍找不到时才请求下一页。
        var signature = Array.prototype.map.call(rows, function (row) { return row.getAttribute("data-question-id"); }).join(",");
        if (rows.length && lastScroll !== signature) {
          lastScroll = signature;
          rows[rows.length - 1].scrollIntoView({ behavior: "auto", block: "center" });
          return;
        }
        var more = document.querySelector(".load-more-btn");
        var load = signature + ":" + String(more && more.textContent || "");
        if (more && !more.disabled && lastLoad !== load) { lastLoad = load; more.click(); }
      } catch (error) { state.finish("failed"); }
      finally { if (state.pending) state.timer = window.setTimeout(tick, 150); }
    }
    tick();
    return key;
  }

  function exerciseQuestionScript() {
    return "(function(){var direct=(" + directYearQuestionPageScript.toString() + ")();return direct||(" + exerciseQuestionPageScript.toString() + ")();})();";
  }

  return { practiceScript, bindCategoryScript, singleImportScript, importContextScript, exerciseQuestionScript, questionDOMScript };
})();
