(function () {
  if (window.__DAGUANYUAN_MATH_IMAGE_PAGE__ && window.__DAGUANYUAN_MATH_IMAGE_PAGE__.version === 1) return;
  const entries = new Map();
  function origin() {
    if (!__DAGUANYUAN_MATH_SITE_GLOBAL__.page(window.location.origin)) throw new Error('请先在数学题库网页打开并登录大观园');
  }
  function authToken() {
    // 只沿用大观园网站已有的登录信息，不传入原生侧，也不另行保存。
    try { return String(window.localStorage.getItem('daguan_token') || window.localStorage.getItem('token') || '').trim(); }
    catch (ignored) { return ''; }
  }
  function release(token) {
    const item = entries.get(token);
    if (item) { item.abort.abort(); window.clearTimeout(item.timer); entries.delete(token); }
    return true;
  }
  function begin(token, hash) {
    origin();
    if (!/^[a-zA-Z0-9-]{1,100}$/.test(token) || !/^[a-f0-9]{64}$/.test(hash)) throw new Error('图片读取参数无效');
    release(token);
    const item = { status: 'loading', data: '', abort: new AbortController() };
    entries.set(token, item);
    item.timer = window.setTimeout(function () { item.abort.abort(); }, 25000);
    (async function () {
      try {
        const capturedToken = authToken(), headers = { Accept: 'image/*' };
        if (capturedToken) headers.Authorization = 'Bearer ' + capturedToken;
        const response = await window.fetch('/api/v1/question-assets/' + hash, { credentials: 'include', redirect: 'error', signal: item.abort.signal, headers });
        if (response.status === 401) throw new Error('图片需要登录，请在数学题库网页登录大观园后重试');
        if (response.status === 403) throw new Error('当前大观园账号没有读取题目图片的权限');
        if (response.status === 428) throw new Error('请在数学题库网页完成访问验证后重试');
        if (!response.ok) throw new Error('题目图片读取失败（' + response.status + '）');
        const blob = await response.blob();
        if (!/^image\/(png|jpeg|gif|webp)$/.test(blob.type) || blob.size < 8 || blob.size > 4194304) throw new Error('题目图片格式不支持或大小超过 4 MiB');
        const data = await new Promise(function (resolve, reject) {
          const reader = new FileReader();
          reader.onload = function () { resolve(reader.result); };
          reader.onerror = function () { reject(new Error('题目图片转换失败')); };
          reader.readAsDataURL(blob);
        });
        origin();
        if (capturedToken !== authToken()) throw new Error('大观园登录状态已变化，请重新导入');
        if (entries.get(token) !== item) return;
        item.data = data; item.status = 'ready';
      } catch (error) {
        if (entries.get(token) !== item) return;
        item.error = error.name === 'AbortError' ? '题目图片读取超时，请重试' : String(error.message || error);
        item.status = 'error';
      } finally { window.clearTimeout(item.timer); }
    })();
    return 'accepted';
  }
  function read(token) {
    origin(); const item = entries.get(token);
    return JSON.stringify(item ? { status: item.status, length: item.data.length, error: item.error || '' } : { status: 'error', error: '图片读取已失效，请重试' });
  }
  function chunk(token, offset) {
    origin(); const item = entries.get(token);
    if (!item || item.status !== 'ready' || !Number.isSafeInteger(offset) || offset < 0) throw new Error('图片分块读取无效');
    return item.data.slice(offset, offset + 65536);
  }
  window.__DAGUANYUAN_MATH_IMAGE_PAGE__ = { version: 1, begin, read, chunk, release };
})();
