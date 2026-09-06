var __DAGUANYUAN_PAGE_COLLECTOR_GLOBAL__ = (function () {

  function collectionScript() {
    return `(function () {
      function text(node) {
        var raw = node && (node.innerText || node.textContent);
        var value = raw ? String(raw).replace(/\\s+/g, " ").trim() : "";
        var previous = "";
        while (previous !== value) {
          previous = value;
          value = value.replace(/([\\u3400-\\u9fff])\\s+(?=[\\u3400-\\u9fff])/g, "$1");
        }
        return value.replace(/\\s*\\(/g, "(").replace(/\\(\\s*/g, "(").replace(/\\s*\\)/g, ")");
      }
      function className(node) {
        return node && typeof node.className === "string" ? node.className : "";
      }
      function tex(node) {
        var annotation = node && node.querySelector && node.querySelector('annotation[encoding="application/x-tex"]');
        return annotation && annotation.textContent ? String(annotation.textContent).trim() : "";
      }
      function childNodes(node) {
        return Array.prototype.slice.call(node && node.childNodes || []);
      }
      function isMathNode(node) {
        var tag = String(node && node.tagName || "").toUpperCase();
        return tag === "MATH" || className(node).indexOf("katex") >= 0;
      }
      function imageMarkdown(node) {
        var source = String(node && (node.currentSrc || node.src || node.getAttribute("src")) || "").trim();
        if (source.indexOf("http://") !== 0 && source.indexOf("https://") !== 0) return "";
        var alt = String(node.getAttribute("alt") || "题图").split("[").join("").split("]").join("").trim() || "题图";
        var escapedSource = source.split("(").join("%28").split(")").join("%29");
        return "![" + alt + "](" + escapedSource + ")";
      }
      function inlineMarkdown(node) {
        if (!node) return "";
        if (node.nodeType === 3) return String(node.nodeValue || "").replace(/\\s+/g, " ");
        if (node.nodeType !== 1) return "";
        if (node.getAttribute && node.getAttribute("aria-hidden") === "true") return "";
        if (String(node.tagName || "").toUpperCase() === "IMG") return imageMarkdown(node);
        if (isMathNode(node)) {
          var inlineTex = tex(node);
          return inlineTex ? "$" + inlineTex + "$" : "";
        }
        if (String(node.tagName || "").toUpperCase() === "BR") return "\\n";
        return childNodes(node).map(inlineMarkdown).join("");
      }
      function markdownBlocks(node) {
        return childNodes(node).map(function (child) {
          if (child && child.nodeType === 1 && className(child).indexOf("katex-display") >= 0) {
            var displayTex = tex(child);
            return displayTex ? "$$\\n" + displayTex + "\\n$$" : "";
          }
          return text({ textContent: inlineMarkdown(child) });
        }).filter(Boolean);
      }
      function questionMarkdown(stem, options, labelSelector, contentSelector) {
        var blocks = markdownBlocks(stem);
        var optionLines = Array.prototype.slice.call(options || []).map(function (option) {
          var label = text(option.querySelector(labelSelector || ".question-option-label"));
          var content = text({ textContent: inlineMarkdown(option.querySelector(contentSelector || ".question-option-content")) });
          return label && content ? "- " + label + ". " + content : "";
        }).filter(Boolean);
        if (optionLines.length) blocks.push(optionLines.join("\\n"));
        return blocks.join("\\n\\n");
      }
      function questionHTMLSize(card, optionCount) {
        var contentLength = text(card).length;
        var imageCount = card && card.querySelectorAll ? card.querySelectorAll("img").length : 0;
        var formulaCount = card && card.querySelectorAll ? card.querySelectorAll(".katex").length : 0;
        var textRows = Math.max(1, Math.ceil(contentLength / 34));
        var height = 56 + textRows * 30 + formulaCount * 64 + Number(optionCount || 0) * 72 + imageCount * 300;
        return {
          width: 960,
          height: Math.max(220, Math.min(2400, Math.ceil(height))),
        };
      }
      function inlineStyle(source, target) {
        if (!source || !target || typeof window.getComputedStyle !== "function") return;
        var computed = window.getComputedStyle(source);
        if (!computed) return;
        var properties = [
          "display", "box-sizing", "color", "font-weight", "font-style", "line-height",
          "text-align", "text-decoration", "vertical-align", "white-space", "word-break",
          "overflow-wrap", "list-style", "list-style-position",
        ];
        var declarations = properties.map(function (property) {
          var value = computed.getPropertyValue ? computed.getPropertyValue(property) : computed[property];
          return value ? property + ":" + value : "";
        }).filter(Boolean);
        if (declarations.length) target.setAttribute("style", declarations.join(";"));
      }
      function compactHTML(source) {
        if (!source || typeof source.cloneNode !== "function") return "";
        var clone = source.cloneNode(true);
        var sourceNodes = [source].concat(Array.prototype.slice.call(source.querySelectorAll ? source.querySelectorAll("*") : []));
        var cloneNodes = [clone].concat(Array.prototype.slice.call(clone.querySelectorAll ? clone.querySelectorAll("*") : []));
        for (var index = 0; index < sourceNodes.length && index < cloneNodes.length; index += 1) {
          inlineStyle(sourceNodes[index], cloneNodes[index]);
          var tag = String(cloneNodes[index].tagName || "").toUpperCase();
          if (tag === "IMG") {
            var imageURL = String(sourceNodes[index].currentSrc || sourceNodes[index].src || sourceNodes[index].getAttribute("data-src") || "").trim();
            if (imageURL) {
              cloneNodes[index].setAttribute("src", imageURL);
              cloneNodes[index].setAttribute("style", "display:block;max-width:100%;height:auto;margin:12px auto;object-fit:contain;");
            }
          }
          if (cloneNodes[index].attributes) {
            for (var attributeIndex = cloneNodes[index].attributes.length - 1; attributeIndex >= 0; attributeIndex -= 1) {
              var attributeName = String(cloneNodes[index].attributes[attributeIndex].name || "").toLowerCase();
              if (attributeName.indexOf("on") === 0) cloneNodes[index].removeAttribute(attributeName);
            }
          }
        }
        var unsafe = clone.querySelectorAll ? clone.querySelectorAll("script,style,button,input,textarea,select,header,.year-tag,.index-tag,.question-actions") : [];
        Array.prototype.slice.call(unsafe).forEach(function (node) {
          if (!node) return;
          if (typeof node.remove === "function") node.remove();
          else if (node.parentNode && typeof node.parentNode.removeChild === "function") node.parentNode.removeChild(node);
        });
        // KaTeX 同时保存无障碍 MathML 与可见公式层，导入时仅保留可见层，避免脱离原网页样式后重复显示。
        var accessibilityMath = clone.querySelectorAll ? clone.querySelectorAll(".katex-mathml") : [];
        Array.prototype.slice.call(accessibilityMath).forEach(function (node) {
          if (!node) return;
          if (typeof node.remove === "function") node.remove();
          else if (node.parentNode && node.parentNode.removeChild) node.parentNode.removeChild(node);
        });
        var mathNodes = clone.querySelectorAll ? clone.querySelectorAll(".katex,.katex-html,.katex-display") : [];
        Array.prototype.slice.call(mathNodes).forEach(function (node) {
          if (!node || !node.setAttribute) return;
          var legacyTag = String(node.className || "").indexOf("katex-display") >= 0 ? "display:block;" : "display:inline-block;";
          node.setAttribute("style", legacyTag + "transform:none;max-width:100%;font-size:1.16em;line-height:1.45;white-space:normal;");
        });
        return String(clone.innerHTML || clone.outerHTML || "").trim();
      }
      function escapeHTML(value) {
        return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      }
      function simplifiedQuestionHTML(stem, options, labelSelector, contentSelector) {
        var stemHTML = compactHTML(stem);
        var optionHTML = Array.prototype.slice.call(options || []).map(function (option) {
          var label = text(option.querySelector(labelSelector));
          var content = compactHTML(option.querySelector(contentSelector) || option);
          if (!label && !content) return "";
          return '<div style="display:flex;align-items:flex-start;gap:12px;margin:12px 0;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#f8fafc;box-sizing:border-box;width:100%;">' +
            '<span style="display:inline-block;flex:0 0 auto;min-width:28px;padding:2px 7px;border-radius:6px;background:#10b981;color:#ffffff;font-weight:700;text-align:center;box-sizing:border-box;">' + escapeHTML(label) + "</span>" +
            '<div style="flex:1;min-width:0;color:#1f2937;line-height:1.7;overflow-wrap:anywhere;">' + content + "</div></div>";
        }).filter(Boolean).join("");
        if (!stemHTML && !optionHTML) return "";
        return '<div style="box-sizing:border-box;width:100%;max-width:100%;padding:16px 18px;background:#ffffff;color:#1f2937;font-size:18px;line-height:1.75;word-break:break-word;overflow-wrap:anywhere;">' +
          '<div style="margin:0 0 14px 0;width:100%;">' + stemHTML + "</div>" + optionHTML + "</div>";
      }
      function selectedCategoryPath() {
        var groups = Array.prototype.slice.call(document.querySelectorAll('[role="tree"] [role="group"]'));
        var labels = groups.map(function (group) {
          var selectors = [
            '[role="treeitem"][aria-selected="true"]',
            '[role="treeitem"][data-active="true"]',
            '[role="treeitem"][aria-expanded="true"]',
          ];
          var item = null;
          for (var index = 0; index < selectors.length && !item; index += 1) {
            item = group.querySelector(selectors[index]);
          }
          var title = item && item.getAttribute ? String(item.getAttribute("title") || "").trim() : "";
          return title || text(item);
        }).filter(Boolean);
        return labels;
      }
      function renderState(cards, questions) {
        var roots = Array.prototype.slice.call(cards || []);
        var images = [];
        var formulas = [];
        roots.forEach(function (card) {
          images = images.concat(Array.prototype.slice.call(card && card.querySelectorAll ? card.querySelectorAll("img") : []));
          formulas = formulas.concat(Array.prototype.slice.call(card && card.querySelectorAll ? card.querySelectorAll(".katex") : []));
        });
        return {
          expectedQuestionCount: roots.length,
          completeQuestionCount: Array.prototype.slice.call(questions || []).length,
          pendingImageCount: images.filter(function (image) { return image && image.complete === false; }).length,
          brokenImageCount: images.filter(function (image) { return image && image.complete === true && Number(image.naturalWidth || 0) === 0; }).length,
          pendingFormulaCount: formulas.filter(function (formula) {
            return formula && formula.querySelector && !formula.querySelector(".katex-html");
          }).length,
        };
      }
      function queryParam(name) {
        var match = String(window.location.search || "").match(new RegExp("(?:^|[?&])" + name + "=([^&]+)"));
        var value = match ? String(match[1]).replace(/\\+/g, " ") : "";
        for (var index = 0; index < 2; index += 1) {
          try {
            var decoded = decodeURIComponent(value);
            if (decoded === value) break;
            value = decoded;
          } catch (error) {
            break;
          }
        }
        return value;
      }
      function queryParameterName(part) {
        var rawName = String(part || "").split("=")[0].replace(/\\+/g, " ");
        try { return decodeURIComponent(rawName); } catch (error) { return rawName; }
      }
      function questionURL(questionId) {
        var href = String(window.location.href || "");
        if (!href || !questionId) return "";
        var hashIndex = href.indexOf("#");
        var hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
        var base = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
        var queryIndex = base.indexOf("?");
        var path = queryIndex >= 0 ? base.slice(0, queryIndex) : base;
        var query = queryIndex >= 0 ? base.slice(queryIndex + 1) : "";
        var parts = query ? query.split("&").filter(function (part) {
          return queryParameterName(part) !== "questionId";
        }) : [];
        parts.push("questionId=" + encodeURIComponent(String(questionId)));
        return path + "?" + parts.join("&") + hash;
      }
      function questionDocumentForCard(card) {
        if (!card) return null;
        var ownId = card.getAttribute && card.getAttribute("data-question-id");
        return ownId ? card : (card.querySelector ? card.querySelector("[data-question-id]") : null);
      }
      function questionSourceNode(card, questionDocument) {
        var local = questionDocument && questionDocument.querySelector
          ? questionDocument.querySelector("header [title]")
          : null;
        return local || (card && card.querySelector ? card.querySelector("header [title]") : null);
      }
      function os408CategoryPath(knowledgeName) {
        var subjects = {
          "数据结构": ["算法", "线性表", "栈和队列", "数组和特殊矩阵", "串", "树与二叉树", "图", "查找", "排序"],
          "计算机组成原理": ["计算机系统概述", "数据的机器表示", "存储系统", "指令系统", "中央处理器", "总线", "IO系统"],
          "操作系统": ["操作系统概述", "进程管理", "内存管理", "文件管理", "输入/输出"],
          "计算机网络": ["计算机网络体系结构", "物理层", "数据链路层", "网络层", "传输层", "应用层"],
        };
        var subjectNames = Object.keys(subjects);
        for (var index = 0; index < subjectNames.length; index += 1) {
          var subject = subjectNames[index];
          if (knowledgeName === subject) return [subject];
          if (subjects[subject].indexOf(knowledgeName) >= 0) return [subject, knowledgeName];
        }
        return knowledgeName ? [knowledgeName] : [];
      }
      function collectDaguanyuan() {
        var pathParts = String(window.location.pathname || "").split("/").filter(Boolean);
        var practiceId = pathParts[pathParts.length - 1] || "";
        var categoryId = queryParam("resumeCategoryId");
        var cards = Array.prototype.slice.call(document.querySelectorAll("[data-learning-question-card]"));
        var captured = cards.map(function (card) {
          var questionDocument = questionDocumentForCard(card);
          var sourceNode = questionSourceNode(card, questionDocument);
          var stem = questionDocument && questionDocument.querySelector(".question-stem");
          var options = questionDocument && questionDocument.querySelector(".question-options");
          var optionNodes = options && options.children;
          var item = {
            questionId: questionDocument ? questionDocument.getAttribute("data-question-id") : "",
            source: sourceNode ? sourceNode.getAttribute("title") || "" : "",
            stemText: "",
            tex: "",
            markdown: questionMarkdown(stem, optionNodes),
            url: questionURL(questionDocument && questionDocument.getAttribute("data-question-id")),
          };
          return item;
        });
        var questions = captured.filter(function (item) { return item.questionId && item.markdown; });
        var relativePath = selectedCategoryPath();
        return {
          provider: "daguanyuan",
          practiceId: practiceId,
          categoryId: categoryId,
          categoryPath: relativePath,
          fullCategoryPath: [],
          url: window.location.href,
          unavailableQuestionCount: captured.length - questions.length,
          renderState: renderState(cards, questions),
          questions: questions,
        };
      }
      function collect408() {
        var knowledgeId = queryParam("knowledgeId");
        var knowledgeName = queryParam("knowledgeName");
        var cards = Array.prototype.slice.call(document.querySelectorAll(".question-wrapper[data-question-id]"));
        function renderedQuestionHTML(questionCard) {
          var content = questionCard && questionCard.querySelector(".question-content");
          var stem = content && (content.querySelector(".content") || content);
          return simplifiedQuestionHTML(stem, questionCard && questionCard.querySelectorAll ? questionCard.querySelectorAll(".option-card") : [], ".option-label", ".option-content");
        }
        function questionPayload(card) {
          var questionCard = card.querySelector(".question-card") || card;
          var content = questionCard.querySelector(".question-content");
          var stem = content && (content.querySelector(".content") || content);
          var year = text(questionCard.querySelector(".year-tag"));
          var index = text(questionCard.querySelector(".index-tag"));
          var item = {
            questionId: card.getAttribute("data-question-id") || "",
            source: [year, index].filter(Boolean).join(" "),
            markdown: questionMarkdown(stem, questionCard.querySelectorAll(".option-card"), ".option-label", ".option-content"),
            url: window.location.href,
          };
          var html = renderedQuestionHTML(questionCard);
          if (html) {
            item.html = html;
            item.htmlSize = questionHTMLSize(questionCard, questionCard.querySelectorAll(".option-card").length);
          }
          return item;
        }
        var captured = cards.map(questionPayload);
        var questions = captured.filter(function (item) { return item.questionId && (item.markdown || item.html); });
        return {
          provider: "408os",
          categoryId: knowledgeId,
          categoryPath: os408CategoryPath(knowledgeName),
          fullCategoryPath: os408CategoryPath(knowledgeName),
          unavailableQuestionCount: captured.length - questions.length,
          url: window.location.href,
          renderState: renderState(cards, questions),
          questions: questions,
        };
      }
      var host = String(window.location.host || "");
      if (host.indexOf("408os.cn") >= 0) return JSON.stringify(collect408());
      if (host.indexOf("cxyonly.fans") >= 0) return JSON.stringify(collectDaguanyuan());
      throw new Error("请在大观园数学或 408 真题系统的练习页面导入");
    })()`;
  }

  function preloadScript() {
    return `(function () {
      var stateKey = "__DAGUANYUAN_IMPORT_PRELOAD_STATE__";
      if (window[stateKey] && window[stateKey].running) return JSON.stringify(window[stateKey]);
      var state = { running: true, loadMoreClickCount: 0, passCount: 0 };
      window[stateKey] = state;
      var originalY = Number(window.scrollY || 0);
      function cards() {
        var host = String(location.hostname || "");
        var selector = host.indexOf("408os.cn") >= 0 ? ".question-wrapper[data-question-id]" : "[data-learning-question-card]";
        return Array.prototype.slice.call(document.querySelectorAll(selector));
      }
      function eagerImages() {
        Array.prototype.slice.call(document.querySelectorAll("img")).forEach(function (image) {
          var deferred = image.getAttribute("data-src") || image.getAttribute("data-original");
          if (deferred && !image.getAttribute("src")) image.setAttribute("src", deferred);
          image.setAttribute("loading", "eager");
        });
      }
      function loadMoreButton() {
        var buttons = Array.prototype.slice.call(document.querySelectorAll("button"));
        for (var index = 0; index < buttons.length; index += 1) {
          var button = buttons[index];
          var label = String(button.innerText || button.textContent || "").replace(/\\s+/g, "").trim();
          if (label.indexOf("加载更多题目") >= 0 || label === "加载更多") return button;
        }
        return null;
      }
      function finish() {
        eagerImages();
        var items = cards();
        items.forEach(function (card) {
          if (card && typeof card.scrollIntoView === "function") card.scrollIntoView({ block: "center", inline: "nearest" });
        });
        window.scrollTo(0, originalY);
        setTimeout(function () {
          state.running = false;
          state.cardCount = cards().length;
        }, 650);
      }
      function step() {
        state.passCount += 1;
        eagerImages();
        var button = loadMoreButton();
        if (button && state.passCount <= 18) {
          if (!button.disabled && button.getAttribute("aria-disabled") !== "true") {
            button.click();
            state.loadMoreClickCount += 1;
          }
          if (typeof button.scrollIntoView === "function") button.scrollIntoView({ block: "center", inline: "nearest" });
          setTimeout(step, 450);
          return;
        }
        finish();
      }
      step();
      return JSON.stringify(state);
    })();`;
  }

  function preloadStatusScript() {
    return `(function () {
      var state = window.__DAGUANYUAN_IMPORT_PRELOAD_STATE__ || { running: false, cardCount: 0, loadMoreClickCount: 0 };
      return JSON.stringify(state);
    })();`;
  }

  function prepareCategoryMenuScript() {
    return `(function () {
      var host = String(window.location && (window.location.hostname || window.location.host) || "");
      if (host.indexOf("cxyonly.fans") < 0) return JSON.stringify({ openedByPlugin: false, ready: true });
      var toggle = document.querySelector('button[aria-label="切换章节"]') || document.querySelector('button[aria-haspopup="tree"]');
      var wasExpanded = toggle && toggle.getAttribute("aria-expanded") === "true";
      var openedByPlugin = Boolean(window.__DAGUANYUAN_IMPORT_OPENED_CATEGORY_MENU__);
      if (toggle && !wasExpanded && !openedByPlugin && typeof toggle.click === "function") {
        toggle.click();
        openedByPlugin = true;
        window.__DAGUANYUAN_IMPORT_OPENED_CATEGORY_MENU__ = true;
      }
      var groups = document.querySelectorAll('[role="tree"] [role="group"]');
      return JSON.stringify({ openedByPlugin: openedByPlugin, ready: Array.prototype.slice.call(groups || []).length > 0 });
    })();`;
  }

  function restoreCategoryMenuScript() {
    return `(function () {
      var toggle = document.querySelector('button[aria-label="切换章节"]') || document.querySelector('button[aria-haspopup="tree"]');
      var openedByPlugin = Boolean(window.__DAGUANYUAN_IMPORT_OPENED_CATEGORY_MENU__);
      window.__DAGUANYUAN_IMPORT_OPENED_CATEGORY_MENU__ = false;
      if (toggle && openedByPlugin && toggle.getAttribute("aria-expanded") === "true" && typeof toggle.click === "function") toggle.click();
      return "";
    })();`;
  }

  function categoryNavigationScript(categoryPath) {
    const labels = Array.isArray(categoryPath) ? categoryPath.map(function (item) {
      return String(item || "").trim();
    }).filter(Boolean) : [];
    return `(function () {
      if (String(window.location && window.location.hostname || "").indexOf("cxyonly.fans") < 0) return false;
      var rawWantedPath = ${JSON.stringify(labels)};
      // 网页菜单会把复合分类拆成连续的两个层级，导航时同步展开目标路径。
      var wantedPath = [];
      rawWantedPath.forEach(function (label) {
        if (label === "0/0" || label === "∞/∞") {
          wantedPath.push(label.charAt(0), label.charAt(0));
        } else {
          wantedPath.push(label);
        }
      });
      var stateKey = "__DAGUANYUAN_CATEGORY_NAVIGATION_STATE__";
      function clean(value) {
        return String(value || "")
          .replace(/[\\s\\u3000]+/g, "")
          .replace(/[（(]/g, "(")
          .replace(/[）)]/g, ")")
          .replace(/[：:]/g, ":")
          .replace(/[➖−﹣－]/g, "-")
          .replace(/[✖×]/g, "x")
          .toLowerCase();
      }
      function labelOf(node) {
        if (!node) return "";
        var label = node.querySelector ? node.querySelector("[title]") : null;
        return String(label && (label.getAttribute("title") || label.textContent) || node.innerText || node.textContent || "").trim();
      }
      function matches(node, wanted) {
        var actual = clean(labelOf(node));
        var target = clean(wanted);
        if (!actual || !target || actual === target) return actual === target;
        var aliases = {
          "0x∞": ["0✖∞", "0✖ ∞", "0×∞"],
          "∞-∞": ["∞➖∞", "∞−∞"],
        };
        var choices = [target].concat(aliases[target] || []).map(clean);
        return choices.indexOf(actual) >= 0;
      }
      function depthOf(node) {
        var value = node && node.getAttribute ? Number(node.getAttribute("data-category-filter-depth")) : 0;
        return Number.isFinite(value) ? value : 0;
      }
      function treeItems() {
        return Array.prototype.slice.call(document.querySelectorAll('[role="treeitem"]'));
      }
      function schedule(state) {
        window[stateKey] = state;
        setTimeout(step, 180);
      }
      function step() {
        var state = window[stateKey];
        if (!state) return true;
        var toggle = document.querySelector('button[aria-label="切换章节"]') || document.querySelector('button[aria-haspopup="tree"]');
        if (toggle && toggle.getAttribute("aria-expanded") !== "true" && typeof toggle.click === "function") {
          toggle.click();
          schedule(state);
          return false;
        }
        var items = treeItems();
        if (!items.length) {
          state.waitCount += 1;
          if (state.waitCount > 30) { window[stateKey] = null; return false; }
          schedule(state);
          return false;
        }
        while (state.index < wantedPath.length) {
          var wanted = wantedPath[state.index];
          var candidates = items.filter(function (item) {
            return depthOf(item) >= state.minDepth && matches(item, wanted);
          });
          if (!candidates.length) candidates = items.filter(function (item) { return matches(item, wanted); });
          if (!candidates.length) {
            state.index += 1;
            continue;
          }
          var target = candidates[0];
          var depth = depthOf(target);
          if (typeof target.click !== "function") {
            state.index += 1;
            continue;
          }
          target.click();
          state.index += 1;
          state.minDepth = depth + 1;
          state.waitCount = 0;
          schedule(state);
          return false;
        }
        window[stateKey] = null;
        return true;
      }
      window[stateKey] = { index: 0, minDepth: 0, waitCount: 0 };
      return step();
    })();`;
  }

  function pageStatusScript() {
    return `(function () {
      function clean(value) { return String(value || "").replace(/\\s+/g, " ").trim(); }
      function query(name) {
        var match = String(location.search || "").match(new RegExp("(?:^|[?&])" + name + "=([^&]+)"));
        if (!match) return "";
        try { return decodeURIComponent(String(match[1]).replace(/\\+/g, " ")); } catch (error) { return String(match[1]); }
      }
      var host = String(location.hostname || "");
      if (host.indexOf("cxyonly.fans") >= 0) {
        var path = String(location.pathname || "");
        var practice = path.match(/^\\/math\\/practice\\/(\\d+)/);
        var toggle = document.querySelector('button[aria-label="切换章节"]');
        return JSON.stringify({
          provider: "daguanyuan",
          importable: Boolean(practice && query("resumeCategoryId")),
          practiceId: practice ? practice[1] : "",
          categoryId: query("resumeCategoryId"),
          categoryLabel: clean(toggle && (toggle.innerText || toggle.textContent)),
          questionId: query("questionId"),
          url: location.href,
        });
      }
      if (host.indexOf("408os.cn") >= 0) {
        var knowledgeName = query("knowledgeName");
        for (var index = 0; index < 2; index += 1) {
          try {
            var decoded = decodeURIComponent(knowledgeName);
            if (decoded === knowledgeName) break;
            knowledgeName = decoded;
          } catch (error) { break; }
        }
        return JSON.stringify({
          provider: "408os",
          importable: /^\\/exercise(?:\\/|$)/.test(String(location.pathname || "")) && Boolean(query("knowledgeId")),
          categoryId: query("knowledgeId"),
          categoryLabel: clean(knowledgeName),
          url: location.href,
        });
      }
      return JSON.stringify({ provider: "", importable: false, categoryLabel: "", url: location.href });
    })();`;
  }

  return { categoryNavigationScript, collectionScript, pageStatusScript, preloadScript, preloadStatusScript, prepareCategoryMenuScript, restoreCategoryMenuScript };
})();
