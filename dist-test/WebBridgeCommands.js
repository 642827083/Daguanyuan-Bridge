var __DAGUANYUAN_WEB_BRIDGE_COMMANDS_GLOBAL__ = (function () {
  function resolveRetestQuestion(context, payload) {
    const questionId = String(payload && payload.questionId || "");
    return __DAGUANYUAN_RETEST_GLOBAL__.resolveQuestionCard(context.addon, questionId);
  }

  return {
    commands: {
      resolveRetestQuestion,
    },
  };
})();
