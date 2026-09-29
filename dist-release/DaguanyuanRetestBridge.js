var __DAGUANYUAN_RETEST_BRIDGE_GLOBAL__ = (function () {
  function script(enabled, noteEnabled) {
    return `(function () {
      var state = window.__DAGUANYUAN_RETEST_CARD_BUTTONS__;
      var visible = ${enabled === false ? "false" : "true"};
      var noteVisible = ${noteEnabled ? "true" : "false"};
      if (state && state.version === 3) { state.enabled = visible; state.noteEnabled = noteVisible; state.schedule(); return true; }
      var previous = state;
      if (previous) previous.timer = -1;
      state = { version: 3, enabled: visible, noteEnabled: noteVisible, timer: null, schedule: null };
      window.__DAGUANYUAN_RETEST_CARD_BUTTONS__ = state;
      function sync() {
        state.timer = null;
        if (previous) previous.timer = -1;
        var path = String(window.location.pathname || '');
        var active = path === '/math/retest' || path.indexOf('/math/retest/') === 0;
        var rows = document.querySelectorAll('[data-retest-question-id], [data-retest-schedule-question-id]');
        for (var index = 0; index < rows.length; index += 1) {
          var row = rows[index];
          var id = Number(row.getAttribute('data-retest-question-id') || row.getAttribute('data-retest-schedule-question-id'));
          var button = row.querySelector('[data-daguanyuan-locate-card]');
          var noteButton = row.querySelector('[data-daguanyuan-retest-add-note]');
          if (!active || !Number.isSafeInteger(id) || id < 1) {
            if (button && button.parentNode) button.parentNode.removeChild(button);
            if (noteButton && noteButton.parentNode) noteButton.parentNode.removeChild(noteButton);
            continue;
          }
          if (!state.enabled && button && button.parentNode) button.parentNode.removeChild(button);
          if (!state.noteEnabled && noteButton && noteButton.parentNode) noteButton.parentNode.removeChild(noteButton);
          function connect(created, command, attribute) {
            created.addEventListener('click', function (event) {
              event.preventDefault(); event.stopPropagation();
              var questionId = this.getAttribute(attribute);
              var frame = document.createElement('iframe');
              frame.style.display = 'none';
              frame.src = 'daguanyuanbridge://' + command + '?id=' + encodeURIComponent(questionId);
              document.body.appendChild(frame);
              window.setTimeout(function () { if (frame.parentNode) frame.parentNode.removeChild(frame); }, 600);
            }, true);
          }
          if (state.enabled && !button) {
            button = document.createElement('button');
            button.type = 'button';
            button.textContent = '定位卡片';
            connect(button, 'locate-card', 'data-daguanyuan-locate-card');
          }
          if (state.noteEnabled && !noteButton) {
            noteButton = document.createElement('button');
            noteButton.type = 'button';
            noteButton.textContent = '添加笔记';
            connect(noteButton, 'add-note', 'data-daguanyuan-retest-add-note');
          }
          var style = 'margin:8px 4px;padding:5px 10px;border:1px solid #7692bc;border-radius:7px;background:#fff;color:#23528f;font-size:12px;cursor:pointer';
          var anchor = row.querySelector('button[aria-expanded], button[aria-label^="将第 "]');
          var parent = anchor && anchor.parentNode && anchor.parentNode.insertBefore ? anchor.parentNode : row;
          var position = anchor && anchor.parentNode === parent ? anchor : null;
          if (state.noteEnabled) {
            noteButton.setAttribute('data-daguanyuan-retest-add-note', String(id));
            noteButton.style.cssText = style;
            if (noteButton.parentNode !== parent || noteButton.nextSibling !== position) parent.insertBefore(noteButton, position);
            position = noteButton;
          }
          if (state.enabled) {
            button.setAttribute('data-daguanyuan-locate-card', String(id));
            button.style.cssText = style;
            if (button.parentNode !== parent || button.nextSibling !== position) parent.insertBefore(button, position);
          }
        }
      }
      state.schedule = function () {
        if (state.timer !== null) return;
        state.timer = window.setTimeout(sync, 80);
      };
      new MutationObserver(state.schedule).observe(document.documentElement, { childList: true, subtree: true });
      state.schedule();
      return true;
    })();`;
  }

  return { script };
})();
