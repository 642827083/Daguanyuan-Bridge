import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function createNativeRuntime() {
  const notebook = { topicId: "topic-1", notes: [] };
  const document = { documentId: "document-1" };
  const refreshes = [];

  function createNote(title) {
    const note = {
      noteTitle: title,
      childNotes: [],
      comments: [],
      appendMarkdownComment(text) {
        this.comments.push({ text });
      },
      appendHtmlComment(html, text, size, tag) {
        this.comments.push({ html, text, size, tag });
      },
      addChild(child) {
        const rootIndex = notebook.notes.indexOf(child);
        if (rootIndex >= 0) notebook.notes.splice(rootIndex, 1);
        if (child.parentNote) {
          const siblingIndex = child.parentNote.childNotes.indexOf(child);
          if (siblingIndex >= 0) child.parentNote.childNotes.splice(siblingIndex, 1);
        }
        child.parentNote = this;
        this.childNotes.push(child);
      },
      removeFromParent() {
        if (!this.parentNote) return;
        const index = this.parentNote.childNotes.indexOf(this);
        if (index >= 0) this.parentNote.childNotes.splice(index, 1);
        this.parentNote = undefined;
      },
      removeCommentByIndex(index) {
        this.comments.splice(index, 1);
      },
      allNoteText() {
        return [this.noteTitle, ...this.comments.map((comment) => comment.text)].join("\n");
      },
    };
    notebook.notes.push(note);
    return note;
  }

  return {
    notebook,
    document,
    refreshes,
    context: {
      Application: {
        sharedInstance() {
          return {
            studyController() {
              return {
                notebookController: { notebookId: "topic-1" },
                readerController: { currentDocumentController: { document } },
              };
            },
            refreshAfterDBChanged(topicId) {
              refreshes.push(topicId);
            },
          };
        },
      },
      Database: {
        sharedInstance() {
          return { getNotebookById() { return notebook; } };
        },
      },
      Note: { createWithTitleNotebookDocument(title) { return createNote(title); } },
      UndoManager: {
        sharedInstance() {
          return { undoGrouping(name, topicId, block) { block(); } };
        },
      },
    },
  };
}

function loadImporter(runtime) {
  const source = readFileSync(new URL("../src/DaguanyuanImport.js", import.meta.url), "utf8");
  vm.createContext(runtime.context);
  vm.runInContext(source, runtime.context);
  return runtime.context.__DAGUANYUAN_PRACTICE_IMPORT_GLOBAL__;
}

const payload = {
  practiceId: "321",
  categoryId: "708",
  categoryPath: ["函数", "函数性质考察", "有界"],
  questions: [{
    questionId: "3592",
    source: "2002数二",
    stemText: "设函数 f(x) 连续，则下列函数中必为偶函数的是（）。 A. 选项一 B. 选项二",
    tex: "f(x)\\n\\int_0^x f(t)dt",
    markdown: "设函数 $f(x)$ 连续。\n\n$$\\int_0^x f(t)dt$$\n\n- A. 选项一\n- B. 选项二",
    url: "https://cxyonly.fans/math/questions/3592",
  }],
};

function titlesFromRoot(root) {
  const titles = [];
  let current = root;
  while (current) {
    titles.push(current.noteTitle);
    current = current.childNotes[0];
  }
  return titles;
}

test("导入题卡仅显示题目来源并隐藏题目编号", () => {
  const runtime = createNativeRuntime();
  const importer = loadImporter(runtime);
  const result = importer.importCurrentPractice({ window: {} }, payload);
  const root = runtime.notebook.notes[0];
  const category = root.childNotes[0].childNotes[0].childNotes[0].childNotes[0].childNotes[0];
  const question = category.childNotes[0];

  assert.equal(result.createdCount, 1);
  assert.equal(question.noteTitle, "2002数二");
  assert.match(question.comments[0].text, /设函数 \$f\(x\)\$ 连续/);
  assert.match(question.comments[0].text, /\$\$\\int_0\^x f\(t\)dt\$\$\n<br>/);
  assert.match(question.comments[0].text,
    /<!-- DAGUANYUAN_QUESTION_ID:3592 -->/);
  assert.match(question.comments[0].text,
    /<!-- DAGUANYUAN_URL:https:\/\/cxyonly\.fans\/math\/questions\/3592 -->/);
  assert.doesNotMatch(question.comments[0].text, /\[查看原题\]/);
  assert.doesNotMatch(root.allNoteText(), /DAGUANYUAN_/);
  assert.deepEqual(runtime.refreshes, ["topic-1"]);
});

