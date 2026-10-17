var __DAGUANYUAN_MATH_IMAGES_GLOBAL__ = (function () {
  let sequence = 0;
  function reader(controller, check) {
    const webView = controller && controller.webView;
    return function (reference) {
      const hash = /^asset:\/\/sha256\/([a-f0-9]{64})$/.exec(String(reference));
      if (!hash) return Promise.reject(new Error('题目图片引用无效'));
      if (!webView) return Promise.reject(new Error('请先打开数学题库网页并登录大观园，再导入带图片的题目'));
      const token = 'dgy-img-' + Date.now().toString(36) + '-' + (++sequence);
      const prefix = 'window.__DAGUANYUAN_MATH_IMAGE_PAGE__';
      function evaluate(script) {
        if (check) check();
        return __DAGUANYUAN_IMPORT_SELECTION_GLOBAL__.evaluate({ webView }, script);
      }
      function delay() { return new Promise(function (resolve) { NSTimer.scheduledTimerWithTimeInterval(0.15, false, resolve); }); }
      const deadline = Date.now() + 35000;
      function poll() {
        if (Date.now() > deadline) throw new Error('题目图片读取超时，请重试');
        return evaluate(prefix + '.read(' + JSON.stringify(token) + ')').then(function (raw) {
          const state = JSON.parse(String(raw));
          if (state.status === 'error') throw new Error(state.error || '题目图片读取失败');
          if (state.status !== 'ready') return delay().then(poll);
          if (!Number.isSafeInteger(state.length) || state.length < 1 || state.length > 5600000) throw new Error('题目图片传输大小无效');
          const parts = [];
          let offset = 0;
          function take() {
            if (offset === state.length) {
              const data = parts.join('');
              if (!/^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(data)) throw new Error('题目图片数据无效');
              return data;
            }
            return evaluate(prefix + '.chunk(' + JSON.stringify(token) + ',' + offset + ')').then(function (raw) {
              const chunk = String(raw || '');
              if (!chunk.length || chunk.length > 65536 || offset + chunk.length > state.length) throw new Error('题目图片分块不完整');
              parts.push(chunk); offset += chunk.length; return take();
            });
          }
          return take();
        });
      }
      function release() {
        return __DAGUANYUAN_IMPORT_SELECTION_GLOBAL__.evaluate({ webView }, prefix + '&&' + prefix + '.release(' + JSON.stringify(token) + ')').catch(function () {});
      }
      return evaluate(__DAGUANYUAN_MATH_IMAGE_PAGE_SCRIPT__ + ';"ok"').then(function () {
        return evaluate(prefix + '.begin(' + JSON.stringify(token) + ',' + JSON.stringify(hash[1]) + ')');
      }).then(function (accepted) {
        if (String(accepted) !== 'accepted') throw new Error('题目图片读取未启动');
        return poll();
      }).then(function (data) { return release().then(function () { return data; }); }, function (error) {
        return release().then(function () {
          error.stage = '读取题目图片';
          if (typeof __DAGUANYUAN_DIAGNOSTICS_GLOBAL__ !== 'undefined') __DAGUANYUAN_DIAGNOSTICS_GLOBAL__.error('image.read', error, { stage: error.stage });
          throw error;
        });
      });
    };
  }
  return { reader };
})();
