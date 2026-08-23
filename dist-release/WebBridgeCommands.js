var __DAGUANYUAN_WEB_BRIDGE_COMMANDS_GLOBAL__ = (function () {
  function importCurrentPractice(context, payload) {
    const normalized = __DAGUANYUAN_PRACTICE_IMPORT_GLOBAL__.validatePayload(payload);
    return __DAGUANYUAN_PRACTICE_IMPORT_GLOBAL__.importCurrentPractice(context.addon, normalized);
  }

  function resolveRetestQuestion(context, payload) {
    const questionId = String(payload && payload.questionId || "");
    return __DAGUANYUAN_RETEST_GLOBAL__.resolveQuestionCard(context.addon, questionId);
  }

  return {
    commands: {
      importCurrentPractice,
      resolveRetestQuestion,
    },
  };
})();
