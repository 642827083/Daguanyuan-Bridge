var __DAGUANYUAN_408_WORKSPACE_GLOBAL__ = (function () {
  function release(controller) {
    const state = controller.import408WorkerState;
    controller.import408WorkerState = null;
    if (state && state.finish) {
      const error = new Error('408 读取已停止'); error.stopImport = true; state.finish(error);
    }
    const view = controller.import408Worker;
    controller.import408Worker = null;
    if (view) {
      if (typeof view.stopLoading === 'function') view.stopLoading();
      view.delegate = null;
      view.removeFromSuperview();
    }
  }
  function load(controller, url) {
    if (!/^https:\/\/www\.408os\.cn\/exercise\?/.test(url)) throw new Error('408 来源地址无效');
    if (!controller.import408Worker) {
      const view = new UIWebView(controller.importWebView.frame);
      view.hidden = true; view.scalesPageToFit = false; view.delegate = controller;
      controller.containerView.addSubview(view);
      controller.import408Worker = view;
    }
    const webView = controller.import408Worker;
    return new Promise(function (resolve, reject) {
      let settled = false;
      const timer = NSTimer.scheduledTimerWithTimeInterval(30, false, function () { finish(new Error('408 网站加载超时，请稍后重试')); });
      function finish(error) {
        if (settled) return;
        settled = true; timer.invalidate();
        if (controller.import408WorkerState === state) controller.import408WorkerState = null;
        if (error) reject(error); else resolve({ webView });
      }
      const state = { webView, finish };
      controller.import408WorkerState = state;
      try {
        if (typeof MNUtil !== 'undefined' && typeof MNUtil.loadRequest === 'function') MNUtil.loadRequest(webView, url);
        else webView.loadRequest(NSURLRequest.requestWithURL(NSURL.URLWithString(url)));
      } catch (error) { finish(error); }
    });
  }
  function loaded(controller, webView) {
    const state = controller.import408WorkerState;
    if (state && state.webView === webView) state.finish();
  }
  function failed(controller, webView, error) {
    const state = controller.import408WorkerState;
    if (state && state.webView === webView) state.finish(new Error('408 网站加载失败：' + String(error && error.localizedDescription || error)));
  }
  return { load, release, loaded, failed };
})();
