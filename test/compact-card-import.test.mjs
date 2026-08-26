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

test("重新导入会迁移旧格式卡片而非重复创建", () => {
  const runtime = createNativeRuntime();
  const root = runtime.context.Note.createWithTitleNotebookDocument("Daguanyuan Bridge");
  root.appendMarkdownComment("<!-- DAGUANYUAN_ROOT:1 -->");
  const category = runtime.context.Note.createWithTitleNotebookDocument("奇偶");
  category.appendMarkdownComment("<!-- DAGUANYUAN_CATEGORY_ID:708 -->");
  root.addChild(category);
  const question = runtime.context.Note.createWithTitleNotebookDocument("2002数二｜旧题干");
  question.appendMarkdownComment("题目：旧题干\n\n<!-- DAGUANYUAN_QUESTION_ID:3592 -->");
  category.addChild(question);

  const importer = loadImporter(runtime);
  const result = importer.importCurrentPractice({ window: {} }, payload);

  assert.equal(result.createdCount, 0);
  assert.equal(result.updatedCount, 1);
  assert.equal(category.childNotes.length, 1);
  assert.equal(question.noteTitle, "2002数二");
  assert.match(question.allNoteText(), /DAGUANYUAN_QUESTION_ID:3592/);
  assert.doesNotMatch(root.allNoteText(), /DAGUANYUAN_/);
});

test("重新导入旧隐藏链接题卡时补上公式安全留白", () => {
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

test("重新导入替换旧版公式正文为 Markdown 题卡", () => {
  const runtime = createNativeRuntime();
  const importer = loadImporter(runtime);
  importer.importCurrentPractice({ window: {} }, payload);
  const root = runtime.notebook.notes[0];
  const category = root.childNotes[0].childNotes[0].childNotes[0].childNotes[0].childNotes[0];
  const question = category.childNotes[0];
  question.comments[0].text = "函数 f(x) 公式：\\n\\frac{x}{y}";
  question.noteTitle = "题目 3592｜2002数二";

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

test("重新导入把旧数字分类节点迁移到网站完整分类", () => {
  const runtime = createNativeRuntime();
  const root = runtime.context.Note.createWithTitleNotebookDocument("Daguanyuan Bridge");
  const legacyCategory = runtime.context.Note.createWithTitleNotebookDocument("分类 708");
  root.addChild(legacyCategory);
  const question = runtime.context.Note.createWithTitleNotebookDocument("2002数二");
  legacyCategory.addChild(question);

  const importer = loadImporter(runtime);
  const result = importer.importCurrentPractice({ window: {} }, payload);

  assert.equal(result.migratedCategoryCount, 1);
  assert.deepEqual(titlesFromRoot(root), [
    "Daguanyuan Bridge",
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
