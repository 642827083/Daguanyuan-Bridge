var __DAGUANYUAN_QUESTION_RESOLVER_GLOBAL__ = (function () {
  const API_URL = "https://math.cxyonly.fans/api/questions";

  function isNil(value) {
    return value === null || typeof value === "undefined" || (typeof NSNull !== "undefined" && value instanceof NSNull);
  }

  function responseStatus(response) {
    if (isNil(response)) return 0;
    const value = response.statusCode;
    return Number(typeof value === "function" ? value.call(response) : value) || 0;
  }

  function dataLength(data) {
    if (isNil(data)) return 0;
    const value = data.length;
    return Number(typeof value === "function" ? value.call(data) : value) || 0;
  }

  function errorMessage(error) {
    if (isNil(error)) return "题目列表请求失败";
    const description = error.localizedDescription;
    return String(typeof description === "function" ? description.call(error) : description || error.message || error);
  }

  function responseData(payload) {
    let cursor = payload;
    for (let depth = 0; depth < 3 && cursor && typeof cursor === "object"; depth += 1) {
      if (Array.isArray(cursor.items)) return cursor;
      cursor = cursor.data;
    }
    return { items: [] };
  }

  function categoryURL(route) {
    const url = String(route && route.url || "");
    if (!url) return "";
    const hashParts = url.split("#");
    const address = hashParts.shift();
    const queryIndex = address.indexOf("?");
    if (queryIndex < 0) return url;
    const path = address.slice(0, queryIndex);
    const query = address.slice(queryIndex + 1).split("&").filter(function (part) {
      return part && !/^(page|questionId)=/i.test(part);
    });
    return `${path}${query.length ? `?${query.join("&")}` : ""}${hashParts.length ? `#${hashParts.join("#")}` : ""}`;
  }

  function resolve(route, completion) {
    const done = typeof completion === "function" ? completion : function () {};
    const categoryId = Number(route && route.categoryId);
    const page = Number(route && route.page);
    const indexOnPage = Number(route && route.indexOnPage);
    if (!Number.isSafeInteger(categoryId) || categoryId <= 0
      || !Number.isSafeInteger(page) || page <= 0
      || !Number.isSafeInteger(indexOnPage) || indexOnPage <= 0) {
      done(new Error("题目定位信息无效"));
      return;
    }
    const query = [
      `category_id=${encodeURIComponent(String(categoryId))}`,
      "include_children=true",
      `page=${encodeURIComponent(String(page))}`,
      "per_page=20",
      "scope=complete",
    ].join("&");
    try {
      const request = NSMutableURLRequest.requestWithURL(NSURL.URLWithString(`${API_URL}?${query}`));
      request.setHTTPMethod("GET");
      request.setTimeoutInterval(15);
      request.setAllHTTPHeaderFields({ Accept: "application/json" });
      NSURLConnection.sendAsynchronousRequestQueueCompletionHandler(
        request,
        NSOperationQueue.mainQueue(),
        function (response, data, error) {
          try {
            if (!isNil(error)) throw new Error(errorMessage(error));
            const status = responseStatus(response);
            if (status && (status < 200 || status >= 300)) throw new Error(`题目列表请求失败：${status}`);
            if (!dataLength(data)) throw new Error("题目列表没有返回数据");
            const payload = NSJSONSerialization.JSONObjectWithDataOptions(data, 1);
            const result = responseData(payload);
            const item = result.items[indexOnPage - 1];
            const questionId = Number(item && (item.id || item.question_id));
            if (!Number.isSafeInteger(questionId) || questionId <= 0) {
              const total = Number(result.total);
              throw new Error(Number.isSafeInteger(total) && total >= 0
                ? `大观园当前分类只有 ${total} 题，无法定位第 ${route.questionNumber} 题`
                : `大观园当前分类中没有第 ${route.questionNumber} 题`);
            }
            const url = categoryURL(route);
            if (!url) throw new Error("无法生成题目地址");
            done(null, {
              url,
              categoryId,
              page,
              indexOnPage,
              questionNumber: Number(route.questionNumber),
              questionId,
            });
          } catch (requestError) {
            done(requestError);
          }
        }
      );
    } catch (error) {
      done(error);
    }
  }

  return {
    resolve,
    categoryURL,
    responseData,
  };
})();
