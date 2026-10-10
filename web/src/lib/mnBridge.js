const MNBridge = (function () {
  const pending = {};
  window.__DAGUANYUAN_MN_BRIDGE_RECEIVE__ = function (message) {
    const item = pending[message.requestId];
    if (!item) return;
    delete pending[message.requestId]; clearTimeout(item.timer);
    if (message.error) item.reject(new Error(message.error));
    else item.resolve(message.payload);
  };
  function send(command, payload) {
    const requestId = Date.now().toString(36) + Math.random().toString(36).slice(2);
    return new Promise(function (resolve, reject) {
      const timer = setTimeout(function () { delete pending[requestId]; reject(new Error('插件响应超时，请重新打开导入')); }, 30000);
      pending[requestId] = { resolve, reject, timer };
      const frame = document.createElement('iframe'); frame.hidden = true;
      frame.src = 'daguanyuanbridge://ui?payload=' + encodeURIComponent(JSON.stringify({ command, requestId, payload }));
      document.body.appendChild(frame);
      setTimeout(function () { frame.remove(); }, 600);
    });
  }
  return { send };
})();
export default MNBridge;
