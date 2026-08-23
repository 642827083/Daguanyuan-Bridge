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
      function selectedCategoryPath() {
        var toggle = document.querySelector('button[aria-label="切换章节"]');
        var wasExpanded = toggle && toggle.getAttribute("aria-expanded") === "true";
        if (toggle && !wasExpanded) toggle.click();
        var groups = Array.prototype.slice.call(document.querySelectorAll('[role="tree"] [role="group"]'));
        var labels = groups.map(function (group) {
          var selected = group.querySelector('[role="treeitem"][aria-selected="true"]');
          var expanded = group.querySelector('[role="treeitem"][aria-expanded="true"]');
          return text(selected || expanded);
        }).filter(Boolean);
        if (toggle && !wasExpanded) toggle.click();
        return labels;
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
        var questions = cards.map(function (card) {
          var questionDocument = card.querySelector("[data-question-id]");
          var sourceNode = card.querySelector("header [title]");
          var stem = questionDocument && questionDocument.querySelector(".question-stem");
          var options = questionDocument && questionDocument.querySelector(".question-options");
          return {
            questionId: questionDocument ? questionDocument.getAttribute("data-question-id") : "",
            source: sourceNode ? sourceNode.getAttribute("title") || "" : "",
            stemText: "",
            tex: "",
            markdown: questionMarkdown(stem, options && options.children),
            url: questionURL(questionDocument && questionDocument.getAttribute("data-question-id")),
          };
        }).filter(function (item) { return item.questionId; });
        return {
          provider: "daguanyuan",
          practiceId: practiceId,
          categoryId: categoryId,
          categoryPath: selectedCategoryPath(),
          url: window.location.href,
          questions: questions,
        };
      }
      function collect408() {
        var knowledgeId = queryParam("knowledgeId");
        var knowledgeName = queryParam("knowledgeName");
        var cards = Array.prototype.slice.call(document.querySelectorAll(".question-wrapper[data-question-id]"));
        var captured = cards.map(function (card) {
          var questionCard = card.querySelector(".question-card") || card;
          var content = questionCard.querySelector(".question-content");
          var stem = content && (content.querySelector(".content") || content);
          var year = text(questionCard.querySelector(".year-tag"));
          var index = text(questionCard.querySelector(".index-tag"));
          return {
            questionId: card.getAttribute("data-question-id") || "",
            source: [year, index].filter(Boolean).join(" "),
            markdown: questionMarkdown(stem, questionCard.querySelectorAll(".option-card"), ".option-label", ".option-content"),
          };
        }).filter(function (item) { return item.questionId; });
        var questions = captured.filter(function (item) { return item.markdown; });
        return {
          provider: "408os",
          categoryId: knowledgeId,
          categoryPath: os408CategoryPath(knowledgeName),
          unavailableQuestionCount: captured.length - questions.length,
          questions: questions,
        };
      }
      var host = String(window.location.host || "");
      if (host.indexOf("408os.cn") >= 0) return JSON.stringify(collect408());
      if (host.indexOf("cxyonly.fans") >= 0) return JSON.stringify(collectDaguanyuan());
      throw new Error("请在大观园数学或 408 真题系统的练习页面导入");
    })()`;
  }

  return { collectionScript };
})();
