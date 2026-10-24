var __DAGUANYUAN_AI_GLOBAL__ = (function () {
  // 此函数仅在网站页面执行，点击网站自己的 AI 按钮，不创建对话或发送问题。
  function pageProbe(url, questionId, clicked) {
    if (window.location.href.split('#')[0] !== url.split('#')[0]) return 'away';
    var query = new URLSearchParams(window.location.search);
    if (Number(query.get('questionId')) !== questionId) return 'left';
    // 年份入口等待已有定位器核对真实年份与原卷题号，防止首屏暂存卡片误触。
    if (query.get('year')) {
      var marker = document.documentElement.getAttribute('data-daguanyuan-408-question-locator') || '';
      var key = 'year:' + query.get('year') + ':' + questionId;
      if (marker === 'failed:' + key || marker === 'cancelled:' + key) return 'failed';
      if (marker !== 'success:' + key) return 'loading';
    }
    var cards = document.querySelectorAll('.question-card');
    if (cards.length !== 1) return 'loading';
    var workspace = document.querySelector('.ai-workspace');
    if (workspace && workspace.getClientRects().length && workspace.querySelector('.question-ai-tutor')) return 'opened';
    if (cards[0].querySelector('.inline-ai-tutor .question-ai-tutor')) return 'opened';
    if (clicked) return 'waiting';
    var buttons = cards[0].querySelectorAll('button.action-btn-ai');
    var visible = Array.prototype.filter.call(buttons, function (button) { return button.getClientRects().length && !button.disabled; });
    if (visible.length !== 1) return 'waiting';
    visible[0].click();
    return 'clicked';
  }

  function cancel(controller) {
    const request = controller && controller.askAiRequest;
    if (!request) return;
    controller.askAiRequest = null;
    if (request.timer && typeof request.timer.invalidate === 'function') request.timer.invalidate();
  }

  function open408(controller, url, questionId) {
    cancel(controller);
    const request = { deadline: Date.now() + 25000, clicked: false, seen: false, busy: false, timer: null };
    controller.askAiRequest = request;
    function current() { return controller.askAiRequest === request && controller.panelVisible === true && controller.currentContentPage === '408'
      && (!controller.activePage || controller.activePage === '408'); }
    function message(text) { Application.sharedInstance().showHUD(text, controller.addonWindow, 3); }
    function tick() {
      if (!current()) { if (controller.askAiRequest === request) cancel(controller); return; }
      if (Date.now() >= request.deadline) {
        cancel(controller); message('未能打开本题 AI，请检查网站登录、AI 权限及题目是否加载完成'); return;
      }
      if (!request.busy && !controller.webView.loading) {
        request.busy = true;
        try {
          controller.webView.evaluateJavaScript('(' + pageProbe.toString() + ')(' + JSON.stringify(url) + ',' + questionId + ',' + request.clicked + ')', function (result, error) {
            request.busy = false;
            if (!current()) return;
            if (error) { cancel(controller); message('本题 AI 入口读取失败，请刷新题库后重试'); return; }
            const status = String(result || '');
            if (status === 'away') { if (request.seen) cancel(controller); return; }
            request.seen = true;
            if (status === 'clicked') request.clicked = true;
            if (status === 'failed') { cancel(controller); message('本题未完成定位，请重新打开后再问 AI'); return; }
            if (status === 'opened' || status === 'left') cancel(controller);
          });
        } catch (error) { cancel(controller); message('本题 AI 入口读取失败，请刷新题库后重试'); return; }
      }
      if (current()) request.timer = NSTimer.scheduledTimerWithTimeInterval(0.25, false, tick);
    }
    request.timer = NSTimer.scheduledTimerWithTimeInterval(0.25, false, tick);
  }

  return { open408, cancel, pageProbe };
})();
