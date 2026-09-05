import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function storageRuntime() {
  const files = new Map();
  const defaults = new Map();
  const context = {
    Application: {
      sharedInstance() { return { documentPath: "/documents" }; },
    },
    NSFileManager: {
      defaultManager() {
        return {
          fileExistsAtPath(path) { return path === "/documents/DaguanyuanBridge" || files.has(path); },
          createDirectoryAtPathWithIntermediateDirectoriesAttributes() { return true; },
        };
      },
    },
    NSData: {
      dataWithContentsOfFile(path) { return files.get(path); },
    },
    NSJSONSerialization: {
      JSONObjectWithDataOptions(data) { return JSON.parse(data.json); },
      dataWithJSONObjectOptions(value) {
        return {
          json: JSON.stringify(value),
          writeToFileAtomically(path) {
            files.set(path, this);
            return true;
          },
        };
      },
    },
    NSUserDefaults: {
      standardUserDefaults() {
        return {
          objectForKey(key) { return defaults.get(key); },
          setObjectForKey(value, key) { defaults.set(key, value); },
        };
      },
    },
    console,
    Date,
    JSON,
    Number,
    String,
    Array,
    Object,
    RegExp,
  };
  vm.createContext(context);
  vm.runInContext(readFileSync(new URL("../src/DaguanyuanStorage.js", import.meta.url), "utf8"), context);
  return context.__DAGUANYUAN_STORAGE_GLOBAL__;
}

test("题卡映射保存到原生存储", () => {
  const storage = storageRuntime();
  assert.equal(storage.saveQuestionMappings([{
    noteId: "note-1",
    provider: "daguanyuan",
    questionId: "3592",
    url: "https://cxyonly.fans/math/questions/3592",
    categoryPath: ["函数", "极限计算"],
    notebookId: "book-1",
  }]), 1);
  assert.equal(storage.questionForNoteId("note-1").questionId, "3592");
  assert.equal(storage.noteIdForQuestion("daguanyuan", "3592", "book-1"), "note-1");
});