test("题库未提供来源时题卡标题保持为空", () => {
  const runtime = createNativeRuntime();
  const importer = loadImporter(runtime);
  importer.importCurrentPractice({ window: {} }, {
    practiceId: "321",
    categoryId: "709",
    categoryPath: ["函数", "其他"],
    questions: [{ questionId: "3593", markdown: "题干", url: "https://cxyonly.fans/math/questions/3593" }],
  });

  const question = runtime.notebook.notes[0].childNotes[0].childNotes[0].childNotes[0].childNotes[0].childNotes[0];
  assert.equal(question.noteTitle, "");
  assert.match(question.comments[0].text, /DAGUANYUAN_QUESTION_ID:3593/);
});

test("没有当前元数据的旧题卡不自动迁移", () => {
  const runtime = createNativeRuntime();
  const root = runtime.context.Note.createWithTitleNotebookDocument("Daguanyuan Bridge");
  root.appendMarkdownComment("<!-- DAGUANYUAN_ROOT:1 -->");
  const category = runtime.context.Note.createWithTitleNotebookDocument("奇偶");
  root.addChild(category);
  const question = runtime.context.Note.createWithTitleNotebookDocument("2002数二｜旧题干");
  question.appendMarkdownComment("题目：旧题干");
  category.addChild(question);

  const importer = loadImporter(runtime);
  const result = importer.importCurrentPractice({ window: {} }, payload);

  assert.equal(result.createdCount, 1);
  assert.equal(result.updatedCount, 0);
  assert.equal(category.childNotes.length, 1);
  assert.equal(question.noteTitle, "2002数二｜旧题干");
  assert.equal(category.childNotes[0], question);
});

test("重新导入当前题卡时补上公式安全留白", () => {
  const runtime = createNativeRuntime();
  const importer = loadImporter(runtime);
  importer.importCurrentPractice({ window: {} }, payload);
  const category = runtime.notebook.notes[0].childNotes[0].childNotes[0].childNotes[0].childNotes[0].childNotes[0];
  const question = category.childNotes[0];
  question.comments[0].text = question.comments[0].text.replace("\n<br>", "");

  const result = importer.importCurrentPractice({ window: {} }, payload);

  assert.equal(result.updatedCount, 1);
  assert.match(question.comments[0].text, /\$\$\\int_0\^x f\(t\)dt\$\$\n<br>/);
});

test("重新导入当前题卡替换旧版公式正文为 Markdown 题卡", () => {
  const runtime = createNativeRuntime();
  const importer = loadImporter(runtime);
  importer.importCurrentPractice({ window: {} }, payload);
  const root = runtime.notebook.notes[0];
  const category = root.childNotes[0].childNotes[0].childNotes[0].childNotes[0].childNotes[0];
  const question = category.childNotes[0];
  question.comments[0].text = "函数 f(x) 公式：\\n\\frac{x}{y}\\n<!-- DAGUANYUAN_QUESTION_ID:3592 -->";
  question.noteTitle = "旧版题卡";

  const result = importer.importCurrentPractice({ window: {} }, payload);

  assert.equal(result.updatedCount, 1);
  assert.equal(question.comments.length, 1);
  assert.match(question.comments[0].text, /设函数 \$f\(x\)\$ 连续。\n\n\$\$\\int_0\^x f\(t\)dt\$\$\n<br>\n\n- A\. 选项一/);
  assert.match(question.comments[0].text,
    /<!-- DAGUANYUAN_URL:https:\/\/cxyonly\.fans\/math\/questions\/3592 -->/);
});

test("329 练习继续使用高等数学和极限前缀分类", () => {
  const runtime = createNativeRuntime();
  const importer = loadImporter(runtime);
  importer.importCurrentPractice({ window: {} }, { ...payload, practiceId: "329" });

  assert.deepEqual(titlesFromRoot(runtime.notebook.notes[0]), [
    "Daguanyuan Bridge",
    "高等数学",
    "（一）极限",
    "函数",
    "函数性质考察",
    "有界",
    "2002数二",
  ]);
});

