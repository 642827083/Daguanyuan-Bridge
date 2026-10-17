var __DAGUANYUAN_MATH_API_GLOBAL__ = (function () {
  const API_ROOT = "https://www.cxyonly.fans/api/questions";
  const PAGE_SIZE = 20;
  let nextRequestAt = 0;

  function delay(milliseconds, check) {
    return new Promise(function (resolve, reject) {
      function tick(remaining) {
        try {
          if (check) check();
          if (remaining <= 0) { resolve(); return; }
          // 短间隔检查取消状态，避免限流等待时停止按钮失效。
          const step = Math.min(200, remaining);
          NSTimer.scheduledTimerWithTimeInterval(step / 1000, false, function () { tick(remaining - step); });
        } catch (error) { reject(error); }
      }
      tick(milliseconds);
    });
  }

  function limitedError(milliseconds) {
    const error = new Error(milliseconds > 60000 ? '网站限流，请等待 ' + Math.ceil(milliseconds / 1000) + ' 秒后重试'
      : '网站访问过于频繁，自动重试后仍被限流，请稍后重新导入；已完成题卡保留');
    error.rateLimited = true; error.stopImport = true;
    return error;
  }

  function retryAfter(response, attempt) {
    const headers = nativeValue(response, 'allHeaderFields') || {};
    const key = Object.keys(headers).find(function (name) { return name.toLowerCase() === 'retry-after'; });
    const value = key ? text(headers[key]).trim() : '';
    const duration = /^\d+(?:\.\d+)?$/.test(value) ? Number(value) * 1000 : value ? Date.parse(value) - Date.now() : NaN;
    return Math.max(0, Number.isFinite(duration) ? duration : 5000 * Math.pow(2, attempt));
  }

  function positiveInteger(value, label) {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 1) throw new Error(`${label}无效`);
    return number;
  }

  function questionScope(value) {
    const scope = String(value || "");
    if (scope !== "complete" && scope !== "core" && scope !== "exam") {
      throw new Error("题库范围无效，请刷新数学页面后重试");
    }
    return scope;
  }

  function examSubject(value) {
    const subject = String(value || 'all');
    if (['all', 'math_1', 'math_2', 'math_3'].indexOf(subject) < 0) throw new Error('备考科目无效');
    return subject;
  }

  function isNil(value) {
    return value === null || typeof value === "undefined" || (typeof NSNull !== "undefined" && value instanceof NSNull);
  }

  function nativeValue(object, key) {
    const value = object && object[key];
    return typeof value === "function" ? value.call(object) : value;
  }

  function requestJSON(url, check) {
    if (!/^https:\/\/www\.cxyonly\.fans\/api\/(?:questions(?:\/\d+|\?[\w.~=&%+-]+)|categories\?[\w=&%]+)$/.test(url)) {
      return Promise.reject(new Error("题目接口地址无效"));
    }
    function attempt(number) {
      if (check) check();
      const waiting = nextRequestAt - Date.now();
      if (waiting > 60000) return Promise.reject(limitedError(waiting));
      return delay(Math.max(0, waiting), check).then(function () {
        // 仅在网站返回 429 后等待；其他请求保持原有并发速度。
        if (nextRequestAt > Date.now()) return attempt(number);
        return requestOnce(url);
      }).catch(function (error) {
        if (typeof __DAGUANYUAN_DIAGNOSTICS_GLOBAL__ !== 'undefined') __DAGUANYUAN_DIAGNOSTICS_GLOBAL__.error('math.request', error, { httpStatus: error.httpStatus, stage: url.indexOf('/api/categories') >= 0 ? '读取分类目录' : '读取题目' });
        if (error.httpStatus !== 429) throw error;
        const waiting = retryAfter(error.response, number);
        nextRequestAt = Math.max(nextRequestAt, Date.now() + waiting);
        if (number >= 3 || waiting > 60000) throw limitedError(waiting);
        return attempt(number + 1);
      });
    }
    return Promise.resolve().then(function () { return attempt(0); });
  }

  function requestOnce(url) {
    return new Promise(function (resolve, reject) {
      try {
        const request = NSMutableURLRequest.requestWithURL(NSURL.URLWithString(url));
        request.setHTTPMethod("GET");
        request.setTimeoutInterval(20);
        request.setAllHTTPHeaderFields({ Accept: "application/json" });
        NSURLConnection.sendAsynchronousRequestQueueCompletionHandler(request, NSOperationQueue.mainQueue(), function (response, data, error) {
          try {
            if (!isNil(error)) throw new Error(String(nativeValue(error, "localizedDescription") || error));
            const status = Number(nativeValue(response, "statusCode")) || 0;
            if (status < 200 || status >= 300) {
              const error = new Error(`题目接口请求失败：${status}`);
              error.httpStatus = status; error.response = response; throw error;
            }
            if (isNil(data) || Number(nativeValue(data, "length")) < 1) throw new Error("题目接口没有返回数据");
            resolve(NSJSONSerialization.JSONObjectWithDataOptions(data, 1));
          } catch (requestError) { reject(requestError); }
        });
      } catch (requestError) { reject(requestError); }
    });
  }

  function text(value) {
    return isNil(value) ? "" : String(value);
  }

  function summary(item) {
    const id = positiveInteger(item && item.id, "题目 ID");
    const categoryId = Number(item.category_id) || Number((item.category_ids || [])[0]) || 0;
    const categoryIds = [categoryId].concat(item.category_ids || []).map(Number).filter(function (value) {
      return Number.isSafeInteger(value) && value > 0;
    });
    return {
      id,
      categoryId,
      categoryIds: categoryIds.filter(function (value, index) { return categoryIds.indexOf(value) === index; }),
      source: text(item.source),
      stem: text(item.stem),
      options: ["option_a", "option_b", "option_c", "option_d"].map(function (key) { return text(item[key]); }),
      questionType: text(item.question_type),
      serialNumber: Number(item.serial_number) || 0,
      categoryPath: text(item.category_full_path || item.category_name),
    };
  }

  function categoryRecords(rawScope, rawSubject) {
    const scope = questionScope(rawScope), subject = examSubject(rawSubject);
    return requestJSON('https://www.cxyonly.fans/api/categories?scope=' + scope
      + '&exam_subject=' + subject).then(function (tree) {
      const records = [], seen = new Set();
      function visit(nodes, parent, depth) {
        if (!Array.isArray(nodes) || depth > 30) throw new Error('分类目录格式无效，请重试');
        nodes.forEach(function (node) {
          const id = positiveInteger(node && node.id, '分类 ID');
          const name = text(node.name).trim();
          // 原生 JSON 会用 NSNull 表示根分类的空父节点，需要先识别再转换。
          const parentId = isNil(node.parent_id) ? 0 : Number(node.parent_id);
          if (!name || seen.has(id) || parentId !== parent) throw new Error('分类目录格式无效，请重试');
          seen.add(id); records.push([id, parent, name]);
          visit(isNil(node.children) ? [] : node.children, id, depth + 1);
        });
      }
      visit(tree, 0, 0);
      return records;
    });
  }

  function questionPage(categoryId, page, rawScope, rawSubject) {
    const category = positiveInteger(categoryId, "分类 ID");
    const number = positiveInteger(page, "页码");
    const scope = questionScope(rawScope);
    const subject = examSubject(rawSubject);
    if (number > 1000) return Promise.reject(new Error("页码超出范围"));
    const url = `${API_ROOT}?category_id=${category}&include_children=false&page=${number}&per_page=${PAGE_SIZE}&scope=${scope}`
      + (typeof rawSubject === 'undefined' ? '' : '&exam_subject=' + subject);
    return requestJSON(url).then(function (payload) {
      const data = payload && payload.data;
      if (!data || !Array.isArray(data.items)) throw new Error("题目列表格式无效");
      return {
        categoryId: category,
        page: number,
        pageSize: PAGE_SIZE,
        total: Math.max(0, Number(data.total) || 0),
        questions: data.items.map(function (item) {
          return Object.assign(summary(item), { importCategoryId: category });
        }),
      };
    });
  }

  function questionDetail(questionId, content, readImage, check) {
    const id = positiveInteger(questionId, "题目 ID");
    return requestJSON(`${API_ROOT}/${id}`, check).then(function (item) {
      if (check) check();
      if (!item || Number(item.id) !== id) throw new Error("题目详情格式无效");
      const result = summary(item);
      if (!result.categoryId) throw new Error("题目缺少分类信息");
      if (content === 'questionAnswer') {
        result.answer = text(item.correct_answer);
        result.explanation = text(item.answer_explanation);
      }
      return resolveImages(result, readImage);
    });
  }

  function imageData(reference) {
    const match = /^asset:\/\/sha256\/([0-9a-f]{64})$/.exec(reference);
    if (!match) return Promise.reject(new Error("题目图片引用无效"));
    return new Promise(function (resolve, reject) {
      try {
        const request = NSMutableURLRequest.requestWithURL(NSURL.URLWithString(`https://www.cxyonly.fans/api/v1/question-assets/${match[1]}`));
        request.setHTTPMethod("GET");
        request.setTimeoutInterval(20);
        NSURLConnection.sendAsynchronousRequestQueueCompletionHandler(request, NSOperationQueue.mainQueue(), function (response, data, error) {
          try {
            if (!isNil(error)) throw new Error(String(nativeValue(error, "localizedDescription") || error));
            const status = Number(nativeValue(response, "statusCode")) || 0;
            if (status < 200 || status >= 300) throw new Error(`图片接口请求失败：${status}`);
            const length = Number(nativeValue(data, "length")) || 0;
            if (length < 8 || length > 4194304) throw new Error("题目图片大小无效");
            const headers = nativeValue(response, "allHeaderFields") || {};
            const type = String(headers["Content-Type"] || headers["content-type"] || "").split(";")[0].trim().toLowerCase();
            if (type !== "image/png") throw new Error("题目图片格式无效");
            const base64 = nativeValue(data, "base64Encoding");
            if (!base64) throw new Error("题目图片转换失败");
            resolve(`data:image/png;base64,${base64}`);
          } catch (requestError) { reject(requestError); }
        });
      } catch (requestError) { reject(requestError); }
    });
  }

  function resolveImages(question, readImage) {
    const contents = [question.stem].concat(question.options, [question.answer || '', question.explanation || '']);
    const refs = [];
    contents.forEach(function (content) {
      const found = String(content || "").match(/asset:\/\/sha256\/[0-9a-f]{64}/g) || [];
      found.forEach(function (reference) { if (refs.indexOf(reference) < 0) refs.push(reference); });
    });
    if (!refs.length) return Promise.resolve(question);
    if (refs.length > 32) return Promise.reject(new Error('本题图片超过 32 张，请分开导入'));
    return Promise.all(refs.map(readImage || imageData)).then(function (images) {
      if (images.reduce(function (count, data) { return count + String(data).length; }, 0) > 24 * 1024 * 1024) throw new Error('本题图片总量超过传输上限');
      let stem = question.stem;
      let options = question.options.slice();
      let answer = question.answer;
      let explanation = question.explanation;
      refs.forEach(function (reference, index) {
        stem = stem.split(reference).join(images[index]);
        options = options.map(function (option) { return option.split(reference).join(images[index]); });
        if (typeof answer === 'string') answer = answer.split(reference).join(images[index]);
        if (typeof explanation === 'string') explanation = explanation.split(reference).join(images[index]);
      });
      const resolved = Object.assign({}, question, { stem, options, hasBase64Image: true });
      if (typeof answer === 'string') resolved.answer = answer;
      if (typeof explanation === 'string') resolved.explanation = explanation;
      return resolved;
    });
  }

  return { questionPage, questionDetail, positiveInteger, questionScope, examSubject, categoryRecords, summary };
})();
