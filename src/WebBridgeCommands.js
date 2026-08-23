var __DAGUANYUAN_WEB_BRIDGE_COMMANDS_GLOBAL__ = (function () {
  function importCurrentPractice(context, payload) {
    const normalized = __DAGUANYUAN_PRACTICE_IMPORT_GLOBAL__.validatePayload(payload);
    return __DAGUANYUAN_PRACTICE_IMPORT_GLOBAL__.importCurrentPractice(context.addon, normalized);
  }

  return {
    commands: {
      importCurrentPractice,
    },
  };
})();