test("大观园导入创建网站完整目录的前两级和三级分类", () => {
  const runtime = createNativeRuntime();
  const importer = loadImporter(runtime);
  importer.importCurrentPractice({ window: {} }, payload);

  assert.deepEqual(titlesFromRoot(runtime.notebook.notes[0]), [
    "Daguanyuan Bridge",
    "高等数学",
    "（一）极限",
    "函数",
    "函数性质考察",
    "有界",
    "2002数二",
  ]);
});

test("重新导入不会迁移旧数字分类节点", () => {
  const runtime = createNativeRuntime();
  const root = runtime.context.Note.createWithTitleNotebookDocument("Daguanyuan Bridge");
  const legacyCategory = runtime.context.Note.createWithTitleNotebookDocument("分类 708");
  root.addChild(legacyCategory);
  const question = runtime.context.Note.createWithTitleNotebookDocument("2002数二");
  legacyCategory.addChild(question);

  const importer = loadImporter(runtime);
  const result = importer.importCurrentPractice({ window: {} }, payload);

  assert.equal(result.createdCount, 1);
  assert.equal(root.childNotes.some((note) => note.noteTitle === "分类 708"), true);
  const currentRoot = root.childNotes.find((note) => note.noteTitle === "高等数学");
  assert.deepEqual(titlesFromRoot(currentRoot), [
    "高等数学",
    "（一）极限",
    "函数",
    "函数性质考察",
    "有界",
    "2002数二",
  ]);
});

test("大观园完整目录的每个练习页都映射到正确的前两级", () => {
  const paths = {
    "321": ["高等数学", "（一）极限"],
    "322": ["高等数学", "（二）一元微分"],
    "224": ["高等数学", "（三）一元积分"],
    "325": ["高等数学", "（四）微分方程"],
    "324": ["高等数学", "（五）多元微分"],
    "326": ["高等数学", "（六）二重积分"],
    "2": ["线性代数", "（一）行列式"],
    "3": ["线性代数", "（二）矩阵"],
    "4": ["线性代数", "（三）向量"],
    "5": ["线性代数", "（四）线性方程组"],
    "6": ["线性代数", "（五）特征值与特征向量"],
    "7": ["线性代数", "（六）二次型"],
    "855": ["历年真题", "（一）数二"],
    "2502": ["模拟哥专区", "（一）数二"],
  };

  Object.keys(paths).forEach((practiceId) => {
    const runtime = createNativeRuntime();
    const importer = loadImporter(runtime);
    importer.importCurrentPractice({ window: {} }, {
      practiceId,
      categoryId: "1",
      categoryPath: ["当前分类"],
      questions: [{ questionId: "1", source: "题源", markdown: "题干" }],
    });
    assert.deepEqual(titlesFromRoot(runtime.notebook.notes[0]).slice(1, 3), paths[practiceId]);
  });
});

test("408 导入按题库来源和知识点创建 Markdown 题卡", () => {
  const runtime = createNativeRuntime();
  const importer = loadImporter(runtime);
  const result = importer.importCurrentPractice({ window: {} }, {
    provider: "408os",
    categoryId: "1",
    categoryPath: ["数据结构", "算法"],
    questions: [{
      questionId: "1",
      source: "2009 第1题",
      markdown: "打印数据缓冲区的逻辑结构应该是（）。\n\n- A. 栈\n- B. 队列",
    }],
  });

  assert.equal(result.createdCount, 1);
  assert.deepEqual(titlesFromRoot(runtime.notebook.notes[0]), [
    "Daguanyuan Bridge",
    "数据结构",
    "算法",
    "2009 第1题",
  ]);
  assert.equal(runtime.notebook.notes[0].childNotes[0].childNotes[0].childNotes[0].comments[0].text,
    "打印数据缓冲区的逻辑结构应该是（）。\n\n- A. 栈\n- B. 队列\n\n<!-- DAGUANYUAN_QUESTION_ID:1 -->");
});

