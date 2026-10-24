var __DAGUANYUAN_408_IMPORT_GLOBAL__ = (function () {
  const PREFIX = "window.__DAGUANYUAN_408_IMPORT_PAGE__";
  const CHUNK_LENGTH = 65536;

  function pageScript(token, target, workspaceListing) {
    return __DAGUANYUAN_408_PAGE_GLOBAL__.pageScript(token, target, workspaceListing);
  }
  function boundedCallback(seconds, message, start, stopImport) {
    return new Promise(function (resolve, reject) {
      let settled = false;
      let timer;
      function finish(result, error) {
        if (settled) return;
        settled = true;
        try {
          if (timer && typeof timer.invalidate === "function") timer.invalidate();
        } catch (ignored) {
          // 定时器清理失败也不能阻止当前操作返回。
        }
        if (error) reject(error);
        else resolve(result);
      }
      try {
        timer = NSTimer.scheduledTimerWithTimeInterval(seconds, false, function () {
          const error = new Error(message);
          error.stopImport = Boolean(stopImport);
          finish(null, error);
        });
        start(finish);
      } catch (error) { finish(null, error); }
    });
  }
  function evaluate(controller, script) {
    return boundedCallback(15, "408 网页调用超时，请刷新后重试", function (finish) {
        controller.webView.evaluateJavaScript(script, function (result, error) {
          if (error && !(typeof NSNull !== 'undefined' && error instanceof NSNull)) finish(null, new Error(String(typeof error.localizedDescription === "function" ? error.localizedDescription() : error.localizedDescription || error)));
          else finish(result);
        });
    }, true);
  }
  function delay() {
    return new Promise(function (resolve) { NSTimer.scheduledTimerWithTimeInterval(0.2, false, resolve); });
  }
  function nativeValue(object, name) {
    const member = object && object[name];
    return typeof member === "function" ? member.call(object) : member;
  }
  function downloadImage(url) {
    if (!/^https:\/\/[^\s]+$/i.test(url)) return Promise.reject(new Error("跨域题图地址无效"));
    return boundedCallback(25, "跨域题图下载超时", function (finish) {
        const request = NSMutableURLRequest.requestWithURL(NSURL.URLWithString(url));
        request.setHTTPMethod("GET");
        request.setTimeoutInterval(20);
        NSURLConnection.sendAsynchronousRequestQueueCompletionHandler(request, NSOperationQueue.mainQueue(), function (response, data, error) {
          try {
            if (error && !(typeof NSNull !== "undefined" && error instanceof NSNull)) throw new Error(String(nativeValue(error, "localizedDescription") || error));
            const status = Number(nativeValue(response, "statusCode"));
            if (!Number.isFinite(status) || status < 200 || status >= 300) throw new Error(`跨域题图下载失败：${status}`);
            const length = Number(nativeValue(data, "length"));
            if (!Number.isFinite(length) || length < 1 || length > 20 * 1024 * 1024) throw new Error("跨域题图为空或超过 20 MB");
            const headers = nativeValue(response, "allHeaderFields") || {};
            const type = String(headers["Content-Type"] || headers["content-type"] || "").split(";")[0].trim().toLowerCase();
            if (!/^image\/(png|jpeg|gif|webp|svg\+xml)$/.test(type)) throw new Error(`跨域题图格式无法识别：${type || "未提供 Content-Type"}`);
            const base64 = String(nativeValue(data, "base64Encoding") || "");
            if (!base64) throw new Error("跨域题图转换失败");
            finish({ type, base64 });
          } catch (failure) { finish(null, failure); }
        });
    });
  }
  function provideResource(controller, token, url) {
    const key = JSON.stringify(token);
    function accepted(script) {
      return evaluate(controller, "String(" + script + ")").then(function (value) {
        if (String(value) !== "true") throw new Error("408 题图传输已中断");
      });
    }
    return downloadImage(url).then(function (image) {
      return accepted(PREFIX + ".resourceStart(" + key + "," + JSON.stringify(image.type) + ")").then(function () {
        function next(offset) {
          if (offset >= image.base64.length) return accepted(PREFIX + ".resourceFinish(" + key + ",'')");
          return accepted(PREFIX + ".resourceAppend(" + key + "," + JSON.stringify(image.base64.slice(offset, offset + CHUNK_LENGTH)) + ")")
            .then(function () { return next(offset + CHUNK_LENGTH); });
        }
        return next(0);
      });
    }).catch(function (error) {
      return accepted(PREFIX + ".resourceFinish(" + key + "," + JSON.stringify(String(error && error.message || error)) + ")");
    });
  }
  function readPayload(controller, token) {
    const key = JSON.stringify(token);
    const started = Date.now();
    function poll() {
      if (Date.now() - started > 65000) {
        const error = new Error("408 页面读取超时，请刷新后重试");
        error.stopImport = true;
        return Promise.reject(error);
      }
      return evaluate(controller, PREFIX + "?" + PREFIX + ".read(" + key + "):JSON.stringify({error:'408 页面连接已断开'})").then(function (json) {
        const status = JSON.parse(String(json || ""));
        if (status.error) {
          const error = new Error(status.error);
          error.stage = status.stage || "网页处理图片";
          error.source = status.source;
          error.diagnostics = status.diagnostics;
          throw error;
        }
        if (status.resource) return provideResource(controller, token, status.resource).then(poll);
        if (!status.ready) {
          return delay().then(poll);
        }
        if (!Number.isSafeInteger(status.length) || status.length < 1 || status.length > 32 * 1024 * 1024) throw new Error("408 题目传输大小无效");
        const chunks = [];
        function next(offset) {
          if (Date.now() - started > 65000) {
            const error = new Error("408 题目传输超时，请刷新后重试");
            error.stopImport = true;
            throw error;
          }
          if (offset >= status.length) return JSON.parse(chunks.join(""));
          return evaluate(controller, PREFIX + ".chunk(" + key + "," + offset + ")").then(function (chunk) {
            const text = String(chunk || "");
            if (text.length !== Math.min(CHUNK_LENGTH, status.length - offset)) throw new Error("408 题目图片传输不完整，请重试");
            chunks.push(text);
            return next(offset + CHUNK_LENGTH);
          });
        }
        return next(0);
      });
    }
    return poll();
  }
  function importCategory(controller, onProgress, single, beforeImport, page) {
    if (page && (page.provider !== '408' || !/^https:\/\/www\.408os\.cn\/exercise(?:\?|$)/.test(page.url || '')
      || !Array.isArray(page.questions) || !page.questions.length || page.questions.length > 10000)) throw new Error('当前 408 页面题目列表无效');
    const session = single ? single.session : __DAGUANYUAN_MATH_IMPORT_GLOBAL__.prepared408Session(controller.addon);
    const token = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const key = JSON.stringify(token);
    const result = { total: 0, createdCount: 0, answerAddedCount: 0, skippedCount: 0, failed: [] };
    const report = typeof onProgress === "function" ? onProgress : function () {};
    function cleanup() {
      return evaluate(controller, PREFIX + "&&" + PREFIX + ".cancel(" + key + ")").catch(function () {});
    }
    const script = page ? 'String(window.location.href)===' + JSON.stringify(page.url) + '&&' + pageScript(token, null, 'page') : pageScript(token, single && single.target);
    return evaluate(controller, script).then(function (accepted) {
      if (String(accepted) !== "true") throw new Error("请先进入 408 知识点分类或年份真题页");
      return readPayload(controller, token);
    }).then(function (listing) {
      if (!listing || !Array.isArray(listing.ids) || !listing.category) throw new Error("408 分类信息读取失败");
      if (single && listing.ids.length !== 1) throw new Error("408 单题读取结果无效，已停止导入");
      result.total = listing.ids.length;
      let selected = listing.ids.map(function (id, index) { return { id, index }; });
      if (page && !page.fullCategory) {
        const seen = new Set();
        selected = page.questions.map(function (question) {
          const index = listing.ids.indexOf(question.id);
          if (!Number.isSafeInteger(question.id) || question.id < 1 || index < 0 || seen.has(question.id)) throw new Error('当前 408 页面题目与列表不一致，请刷新后重试');
          seen.add(question.id); return { id: question.id, index: index };
        });
        result.total = selected.length;
      }
      function next(index) {
        if (beforeImport && beforeImport.check) beforeImport.check();
        if (index >= selected.length) return result;
        const id = selected[index].id;
        let source = listing.sources && listing.sources[id] || "";
        let stage = "读取题目与传输";
        let diagnostics;
        const content = beforeImport && beforeImport.content === 'questionAnswer' ? 'questionAnswer' : 'question';
        const operation = Promise.resolve().then(function () {
          if (session.shouldSkip && session.shouldSkip(id, listing.category, content)) {
            result.skippedCount += 1; return;
          }
          return evaluate(controller, "String(" + PREFIX + "&&" + PREFIX + ".prepare(" + key + "," + selected[index].index + "," + JSON.stringify(content) + "))").then(function (accepted) {
            if (String(accepted) !== "true") throw new Error("当前 408 分类已切换，导入停止");
            return readPayload(controller, token);
          }).then(function (payload) {
            if (!payload.question || payload.question.id !== id) throw new Error("408 题目 ID 与列表不一致");
            source = payload.question.source || source;
            diagnostics = payload.diagnostics;
            stage = "MarginNote 建卡";
            if (beforeImport && beforeImport.check) beforeImport.check();
            const outcome = session.write(payload.question, listing.category, content);
            if (session.takeCommentFoldWarnings) {
              const warnings = session.takeCommentFoldWarnings();
              if (warnings.length) result.commentFoldWarnings = (result.commentFoldWarnings || []).concat(warnings);
            }
            if (outcome === 'answerAdded') result.answerAddedCount += 1;
            else if (outcome) result.createdCount += 1;
            else result.skippedCount += 1;
          });
        });
        return operation.catch(function (error) {
          if (error.stopImport || /分类已切换|连接已断开/.test(String(error.message))) throw error;
          result.failed.push({ questionId: id, source: error.source || source, stage: error.stage || stage,
            diagnostics: error.diagnostics || diagnostics, reason: String(error && error.message || error) });
        }).then(function () {
          report({ processed: index + 1, total: result.total, created: result.createdCount, answerAdded: result.answerAddedCount, skipped: result.skippedCount, failed: result.failed.length });
          return next(index + 1);
        });
      }
      if (!result.total) return result;
      return Promise.resolve(typeof beforeImport === "function" ? beforeImport({
        source: page && !page.fullCategory ? '408 / 当前页面' : "408 / " + (listing.category.path || [listing.category.title]).join(" / "),
        target: session.targetTitle,
        questions: page && !page.fullCategory ? page.questions : listing.ids.map(function (id) { return { id: id, title: listing.sources && listing.sources[id] || "题目 " + id, summary: listing.summaries && listing.summaries[id] || '' }; }),
      }) : true).then(function (accepted) {
        if (accepted === false) { result.cancelled = true; return result; }
        selected = __DAGUANYUAN_MATH_IMPORT_GLOBAL__.selectQuestions(selected, accepted);
        result.total = selected.length;
        return next(0);
      });
    }).then(function (value) { return cleanup().then(function () { return value; }); }, function (error) {
      return cleanup().then(function () {
        const failure = new Error(`408 导入中断：已新建 ${result.createdCount} 道、补答案 ${result.answerAddedCount} 道、跳过 ${result.skippedCount} 道、失败 ${result.failed.length} 道。${error && error.message || error}`);
        failure.importResult = result;
        throw failure;
      });
    });
  }
  function importSingle(controller, target, session, beforeImport, onProgress) {
    return importCategory(controller, onProgress, { target: target, session: session }, beforeImport);
  }
  function resolveQuestion(controller, target) {
    const token = `lookup-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const key = JSON.stringify(token);
    function cleanup() { return evaluate(controller, PREFIX + "&&" + PREFIX + ".cancel(" + key + ")").catch(function () {}); }
    return evaluate(controller, pageScript(token, target)).then(function (accepted) {
      if (String(accepted) !== "true") throw new Error("请先进入 408 知识点分类或年份真题页");
      return readPayload(controller, token);
    }).then(function (listing) {
      if (!listing || !Array.isArray(listing.ids) || listing.ids.length !== 1) throw new Error("无法唯一确定所点击的 408 题目");
      const id = __DAGUANYUAN_MATH_API_GLOBAL__.positiveInteger(listing.ids[0], "题目 ID");
      return { id: id, provider: "408", year: target.year, number: target.number, url: target.url };
    }).then(function (value) { return cleanup().then(function () { return value; }); }, function (error) {
      return cleanup().then(function () { throw error; });
    });
  }
  function prepareWorkspace(controller, includePreviews) {
    const token = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const key = JSON.stringify(token);
    return evaluate(controller, pageScript(token, null, includePreviews !== false)).then(function (accepted) {
      if (String(accepted) !== 'true') throw new Error('无法读取 408 题目，请先在导航栏的 408 页登录并确认题目可以正常打开，再返回导入页重试');
      return readPayload(controller, token);
    }).then(function (listing) {
      if (!listing || !listing.category || !Array.isArray(listing.ids)) throw new Error('408 题目列表格式无效');
      return {
        listing,
        readQuestion: function (id, content) {
          const index = listing.ids.indexOf(id);
          if (index < 0) throw new Error('所选 408 题目已不在原分类中，请重新读取');
          return evaluate(controller, 'String(' + PREFIX + '.prepare(' + key + ',' + index + ',' + JSON.stringify(content) + '))').then(function (accepted) {
            if (String(accepted) !== 'true') throw new Error('408 题目连接已中断');
            return readPayload(controller, token);
          }).then(function (payload) {
            if (!payload.question || payload.question.id !== id) throw new Error('408 题目 ID 与选择不一致');
            return payload.question;
          });
        },
        close: function () { return evaluate(controller, PREFIX + '&&' + PREFIX + '.cancel(' + key + ')').catch(function () {}); },
      };
    });
  }
  return { pageScript, importCategory, importSingle, resolveQuestion, prepareWorkspace };
})();
