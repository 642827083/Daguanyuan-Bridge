var __DAGUANYUAN_408_PAGE_GLOBAL__ = (function () {
  // 此函数只在网站 WebView 中执行，浏览器对象不会用于插件原生环境。
  function pageReceiver(token, target) {
    var startURL = new URL(window.location.href);
    if (startURL.hostname !== "www.408os.cn" || !/^\/exercise\/?$/.test(startURL.pathname)) return false;
    var knowledgeId = Number(startURL.searchParams.get("knowledgeId"));
    var year = Number(startURL.searchParams.get("year"));
    var collectionId = Number(startURL.searchParams.get("collectionId"));
    var collectionMode = startURL.searchParams.get("mode") === "collection"
      && Number.isSafeInteger(collectionId) && collectionId > 0;
    if (!(Number.isSafeInteger(knowledgeId) && knowledgeId > 0)
      && !(Number.isSafeInteger(year) && year >= 2009 && year <= 2100) && !collectionMode) return false;
    if ((startURL.searchParams.has("mode") || startURL.searchParams.has("collectionId")) && !(target && collectionMode)) {
      throw new Error("请先进入 408 知识点分类或年份真题页");
    }
    startURL.hash = "";
    startURL.searchParams.delete("questionId");
    if (target) {
      var selectedURL = new URL(target.url);
      selectedURL.hash = "";
      selectedURL.searchParams.delete("questionId");
      if (selectedURL.toString() !== startURL.toString()) throw new Error("当前 408 分类已切换，请重新点击导入单题");
    }
    var category = {
      title: collectionMode ? startURL.searchParams.get("collectionName") || "题本"
        : knowledgeId ? startURL.searchParams.get("knowledgeName") || "知识点 " + knowledgeId : year + "年真题",
      url: startURL.toString(),
    };
    var state = { token: token, payload: "", error: "", ready: false, rows: [], sequence: 0, resources: [],
      stage: "读取分类", source: "", diagnostics: {} };
    var request;
    var structuredRenderer;
    var staticDecoder;
    var imageCache = new Map();
    // 动态模块加载表达式只交给 WebView 解析，避免 JavaScriptCore 按原生模块处理。
    var importModule = Function("url", "return import(url)");
    window.__DAGUANYUAN_408_IMPORT_PAGE__ = state;

    function valid() {
      var current = new URL(window.location.href);
      current.hash = "";
      current.searchParams.delete("questionId");
      return window.__DAGUANYUAN_408_IMPORT_PAGE__ === state && current.toString() === category.url;
    }
    function ready(payload) {
      if (!valid()) return;
      state.payload = JSON.stringify(payload);
      state.ready = true;
    }
    function fail(error) {
      if (!valid()) return;
      state.error = String(error && error.message || error);
    }
    function timed(promise, message) {
      return new Promise(function (resolve, reject) {
        var timer = window.setTimeout(function () { reject(new Error(message)); }, 30000);
        Promise.resolve(promise).then(function (value) {
          window.clearTimeout(timer);
          resolve(value);
        }, function (error) { window.clearTimeout(timer); reject(error); });
      });
    }
    function fetchResource(url) {
      var target = new URL(url, category.url);
      if (!/^https?:$/.test(target.protocol)) return Promise.reject(new Error("题目资源地址无效"));
      return timed(window.fetch(target.href, { credentials: target.origin === startURL.origin ? "include" : "omit" }), "题目资源下载超时").then(function (response) {
        if (!response.ok) throw new Error("题目资源下载失败：" + response.status);
        return response;
      });
    }
    function blobData(blob) {
      if (!blob.size || blob.size > 20 * 1024 * 1024) return Promise.reject(new Error("题目图片为空或超过 20 MB"));
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () { resolve(String(reader.result)); };
        reader.onerror = function () { reject(new Error("题目图片读取失败")); };
        reader.readAsDataURL(blob);
      });
    }
    // 跨域题图由原生网络层下载，避免网站的跨域策略阻止图片导入。
    function nativeBlob(url) {
      return new Promise(function (resolve, reject) {
        state.resources.push({ url: url, chunks: [], type: "", resolve: resolve, reject: reject });
      });
    }
    function clearResources() {
      state.resources.splice(0).forEach(function (resource) { resource.reject(new Error("题图下载已取消")); });
    }
    function checkedImageData(blob) {
      state.stage = "解码图片";
      state.diagnostics = { imageKind: blob.type };
      if (!blob.size || blob.size > 20 * 1024 * 1024) return Promise.reject(new Error("题目图片为空或超过 20 MB"));
      return timed(new Promise(function (resolve, reject) {
        var objectURL = URL.createObjectURL(blob);
        var image = new Image();
        image.onload = function () {
          URL.revokeObjectURL(objectURL);
          if (!image.naturalWidth || !image.naturalHeight) { reject(new Error("题目图片无法解码")); return; }
          state.diagnostics.width = image.naturalWidth;
          state.diagnostics.height = image.naturalHeight;
          if (/^image\/(png|jpeg)$/i.test(blob.type)) { blobData(blob).then(resolve, reject); return; }
          try {
            var canvas = document.createElement("canvas");
            state.stage = "转换图片";
            var scale = Math.min(1, 4096 / Math.max(image.naturalWidth, image.naturalHeight));
            canvas.width = Math.ceil(image.naturalWidth * scale);
            canvas.height = Math.ceil(image.naturalHeight * scale);
            canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(function (png) {
              if (!png) reject(new Error("题目图片转换失败"));
              else blobData(png).then(resolve, reject);
            }, "image/png");
          } catch (error) { reject(error); }
        };
        image.onerror = function () { URL.revokeObjectURL(objectURL); reject(new Error("题目图片损坏或无法解码")); };
        image.src = objectURL;
      }), "题目图片解码超时");
    }
    // 按浏览器已经排好的位置绘制 HTML，避免把 foreignObject 再交给图片解码器。
    async function captureHTML(node, bounds) {
      var width = Math.ceil(bounds.width);
      var height = Math.ceil(bounds.height);
      if (!(width > 0 && height > 0)) throw new Error("题目图文没有可绘制的尺寸");
      var scale = Math.min(2, 4096 / Math.max(width, height));
      var canvas = document.createElement("canvas");
      canvas.width = Math.ceil(width * scale);
      canvas.height = Math.ceil(height * scale);
      var context = canvas.getContext("2d");
      context.scale(scale, scale);
      var painted = 0;
      async function paint(element) {
        var style = window.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") return;
        var rect = element.getBoundingClientRect();
        var left = rect.left - bounds.left;
        var top = rect.top - bounds.top;
        if (style.backgroundColor && !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(style.backgroundColor)) {
          context.fillStyle = style.backgroundColor;
          context.fillRect(left, top, rect.width, rect.height);
        }
        ["Top", "Right", "Bottom", "Left"].forEach(function (side) {
          var thickness = parseFloat(style["border" + side + "Width"]);
          if (!thickness || style["border" + side + "Style"] === "none") return;
          context.fillStyle = style["border" + side + "Color"];
          if (side === "Top" || side === "Bottom") context.fillRect(left,
            side === "Top" ? top : top + rect.height - thickness, rect.width, thickness);
          else context.fillRect(side === "Left" ? left : left + rect.width - thickness, top, thickness, rect.height);
          painted += 1;
        });
        var tag = element.tagName.toLowerCase();
        if (tag === "img" || tag === "svg") {
          var image = new Image();
          var source = tag === "svg" ? await prepareSVG(element.cloneNode(true), category.url) : element.getAttribute("src");
          if (!/^data:image\/(png|jpeg);base64,/i.test(source || "")) throw new Error("题目图文图片尚未转换");
          await timed(new Promise(function (resolve, reject) {
            image.onload = resolve;
            image.onerror = function () { reject(new Error("题目图文内嵌图片加载失败")); };
            image.src = source;
          }), "题目图文内嵌图片加载超时");
          context.drawImage(image, left, top, rect.width, rect.height);
          painted += 1;
          return;
        }
        if (["script", "style", "annotation", "math"].indexOf(tag) >= 0) return;
        for (var childIndex = 0; childIndex < element.childNodes.length; childIndex += 1) {
          var child = element.childNodes[childIndex];
          if (child.nodeType === 1) await paint(child);
          else if (child.nodeType === 3 && child.textContent.trim()) {
            // 用每个字符的布局矩形保留分式、上下标、换行和字距。
            context.font = style.fontStyle + " " + style.fontWeight + " " + style.fontSize + " " + style.fontFamily;
            context.fillStyle = style.color;
            context.textBaseline = "alphabetic";
            var range = document.createRange();
            for (var offset = 0; offset < child.textContent.length;) {
              var character = String.fromCodePoint(child.textContent.codePointAt(offset));
              range.setStart(child, offset);
              range.setEnd(child, offset + character.length);
              var letter = range.getBoundingClientRect();
              if (letter.width > 0 && letter.height > 0 && character.trim()) {
                var metrics = context.measureText(character);
                var descent = Number.isFinite(metrics.fontBoundingBoxDescent) ? metrics.fontBoundingBoxDescent : parseFloat(style.fontSize) * 0.2;
                context.fillText(character, letter.left - bounds.left, letter.bottom - bounds.top - descent);
                painted += 1;
              }
              offset += character.length;
            }
          }
        }
      }
      await paint(node);
      if (!painted) throw new Error("题目图文没有可绘制的内容");
      return new Promise(function (resolve, reject) {
        canvas.toBlob(function (png) {
          if (!png) reject(new Error("题目图文转换失败"));
          else blobData(png).then(resolve, reject);
        }, "image/png");
      });
    }
    async function withLayout(node, action, contextNode) {
      var host = document.createElement("div");
      host.setAttribute("data-daguanyuan-capture", "true");
      host.style.cssText = "position:fixed;left:-100000px;top:0;display:block;width:max-content;max-width:none;pointer-events:none;background:white;color:black;font-size:20px;z-index:-2147483647";
      var clone = document.importNode(node, true);
      // 禁止离屏布局重新触发页面事件或执行脚本。
      Array.from(clone.querySelectorAll("script, iframe, object, embed")).forEach(function (item) { item.remove(); });
      [clone].concat(Array.from(clone.querySelectorAll("*"))).forEach(function (item) {
        Array.from(item.attributes).forEach(function (attribute) { if (/^on/i.test(attribute.name)) item.removeAttribute(attribute.name); });
      });
      var content = clone;
      var ancestor = (contextNode || node).parentElement;
      while (ancestor && !/^(body|html)$/i.test(ancestor.tagName)) {
        var wrapper = document.importNode(ancestor, false);
        wrapper.appendChild(content);
        content = wrapper;
        ancestor = ancestor.parentElement;
      }
      host.appendChild(content);
      document.body.appendChild(host);
      try {
        await Promise.all(Array.from(clone.querySelectorAll("img")).map(function (image) {
          image.loading = "eager";
          return timed(new Promise(function (resolve, reject) {
            if (image.complete && image.naturalWidth) { resolve(); return; }
            image.onload = resolve;
            image.onerror = function () { reject(new Error("题目图文内嵌图片加载失败")); };
          }), "题目图文布局超时");
        }));
        clone.getBoundingClientRect();
        if (document.fonts && document.fonts.ready) await timed(document.fonts.ready, "题目公式字体加载超时");
        return await action(clone);
      } finally { host.remove(); }
    }
    async function formulaImage(formula, baseURL) {
      state.stage = "转换公式图片";
      var clone = formula.cloneNode(true);
      await Promise.all(Array.from(clone.querySelectorAll("img")).map(function (image) {
        var address = image.getAttribute("src") || image.getAttribute("data-src");
        if (!address) throw new Error("题目公式图片地址为空");
        return imageData(address, baseURL).then(function (data) { image.setAttribute("src", data); image.removeAttribute("srcset"); });
      }));
      return withLayout(clone, function (laidOut) {
        var visible = laidOut.querySelector(".katex-html") || laidOut;
        // 上下标和分式可能伸出行内外框，合并实际元素边界以免截掉内容。
        var rectangles = [visible].concat(Array.from(visible.querySelectorAll("*"))).filter(function (element) {
          var style = window.getComputedStyle(element);
          return style.display !== "none" && style.visibility !== "hidden" && !element.closest("math, annotation, .katex-mathml");
        }).map(function (element) { return element.getBoundingClientRect(); }).filter(function (rect) { return rect.width > 0 && rect.height > 0; });
        if (!rectangles.length) throw new Error("题目公式没有可绘制的内容");
        var left = Math.min.apply(null, rectangles.map(function (rect) { return rect.left; }));
        var top = Math.min.apply(null, rectangles.map(function (rect) { return rect.top; }));
        var right = Math.max.apply(null, rectangles.map(function (rect) { return rect.right; }));
        var bottom = Math.max.apply(null, rectangles.map(function (rect) { return rect.bottom; }));
        return captureHTML(visible, { left: left, top: top, width: right - left, height: bottom - top });
      }, formula);
    }
    async function flattenForeignObjects(svg) {
      if (!svg.querySelector("foreignObject")) return svg;
      return withLayout(svg, async function (laidOut) {
        var foreignObjects = Array.from(laidOut.querySelectorAll("foreignObject"));
        for (var index = 0; index < foreignObjects.length; index += 1) {
          var item = foreignObjects[index];
          var frame = item.getBoundingClientRect();
          var bounds = frame;
          var matrix = item.getScreenCTM();
          // 图片标签占整张图的布局框时，只截取实际内容，避免为每个标签创建整图画布。
          if (matrix && !matrix.b && !matrix.c && item.querySelector("img") && !item.textContent.trim()) {
            var rectangles = Array.from(item.querySelectorAll("img")).map(function (image) { return image.getBoundingClientRect(); });
            var left = Math.min.apply(null, rectangles.map(function (rect) { return rect.left; }));
            var top = Math.min.apply(null, rectangles.map(function (rect) { return rect.top; }));
            var right = Math.max.apply(null, rectangles.map(function (rect) { return rect.right; }));
            var bottom = Math.max.apply(null, rectangles.map(function (rect) { return rect.bottom; }));
            bounds = { left: left, top: top, width: right - left, height: bottom - top };
          }
          var data = await captureHTML(item, bounds);
          var replacement = document.createElementNS("http://www.w3.org/2000/svg", "image");
          ["x", "y", "width", "height", "transform", "opacity", "clip-path"].forEach(function (key) {
            if (item.hasAttribute(key)) replacement.setAttribute(key, item.getAttribute(key));
          });
          replacement.setAttribute("preserveAspectRatio", "none");
          if (bounds !== frame) {
            var point = laidOut.createSVGPoint();
            point.x = bounds.left;
            point.y = bounds.top;
            var origin = point.matrixTransform(matrix.inverse());
            replacement.setAttribute("x", String(origin.x));
            replacement.setAttribute("y", String(origin.y));
            replacement.setAttribute("width", String(bounds.width / Math.abs(matrix.a)));
            replacement.setAttribute("height", String(bounds.height / Math.abs(matrix.d)));
          }
          replacement.setAttribute("href", data);
          replacement.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", data);
          item.replaceWith(replacement);
        }
        return laidOut.cloneNode(true);
      });
    }
    function rasterSVG(svg) {
      state.stage = "转换 SVG 图片";
      return new Promise(function (resolve, reject) {
        var clone = svg.cloneNode(true);
        clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        var viewBox = (clone.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
        var widthValue = clone.getAttribute("width") || "";
        var heightValue = clone.getAttribute("height") || "";
        var width = /^\d+(?:\.\d+)?(?:px)?$/.test(widthValue) ? parseFloat(widthValue) : viewBox[2] || 800;
        var height = /^\d+(?:\.\d+)?(?:px)?$/.test(heightValue) ? parseFloat(heightValue) : viewBox[3] || 400;
        if (!(width > 0 && height > 0)) { reject(new Error("题目 SVG 尺寸无效")); return; }
        state.diagnostics = { imageKind: "SVG", width: width, height: height,
          nestedImages: svg.querySelectorAll("image, img").length, foreignObjects: svg.querySelectorAll("foreignObject").length };
        var scale = Math.min(2, 4096 / Math.max(width, height));
        clone.setAttribute("width", String(width));
        clone.setAttribute("height", String(height));
        var serialized = new XMLSerializer().serializeToString(clone);
        if (new DOMParser().parseFromString(serialized, "image/svg+xml").querySelector("parsererror")) {
          reject(new Error("题目 SVG 序列化格式无效")); return;
        }
        var image = new Image();
        image.onload = function () {
          try {
            var canvas = document.createElement("canvas");
            canvas.width = Math.ceil(width * scale);
            canvas.height = Math.ceil(height * scale);
            var context = canvas.getContext("2d");
            context.fillStyle = "#fff";
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            var pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
            var hasContent = false;
            for (var pixel = 0; pixel < pixels.length; pixel += 4) {
              if (pixels[pixel] !== 255 || pixels[pixel + 1] !== 255 || pixels[pixel + 2] !== 255) { hasContent = true; break; }
            }
            if (!hasContent) throw new Error("题目 SVG 转换结果为空白，已停止导入以免丢失图文");
            canvas.toBlob(function (png) {
              if (!png) { reject(new Error("题目 SVG 转换失败")); return; }
              blobData(png).then(resolve, reject);
            }, "image/png");
          } catch (error) { reject(error); }
        };
        image.onerror = function () { reject(new Error("题目 SVG 加载失败")); };
        image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(serialized);
      });
    }
    function prepareSVG(svg, baseURL) {
      state.stage = "读取 SVG 内嵌图片";
      state.diagnostics = { imageKind: "SVG", nestedImages: svg.querySelectorAll("image, img").length,
        foreignObjects: svg.querySelectorAll("foreignObject").length };
      return Promise.all(Array.from(svg.querySelectorAll("image, img")).map(function (item) {
        var isHTMLImage = item.tagName.toLowerCase() === "img";
        var address = isHTMLImage ? item.getAttribute("src") || item.getAttribute("data-src") : item.getAttribute("href") || item.getAttribute("xlink:href");
        if (!address) throw new Error("题目 SVG 内嵌图片地址为空");
        return imageData(address, baseURL).then(function (data) {
          if (isHTMLImage) { item.setAttribute("src", data); item.removeAttribute("srcset"); }
          else { item.setAttribute("href", data); item.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", data); }
        });
      })).then(function () { return flattenForeignObjects(svg); }).then(function (flattened) {
        return timed(rasterSVG(flattened), "题目 SVG 转换超时");
      });
    }
    function imageData(source, baseURL) {
      state.stage = "下载图片";
      var url = new URL(source, baseURL).href;
      if (imageCache.has(url)) return imageCache.get(url);
      var resource = /^data:image\//i.test(url) ? window.fetch(url).then(function (response) { return response.blob(); })
        : new URL(url).origin !== startURL.origin ? nativeBlob(url)
          : fetchResource(url).then(function (response) { return response.blob(); });
      var operation = resource.then(function (blob) {
        if (blob.type.split(";")[0] === "image/svg+xml") {
          return blob.text().then(function (content) {
            var parsed = new DOMParser().parseFromString(content, "image/svg+xml");
            if (parsed.querySelector("parsererror") || parsed.documentElement.tagName.toLowerCase() !== "svg") {
              throw new Error("题目 SVG 格式无效");
            }
            return prepareSVG(parsed.documentElement, url);
          });
        }
        if (!/^image\/(png|jpeg|gif|webp)$/i.test(blob.type)) throw new Error("题目图片格式无法导入：" + blob.type);
        return checkedImageData(blob);
      });
      imageCache.set(url, operation);
      return operation;
    }
    function simpleFormula(formula) {
      var rendered = formula.querySelector(".katex-html");
      if (!rendered) return "";
      // 只还原可确认语义的排版结构；未知结构返回空值，由图片兜底保留外观。
      var allowed = ["katex-html", "base", "strut", "mspace", "mord", "mathnormal", "mrel", "mbin", "mopen", "mclose", "mpunct", "minner", "mtight", "mop", "op-symbol", "small-op", "large-op", "sizing", "reset-size6", "size3"];
      var symbols = { "∣": "|", "−": "-", "∈": "\\in ", "∉": "\\notin ", "≤": "\\leq ", "≥": "\\geq ", "≠": "\\ne ", "×": "\\times ", "⋅": "\\cdot ", "∞": "\\infty ", "⋯": "\\cdots ", "∑": "\\sum ", "∏": "\\prod ", "∫": "\\int " };
      // 集合符号逐字映射，避免缺少原始表达式时把普通集合关系变成图片。
      var sets = { "∩": "cap", "∪": "cup", "∅": "varnothing", "⊂": "subset", "⊃": "supset", "⊆": "subseteq", "⊇": "supseteq", "⊊": "subsetneq", "⊋": "supsetneq", "⊄": "not\\subset", "⊅": "not\\supset", "⊈": "nsubseteq", "⊉": "nsupseteq", "∋": "ni", "∌": "notni" };
      Object.keys(sets).forEach(function (character) { symbols[character] = "\\" + sets[character] + " "; });
      symbols["{"] = "\\{";
      symbols["}"] = "\\}";
      var greek = { "α": "alpha", "β": "beta", "γ": "gamma", "δ": "delta", "ϵ": "epsilon", "ε": "varepsilon", "ζ": "zeta", "η": "eta", "θ": "theta", "ϑ": "vartheta", "ι": "iota", "κ": "kappa", "λ": "lambda", "μ": "mu", "ν": "nu", "ξ": "xi", "π": "pi", "ϖ": "varpi", "ρ": "rho", "ϱ": "varrho", "σ": "sigma", "ς": "varsigma", "τ": "tau", "υ": "upsilon", "ϕ": "phi", "φ": "varphi", "χ": "chi", "ψ": "psi", "ω": "omega", "Γ": "Gamma", "Δ": "Delta", "Θ": "Theta", "Λ": "Lambda", "Ξ": "Xi", "Π": "Pi", "Σ": "Sigma", "Υ": "Upsilon", "Φ": "Phi", "Ψ": "Psi", "Ω": "Omega" };
      Object.keys(greek).forEach(function (character) { symbols[character] = "\\" + greek[character] + " "; });
      symbols["∼"] = "\\sim ";
      symbols["…"] = "\\ldots ";
      var validFormula = true;
      function textFormula(node) {
        function textRead(part) {
          if (part.nodeType === 3) return part.textContent;
          if (part.nodeType !== 1 || part.tagName.toLowerCase() !== "span"
            || Array.from(part.classList).some(function (name) { return ["mord", "text", "mtight", "cjk_fallback"].indexOf(name) < 0; })
            || /(?:position|transform|display)\s*:/i.test(part.getAttribute("style") || "")) { validFormula = false; return ""; }
          return part.childNodes.length ? Array.from(part.childNodes).map(textRead).join("") : part.textContent;
        }
        var text = textRead(node).replace(/\u00a0/g, " ");
        if (!text.trim() || /[\u0000-\u001f\u007f]/.test(text)) { validFormula = false; return ""; }
        // 文字中的特殊字符必须逐字转义，避免被 LaTeX 当作命令、分组或注释。
        var escapes = { "\\": "\\textbackslash{}", "{": "\\{", "}": "\\}", "$": "\\$", "&": "\\&", "#": "\\#", "%": "\\%", "_": "\\_", "^": "\\textasciicircum{}", "~": "\\textasciitilde{}" };
        return "\\text{" + Array.from(text).map(function (character) { return Object.prototype.hasOwnProperty.call(escapes, character) ? escapes[character] : character; }).join("") + "}";
      }
      function underlined(node) {
        var wrapper = node.children[0];
        var row = wrapper && wrapper.children[0];
        var list = row && row.children[0];
        if (node.children.length !== 1 || !wrapper.classList.contains("vlist-t") || !row || !row.classList.contains("vlist-r") || !list || !list.classList.contains("vlist") || list.children.length !== 2) { validFormula = false; return ""; }
        var expression = "", lines = 0;
        Array.from(list.children).forEach(function (slot) {
          var parts = Array.from(slot.children);
          if (parts.length !== 2 || !parts[0].classList.contains("pstrut") || parts[0].textContent.trim()) { validFormula = false; return; }
          if (parts[1].classList.contains("underline-line")) {
            if (parts[1].children.length || parts[1].textContent.trim()) validFormula = false;
            lines += 1;
          } else {
            if (expression) validFormula = false;
            expression = read(parts[1]).trim();
          }
        });
        // vlist 的基线占位符只有零宽字符；额外文字不能静默丢弃。
        var helpers = Array.from(row.children).slice(1).concat(Array.from(wrapper.children).slice(1));
        if (helpers.some(function (helper) { return /[^\s\u200b]/.test(helper.textContent); }) || lines !== 1 || !expression) { validFormula = false; return ""; }
        return "\\underline{" + expression + "}";
      }
      function scripts(node) {
        var list = node.querySelector && node.querySelector(".vlist-t > .vlist-r > .vlist");
        if (!list || list.children.length < 1 || list.children.length > 2) { validFormula = false; return ""; }
        var suffixes = {};
        Array.from(list.children).forEach(function (slot) {
          var parts = Array.from(slot.children);
          var top = (slot.getAttribute("style") || "").match(/(?:^|;)\s*top\s*:\s*(-?[\d.]+)em\s*(?:;|$)/);
          var height = parts[0] && (parts[0].getAttribute("style") || "").match(/(?:^|;)\s*height\s*:\s*([\d.]+)em\s*(?:;|$)/);
          if (parts.length !== 2 || !parts[0].classList.contains("pstrut") || parts[0].textContent.trim() || !parts[1].classList.contains("sizing") || !top || !height) { validFormula = false; return; }
          var shift = Number(top[1]) + Number(height[1]);
          var sign = shift < -0.001 ? "^" : shift > 0.001 ? "_" : "";
          var expression = read(parts[1]);
          if (!sign || suffixes[sign] || !expression) { validFormula = false; return; }
          suffixes[sign] = "{" + expression.trim() + "}";
        });
        return (suffixes._ ? "_" + suffixes._ : "") + (suffixes["^"] ? "^" + suffixes["^"] : "");
      }
      function read(node) {
        if (node.nodeType === 3) {
          if (node.textContent.trim()) validFormula = false;
          return "";
        }
        if (node.nodeType !== 1 || node.tagName.toLowerCase() !== "span") { validFormula = false; return ""; }
        var classes = Array.from(node.classList);
        // KaTeX 的空集等符号使用 amsrm 字体，仅接受已知集合符号的叶节点。
        if (node.classList.contains("amsrm")) {
          if (node.children.length || !Object.prototype.hasOwnProperty.call(sets, node.textContent)) { validFormula = false; return ""; }
          classes = classes.filter(function (name) { return name !== "amsrm"; });
        }
        if (node.classList.contains("text") || node.classList.contains("cjk_fallback")) return textFormula(node);
        if (node.classList.contains("underline") && classes.every(function (name) { return name === "underline" || name === "mord" || name === "mtight"; })) return underlined(node);
        if (node.classList.contains("msupsub")) { validFormula = false; return ""; }
        if (!classes.length || classes.some(function (name) { return allowed.indexOf(name) < 0; })) { validFormula = false; return ""; }
        if (node.classList.contains("strut") || node.classList.contains("mspace")) {
          if (node.children.length || node.textContent.trim()) validFormula = false;
          return "";
        }
        if (!node.classList.contains("op-symbol") && /(?:position|transform|display)\s*:/i.test(node.getAttribute("style") || "")) { validFormula = false; return ""; }
        if (node.children.length) {
          var children = Array.from(node.children);
          var attached = children.filter(function (child) { return child.classList.contains("msupsub"); });
          if (attached.length) {
            if (attached.length !== 1 || children[children.length - 1] !== attached[0] || children.length < 2 || !classes.some(function (name) { return name === "mord" || name === "mop"; })) { validFormula = false; return ""; }
            var base = children.slice(0, -1).map(read).join("").trim();
            if (!base) { validFormula = false; return ""; }
            // 组合基底必须加括号分组，避免把 (a+b) 的平方改成 a+b 的最后一项平方。
            return (/^(?:[a-zA-Z0-9]|\\(?:sum|prod|int))$/.test(base) ? base : "{" + base + "}") + scripts(attached[0]);
          }
          return Array.from(node.childNodes).map(read).join("");
        }
        var value = node.textContent;
        if (!value || !classes.some(function (name) { return /^(mord|mrel|mbin|mopen|mclose|mpunct|minner|mop)$/.test(name); })) { validFormula = false; return ""; }
        return Array.from(value).map(function (character) {
          if (Object.prototype.hasOwnProperty.call(symbols, character)) return symbols[character];
          if (/^[a-zA-Z0-9.,()+\-=\/|\[\]:!<>]$/.test(character)) return character;
          validFormula = false;
          return "";
        }).join("");
      }
      var expression = read(rendered).trim();
      return validFormula ? expression : "";
    }
    async function markdown(html, baseURL) {
      state.stage = "解析题目图文";
      var parsed = new DOMParser().parseFromString(String(html || ""), "text/html");
      if (parsed.querySelector(".missing-asset")) throw new Error("网站标记此题存在失效图片，已跳过以免导入不完整题目");
      var formulas = Array.from(parsed.body.querySelectorAll(".katex")).filter(function (formula) { return !formula.parentElement.closest(".katex, svg, table"); });
      for (var formulaIndex = 0; formulaIndex < formulas.length; formulaIndex += 1) {
        var formula = formulas[formulaIndex];
        var original = formula.querySelector('annotation[encoding="application/x-tex"]');
        if (!original || !original.textContent.trim()) {
          var restored = simpleFormula(formula);
          if (restored) formula.setAttribute("data-daguanyuan-import-tex", restored);
          else formula.setAttribute("data-daguanyuan-import-image", await formulaImage(formula, baseURL));
        }
      }
      var images = Array.from(parsed.body.querySelectorAll("img, svg"));
      for (var index = 0; index < images.length; index += 1) {
        var item = images[index];
        if (item.closest(".katex, table") || item.parentElement && item.parentElement.closest("svg")) continue;
        var data;
        if (item.tagName.toLowerCase() === "svg") {
          Array.from(parsed.querySelectorAll("style")).forEach(function (style) {
            if (!style.closest("svg")) {
              var svgStyle = document.createElementNS("http://www.w3.org/2000/svg", "style");
              svgStyle.textContent = style.textContent;
              item.insertBefore(svgStyle, item.firstChild);
            }
          });
          data = await prepareSVG(item, baseURL);
        }
        else {
          var source = item.getAttribute("src") || item.getAttribute("data-src");
          if (!source) throw new Error("题目图片地址为空");
          data = await imageData(source, baseURL);
        }
        item.setAttribute("data-daguanyuan-import-image", data);
      }
      var tables = Array.from(parsed.body.querySelectorAll("table")).filter(function (table) { return !table.parentElement.closest("table, svg, .katex"); });
      for (var tableIndex = 0; tableIndex < tables.length; tableIndex += 1) {
        var table = tables[tableIndex];
        var tableClone = table.cloneNode(true);
        // 表内图片先转为本地数据，截图不依赖跨域地址或未加载的资源。
        for (var tableImage of Array.from(tableClone.querySelectorAll("img, svg"))) {
          if (tableImage.parentElement.closest("svg")) continue;
          var tableData;
          if (tableImage.tagName.toLowerCase() === "svg") tableData = await prepareSVG(tableImage, baseURL);
          else {
            var tableSource = tableImage.getAttribute("src") || tableImage.getAttribute("data-src");
            if (!tableSource) throw new Error("题目表格图片地址为空");
            tableData = await imageData(tableSource, baseURL);
          }
          var tablePicture = document.createElement("img");
          Array.from(tableImage.attributes).forEach(function (attribute) { if (["src", "srcset", "data-src"].indexOf(attribute.name) < 0) tablePicture.setAttribute(attribute.name, attribute.value); });
          tablePicture.src = tableData;
          tableImage.replaceWith(tablePicture);
        }
        state.stage = "转换表格图片";
        // 网站表格样式带组件作用域，复制当前正文外框的样式属性才能保留边框和间距。
        var tableHost = document.createElement("div");
        var viewer = document.querySelector(".question-content");
        if (viewer) {
          Array.from(viewer.attributes).forEach(function (attribute) {
            if (attribute.name === "class" || /^data-v-/.test(attribute.name)) tableHost.setAttribute(attribute.name, attribute.value);
          });
          var viewerWidth = viewer.getBoundingClientRect().width;
          if (viewerWidth > 0) tableHost.style.width = viewerWidth + "px";
        }
        tableHost.appendChild(tableClone);
        var tablePictureData = await withLayout(tableHost, function (laidOut) {
          var renderedTable = laidOut.querySelector("table");
          // 宽表常被滚动容器裁切，导出前展开完整宽度，不能只截可见列。
          var frame = renderedTable.getBoundingClientRect();
          var fullWidth = Math.max(frame.width, renderedTable.scrollWidth);
          var fullHeight = Math.max(frame.height, renderedTable.scrollHeight);
          renderedTable.style.maxWidth = "none";
          renderedTable.style.maxHeight = "none";
          renderedTable.style.overflow = "visible";
          if (fullWidth > frame.width) renderedTable.style.width = fullWidth + "px";
          if (fullHeight > frame.height) renderedTable.style.height = fullHeight + "px";
          frame = renderedTable.getBoundingClientRect();
          state.diagnostics = { imageKind: "表格", width: frame.width, height: frame.height };
          return captureHTML(renderedTable, frame);
        }, table);
        table.setAttribute("data-daguanyuan-import-image", tablePictureData);
        table.setAttribute("data-daguanyuan-import-kind", "表格");
      }
      var codeBlocks = [];
      var codeMarker = "\uE000DAGUANYUAN_CODE_";
      while (String(html).indexOf(codeMarker) >= 0) codeMarker += "_";
      function convert(node) {
        // 普通 HTML 文本中的排版换行折叠为空格；代码块单独保留原文。
        if (node.nodeType === 3) return node.textContent.replace(/[\t\n\r\f ]+/g, " ");
        if (node.nodeType !== 1) return "";
        var tag = node.tagName.toLowerCase();
        if (["script", "style", "noscript"].indexOf(tag) >= 0) return "";
        var picture = node.getAttribute("data-daguanyuan-import-image");
        if (picture) {
          var kind = node.getAttribute("data-daguanyuan-import-kind") || (node.classList.contains("katex") ? "公式" : "题图");
          var pictureMarkdown = "![" + kind + "](" + picture + ")";
          return kind === "公式" && !node.closest(".katex-display") ? pictureMarkdown : "\n\n" + pictureMarkdown + "\n\n";
        }
        if (node.classList.contains("katex")) {
          var formula = node.querySelector('annotation[encoding="application/x-tex"]');
          var expression = formula && formula.textContent.trim() || node.getAttribute("data-daguanyuan-import-tex");
          if (!expression) throw new Error("题目公式缺少原始表达式");
          return node.closest(".katex-display") ? "\n\n$$\n" + expression + "\n$$\n\n" : "$" + expression + "$";
        }
        if (tag === "pre") {
          var marker = codeMarker + codeBlocks.length + "\uE001";
          codeBlocks.push("```\n" + node.textContent.replace(/^\r?\n|\r?\n$/g, "") + "\n```");
          return "\n\n" + marker + "\n\n";
        }
        var body = Array.from(node.childNodes).map(convert).join("");
        if (tag === "br") return "\n";
        if (tag === "strong" || tag === "b") return "**" + body + "**";
        if (tag === "em" || tag === "i") return "*" + body + "*";
        if (tag === "code") return body.replace(/[\\`*_]/g, "\\$&");
        if (tag === "sup" || tag === "sub") return "<" + tag + ">" + body + "</" + tag + ">";
        if (tag === "li") return "\n" + (node.parentNode.tagName.toLowerCase() === "ol" ? "1. " : "- ") + body.trim();
        return /^(p|div|section|article|h[1-6]|ul|ol|figure|blockquote)$/.test(tag) ? "\n\n" + body + "\n\n" : body;
      }
      var result = Array.from(parsed.body.childNodes).map(convert).join("").replace(/[\t ]*\n[\t ]*/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
      codeBlocks.forEach(function (body, index) { result = result.split(codeMarker + index + "\uE001").join(body); });
      return result;
    }
    async function loadModules() {
      var entry = document.querySelector('script[type="module"][src*="/assets/index-"]');
      if (!entry) throw new Error("未找到 408 网站请求模块，请刷新后重试");
      var url = new URL(entry.src, category.url);
      if (url.origin !== startURL.origin) throw new Error("408 网站模块地址无效");
      var module = await importModule(url.href);
      request = module.r;
      if (!request || typeof request.get !== "function") throw new Error("408 网站请求模块已变化，请反馈插件适配");
      var entryText = await (await fetchResource(url.href)).text();
      if (knowledgeId && !target) {
        var knowledgeAssets = entryText.match(/\bknowledge-[\w-]+\.js\b/g) || [];
        var knowledgeTree;
        for (var assetIndex = 0; assetIndex < knowledgeAssets.length; assetIndex += 1) {
          if (knowledgeAssets.indexOf(knowledgeAssets[assetIndex]) !== assetIndex) continue;
          var knowledgeModule = await importModule(new URL(knowledgeAssets[assetIndex], url.href).href);
          if (Array.isArray(knowledgeModule.k)) { knowledgeTree = knowledgeModule.k; break; }
        }
        if (!knowledgeTree) throw new Error("未找到 408 知识点目录，请刷新后重试");
        var matchedPaths = [];
        function findKnowledgePath(nodes, ancestors, depth) {
          if (depth > 20) throw new Error("408 知识点目录层级无效");
          nodes.forEach(function (node) {
            if (!node || typeof node.name !== "string" || !node.name.trim()) throw new Error("408 知识点目录名称无效");
            var path = ancestors.concat(node.name.trim());
            if (Number(node.id) === knowledgeId) matchedPaths.push(path);
            if (Array.isArray(node.children)) findKnowledgePath(node.children, path, depth + 1);
          });
        }
        findKnowledgePath(knowledgeTree, [], 0);
        if (matchedPaths.length !== 1) throw new Error("无法唯一确定 408 知识点分类目录，请刷新后重试");
        category.path = matchedPaths[0];
        category.title = category.path[category.path.length - 1];
      }
      var asset = entryText.match(/\bwdQuestionContent-[\w-]+\.js\b/);
      if (asset) {
        var renderer = await importModule(new URL(asset[0], url.href).href);
        if (typeof renderer.r === "function") structuredRenderer = renderer.r;
      }
      var staticAsset = entryText.match(/\bstaticHtml-[\w-]+\.js\b/);
      if (staticAsset) {
        var staticModule = await importModule(new URL(staticAsset[0], url.href).href);
        if (typeof staticModule.d === "function") staticDecoder = staticModule.d;
      }
    }
    function getRows(response) {
      if (!response || !Array.isArray(response.rows)) throw new Error("408 分类题目列表格式无效");
      return response.rows;
    }
    function matchesTarget(row) {
      return row.question && Number(row.question.year) === target.year && Number(row.question.questionIndex) === target.number;
    }
    async function listQuestions() {
      var rows = [];
      if (knowledgeId || collectionMode) {
        var seen = new Set();
        var total = null;
        for (var page = 1; page <= 1000; page += 1) {
          var response = await request.get(collectionMode ? "/api/zt/collection/question/list-with-details" : "/api/zt/question/list-with-details-by-knowledge", {
            params: collectionMode ? { collectionId: collectionId, pageNum: page, pageSize: 47, sortType: "COLLECT_TIME_DESC" }
              : { knowledgePointId: knowledgeId, pageNum: page, pageSize: 47, sourcePage: startURL.searchParams.get("sourcePage") || undefined },
          });
          if (collectionMode && response && response.data && Array.isArray(response.data.rows)) response = response.data;
          if (!valid()) throw new Error("当前 408 分类已切换，导入停止");
          if (total === null) {
            total = Number(response.total);
            if (!Number.isSafeInteger(total) || total < 0 || total > 47000) throw new Error("408 分类题目总数无效");
          }
          var batch = getRows(response);
          if (total === 0) break;
          if (!batch.length) throw new Error("408 分类分页提前结束，已停止导入以免漏题");
          batch.forEach(function (item) {
            var id = Number(item.question && item.question.id);
            if (!Number.isSafeInteger(id) || id < 1 || seen.has(id)) throw new Error("408 分类分页包含无效或重复题目");
            seen.add(id);
            rows.push(item);
          });
          if (target && rows.some(matchesTarget)) break;
          if (rows.length >= total) break;
        }
        if (!target && rows.length !== total) throw new Error("408 分类题目数量不一致，请刷新后重试");
      } else {
        rows = await request.get("/api/zt/question/list-with-details", { params: { year: year } });
        if (!Array.isArray(rows)) throw new Error("408 年份题目列表格式无效");
      }
      if (target) {
        rows = rows.filter(matchesTarget);
        if (rows.length !== 1) throw new Error("无法唯一确定所点击的 408 题目，请刷新后重试");
      }
      var ids = rows.map(function (row) { return Number(row.question && row.question.id); });
      if (ids.some(function (id, index) { return !Number.isSafeInteger(id) || id < 1 || ids.indexOf(id) !== index; })) {
        throw new Error("408 题目列表包含无效或重复 ID");
      }
      state.rows = rows;
      var sources = {};
      rows.forEach(function (row) { sources[row.question.id] = sourceFor(row.question); });
      ready({ category: category, ids: ids, sources: sources });
    }
    function sourceFor(question) {
      return (question.year ? question.year + "年 " : "") + (question.questionIndex ? "第" + question.questionIndex + "题" : "题目 " + question.id);
    }
    async function prepareQuestion(index) {
      var question = state.rows[index] && state.rows[index].question;
      if (!question) throw new Error("408 题目不存在");
      state.stage = "读取题目内容";
      state.source = sourceFor(question);
      var parsed;
      var baseURL = category.url;
      if (question.contentJson) {
        if (!structuredRenderer) throw new Error("408 结构化题目模块不可用，请刷新后重试");
        var structured = structuredRenderer(question.contentJson);
        parsed = structured && structured.question;
        if (!parsed || typeof parsed.content !== "string" || !Array.isArray(parsed.options)) throw new Error("408 结构化题目格式无效");
      } else {
        var html = String(question.mdContent || "");
        if (html.startsWith("/static/")) {
          baseURL = new URL(html, category.url).href;
          html = await (await fetchResource(baseURL)).text();
          if (html.trim().startsWith("{")) {
            if (!staticDecoder) throw new Error("408 静态题目加载模块不可用，请刷新后重试");
            html = await staticDecoder(html, baseURL);
            if (!html || html.trim().startsWith("{")) throw new Error("408 静态题目内容无法读取");
          }
        }
        var doc = new DOMParser().parseFromString(html, "text/html");
        var styles = Array.from(doc.querySelectorAll("style")).filter(function (style) {
          return !style.closest("svg");
        }).map(function (style) { return style.outerHTML; }).join("\n");
        var options = Array.from(doc.querySelectorAll(".option")).map(function (option) {
          var label = option.querySelector(".opt-label");
          var content = option.querySelector(".opt-content");
          if (!label || !content) throw new Error("408 选项结构无法识别");
          var result = { label: label.textContent.trim().replace(/[.、]/g, ""), content: styles + content.innerHTML };
          option.remove();
          return result;
        });
        parsed = { content: styles + doc.body.innerHTML, options: options };
      }
      imageCache.clear();
      var stem = await markdown(parsed.content, baseURL);
      if (!stem) throw new Error("408 题干为空");
      var optionTexts = ["", "", "", ""];
      for (var i = 0; i < parsed.options.length; i += 1) {
        var option = parsed.options[i];
        var position = "ABCD".indexOf(option.label);
        if (position < 0 || optionTexts[position]) throw new Error("408 选项标签无法识别");
        optionTexts[position] = await markdown(option.content, baseURL);
      }
      var source = sourceFor(question);
      var result = { id: Number(question.id), source: source, stem: stem, options: optionTexts,
        hasBase64Image: /data:image\/[^\s)]+;base64,/i.test([stem].concat(optionTexts).join("\n")) };
      if (JSON.stringify(result).length > 32 * 1024 * 1024) throw new Error("此题图片总量过大，请单独处理");
      state.stage = "传输题目";
      return { question: result, diagnostics: state.diagnostics };
    }
    state.read = function (key) {
      if (key !== token || !valid()) return JSON.stringify({ error: "当前 408 分类已切换，导入停止" });
      return JSON.stringify({ error: state.error, ready: state.ready, length: state.payload.length,
        stage: state.stage, source: state.source, diagnostics: state.diagnostics,
        resource: state.resources.length ? state.resources[0].url : "" });
    };
    state.resourceStart = function (key, type) {
      if (key !== token || !valid() || !state.resources.length) return false;
      state.resources[0].type = type;
      state.diagnostics.imageKind = type;
      return true;
    };
    state.resourceAppend = function (key, chunk) {
      if (key !== token || !valid() || !state.resources.length) return false;
      state.resources[0].chunks.push(chunk);
      return true;
    };
    state.resourceFinish = function (key, error) {
      if (key !== token || !valid() || !state.resources.length) return false;
      var resource = state.resources.shift();
      if (error) resource.reject(new Error(error));
      else {
        try {
          var binary = atob(resource.chunks.join(""));
          var bytes = new Uint8Array(binary.length);
          for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
          resource.resolve(new Blob([bytes], { type: resource.type }));
        } catch (failure) { resource.reject(failure); }
      }
      return true;
    };
    state.chunk = function (key, offset) {
      if (key !== token || !valid() || !state.ready) throw new Error("408 题目传输已中断");
      return state.payload.slice(offset, offset + 65536);
    };
    state.prepare = function (key, index) {
      if (key !== token || !valid()) return false;
      clearResources();
      state.payload = "";
      state.error = "";
      state.ready = false;
      state.diagnostics = {};
      var sequence = ++state.sequence;
      timed(prepareQuestion(index), "408 题目读取或图片转换超时").then(function (result) {
        if (sequence === state.sequence) ready(result);
      }, function (error) { if (sequence === state.sequence) fail(error); });
      return true;
    };
    state.cancel = function (key) {
      if (key !== token) return false;
      clearResources();
      state.rows = [];
      state.payload = "";
      imageCache.clear();
      window.__DAGUANYUAN_408_IMPORT_PAGE__ = null;
      return true;
    };
    timed(loadModules().then(listQuestions), "408 分类读取超时，请刷新后重试").catch(fail);
    return true;
  }

  function pageScript(token, target) {
    return "String((" + pageReceiver.toString() + ")(" + JSON.stringify(token) + "," + JSON.stringify(target || null) + "))";
  }
  return { pageScript };
})();
