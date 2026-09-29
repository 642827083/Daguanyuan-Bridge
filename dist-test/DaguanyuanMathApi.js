var __DAGUANYUAN_MATH_API_GLOBAL__ = (function () {
  const API_ROOT = "https://www.cxyonly.fans/api/questions";
  const PAGE_SIZE = 20;

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

  function isNil(value) {
    return value === null || typeof value === "undefined" || (typeof NSNull !== "undefined" && value instanceof NSNull);
  }

  function nativeValue(object, key) {
    const value = object && object[key];
    return typeof value === "function" ? value.call(object) : value;
  }

  function requestJSON(url) {
    if (!/^https:\/\/www\.cxyonly\.fans\/api\/questions(?:\/\d+|\?[\w=&%]+)$/.test(url)) {
      return Promise.reject(new Error("题目接口地址无效"));
    }
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
            if (status < 200 || status >= 300) throw new Error(`题目接口请求失败：${status}`);
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

  function questionPage(categoryId, page, rawScope) {
    const category = positiveInteger(categoryId, "分类 ID");
    const number = positiveInteger(page, "页码");
    const scope = questionScope(rawScope);
    if (number > 1000) return Promise.reject(new Error("页码超出范围"));
    const url = `${API_ROOT}?category_id=${category}&include_children=false&page=${number}&per_page=${PAGE_SIZE}&scope=${scope}`;
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

  function questionDetail(questionId) {
    const id = positiveInteger(questionId, "题目 ID");
    return requestJSON(`${API_ROOT}/${id}`).then(function (item) {
      if (!item || Number(item.id) !== id) throw new Error("题目详情格式无效");
      const result = summary(item);
      if (!result.categoryId) throw new Error("题目缺少分类信息");
      return resolveImages(result);
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

  function resolveImages(question) {
    const contents = [question.stem].concat(question.options);
    const refs = [];
    contents.forEach(function (content) {
      const found = String(content || "").match(/asset:\/\/sha256\/[0-9a-f]{64}/g) || [];
      found.forEach(function (reference) { if (refs.indexOf(reference) < 0) refs.push(reference); });
    });
    if (!refs.length) return Promise.resolve(question);
    return Promise.all(refs.map(imageData)).then(function (images) {
      let stem = question.stem;
      let options = question.options.slice();
      refs.forEach(function (reference, index) {
        stem = stem.split(reference).join(images[index]);
        options = options.map(function (option) { return option.split(reference).join(images[index]); });
      });
      return Object.assign({}, question, { stem, options, hasBase64Image: true });
    });
  }

  return { questionPage, questionDetail, positiveInteger, questionScope, summary };
})();