test("大观园导入忽略页面重复拼接的完整路径", () => {
  const runtime = createNativeRuntime();
  const importer = loadImporter(runtime);
  importer.importCurrentPractice({ window: {} }, {
    ...payload,
    categoryPath: ["极限计算", "函数极限", "∞➖∞"],
    fullCategoryPath: ["极限", "极限计算", "极限计算", "函数极限", "∞➖∞"],
  });

  assert.deepEqual(titlesFromRoot(runtime.notebook.notes[0]), [
    "Daguanyuan Bridge",
    "高等数学",
    "（一）极限",
    "极限计算",
    "函数极限",
    "∞➖∞",
    "2002数二",
  ]);
});

test("大观园导入保留网站提供的极限分类层", () => {
  const runtime = createNativeRuntime();
  const importer = loadImporter(runtime);
  importer.importCurrentPractice({ window: {} }, {
    ...payload,
    categoryPath: ["极限", "极限计算", "函数极限", "∞➖∞"],
  });

  assert.deepEqual(titlesFromRoot(runtime.notebook.notes[0]).slice(0, 6), [
    "Daguanyuan Bridge",
    "高等数学",
    "（一）极限",
    "极限",
    "极限计算",
    "函数极限",
  ]);
});

test("408 导入优先创建保留网页排版的 HTML 题卡", () => {
  const runtime = createNativeRuntime();
  const importer = loadImporter(runtime);
  const result = importer.importCurrentPractice({ window: {} }, {
    provider: "408os",
    categoryId: "1",
    categoryPath: ["数据结构", "算法"],
    questions: [{
      questionId: "8",
      source: "2011 第25题",
      markdown: "原始题干文本",
      html: '<div style="font-size:18px">题干 <img src="https://cdn.408os.cn/questions/8.png"></div>',
      htmlSize: { width: 1600, height: 240 },
    }],
  });

  const question = runtime.notebook.notes[0].childNotes[0].childNotes[0].childNotes[0];
  assert.equal(question.comments.length, 1);
  assert.match(question.comments[0].tag, /^daguanyuan-question:v1\|408os\|8\|/);
  assert.match(question.comments[0].html, /cdn\.408os\.cn\/questions\/8\.png/);
  assert.equal(question.comments[0].size.width, 1200);
  assert.equal(question.comments[0].size.height, 240);
  assert.equal(question.comments[0].text, "原始题干文本");
  assert.equal(result.htmlTagReadableCount, 1);
  assert.equal(result.htmlTagUnreadableCount, 0);
});

test("大观园导入固定使用 Markdown 题卡并保留不可见原题信息", () => {
  const runtime = createNativeRuntime();
  const importer = loadImporter(runtime);
  const result = importer.importCurrentPractice({ window: {} }, {
    provider: "daguanyuan",
    practiceId: "321",
    categoryId: "708",
    categoryPath: ["函数", "函数性质考察", "有界"],
    questions: [{
      questionId: "3592",
      source: "2002数二",
      markdown: "设函数 $f(x)$ 连续。",
      html: '<div style="padding:22px">设函数 <span>f(x)</span> 连续。</div>',
      htmlSize: { width: 960, height: 320 },
      url: "https://cxyonly.fans/math/practice/321?resumeCategoryId=708&questionId=3592",
    }],
  });

  const question = runtime.notebook.notes[0].childNotes[0].childNotes[0].childNotes[0].childNotes[0].childNotes[0].childNotes[0];
  assert.equal(result.createdCount, 1);
  assert.equal(question.comments[0].html, undefined);
  assert.match(question.comments[0].text, /设函数 \$f\(x\)\$ 连续/);
  assert.match(question.comments[0].text, /DAGUANYUAN_QUESTION_ID:3592/);
  assert.match(question.comments[0].text, /DAGUANYUAN_URL:https:\/\/cxyonly\.fans\/math\/practice/);
  assert.equal(result.htmlTagReadableCount, 0);
});

test("导入极限分类不会合并旧高等数学极限分支", () => {
  const runtime = createNativeRuntime();
  const root = runtime.context.Note.createWithTitleNotebookDocument("Daguanyuan Bridge");
  const math = runtime.context.Note.createWithTitleNotebookDocument("高等数学");
  root.addChild(math);
  const legacyLimit = runtime.context.Note.createWithTitleNotebookDocument("极限");
  math.addChild(legacyLimit);
  const legacyCalculation = runtime.context.Note.createWithTitleNotebookDocument("极限计算");
  legacyLimit.addChild(legacyCalculation);
  const legacyFunctionLimit = runtime.context.Note.createWithTitleNotebookDocument("函数极限");
  legacyCalculation.addChild(legacyFunctionLimit);
  const legacyQuestion = runtime.context.Note.createWithTitleNotebookDocument("2002数二");
  legacyQuestion.appendMarkdownComment("旧题\n\n<!-- DAGUANYUAN_QUESTION_ID:3592 -->");
  legacyFunctionLimit.addChild(legacyQuestion);
  const chapter = runtime.context.Note.createWithTitleNotebookDocument("（一）极限");
  math.addChild(chapter);
  const currentLimit = runtime.context.Note.createWithTitleNotebookDocument("极限");
  chapter.addChild(currentLimit);
  const currentCalculation = runtime.context.Note.createWithTitleNotebookDocument("极限计算");
  currentLimit.addChild(currentCalculation);
  const currentFunctionLimit = runtime.context.Note.createWithTitleNotebookDocument("函数极限");
  currentCalculation.addChild(currentFunctionLimit);
  const currentQuestion = runtime.context.Note.createWithTitleNotebookDocument("2002数二");
  currentQuestion.appendMarkdownComment("已有题\n\n<!-- DAGUANYUAN_QUESTION_ID:3592 -->");
  currentFunctionLimit.addChild(currentQuestion);

  const importer = loadImporter(runtime);
  const result = importer.importCurrentPractice({ window: {} }, {
    provider: "daguanyuan",
    practiceId: "321",
    categoryId: "708",
    categoryPath: ["极限", "极限计算", "函数极限", "∞➖∞"],
    questions: [{ questionId: "3592", source: "2002数二", markdown: "新题", url: "https://cxyonly.fans/math/practice/321?resumeCategoryId=708&questionId=3592" }],
  });

  assert.deepEqual(math.childNotes.map((note) => note.noteTitle), ["极限", "（一）极限"]);
  assert.equal(chapter.childNotes.some((note) => note.noteTitle === "极限"), true);
  const limit = chapter.childNotes.find((note) => note.noteTitle === "极限");
  const calculation = limit.childNotes.find((note) => note.noteTitle === "极限计算");
  const functionLimit = calculation.childNotes.find((note) => note.noteTitle === "函数极限");
  const category = functionLimit.childNotes.find((note) => note.noteTitle === "∞➖∞");
  assert.equal(category.noteTitle, "∞➖∞");
  assert.equal(result.mergedQuestionCount, undefined);
  assert.equal(result.createdCount, 1);
});

test("重新导入 408 HTML 题卡会替换旧 HTML，不会重复追加", () => {
  const runtime = createNativeRuntime();
  const importer = loadImporter(runtime);
  const payload = {
    provider: "408os",
    categoryId: "1",
    categoryPath: ["数据结构", "算法"],
    questions: [{ questionId: "9", source: "2011 第27题", markdown: "题干", html: "<div>第一次</div>" }],
  };
  importer.importCurrentPractice({ window: {} }, payload);
  payload.questions[0].html = "<div>第二次</div>";
  const result = importer.importCurrentPractice({ window: {} }, payload);
  const question = runtime.notebook.notes[0].childNotes[0].childNotes[0].childNotes[0];

  assert.equal(result.updatedCount, 1);
  assert.equal(question.comments.length, 1);
  assert.match(question.comments[0].html, /第二次/);
});

test("导入数据保留 408 尚未读取正文的题目数量", () => {
  const runtime = createNativeRuntime();
  const importer = loadImporter(runtime);
  const normalized = importer.validatePayload({
    provider: "408os",
    categoryId: "2",
    categoryPath: ["数据结构", "算法"],
    unavailableQuestionCount: 3,
    questions: [{ questionId: "2", source: "2009 第2题", markdown: "题干" }],
  });

  assert.equal(normalized.unavailableQuestionCount, 3);
});
