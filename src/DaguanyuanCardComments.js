var __DAGUANYUAN_CARD_COMMENTS_GLOBAL__ = (function () {
  function value(object, key) { const item = object && object[key]; return typeof item === 'function' ? item.call(object) : item; }
  function items(list) {
    const count = Number(value(list, 'count') || list && list.length || 0), result = [];
    for (let i = 0; i < count; i++) result.push(typeof list.objectAtIndex === 'function' ? list.objectAtIndex(i) : list[i]);
    return result;
  }
  function text(comment) { return String(value(comment, 'text') || ''); }
  function markdown(comment) { const flag = value(comment, 'markdown'); return flag === undefined ? !value(comment, 'type') : Boolean(flag); }
  function signature(comment) { return JSON.stringify([text(comment), value(comment, 'type') || '', Boolean(value(comment, 'markdown')), value(comment, 'paint') || '']); }
  function metadata(question, url, provider, role) {
    provider = provider || 'math';
    const prefix = provider === '408' ? 'DAGUANYUAN_408_' : 'DAGUANYUAN_';
    const answer = role === 'ANSWER', year = provider === '408' && String(question.source || '').match(/(20\d{2})年/);
    return '[查看原题](' + __DAGUANYUAN_SOURCE_LINK_GLOBAL__.link(provider, question.id, url, year ? Number(year[1]) : 0) + ')'
      + '\n\n<!-- ' + prefix + (answer ? 'ANSWER_ID:' : 'QUESTION_ID:') + question.id + ' -->';
  }
  function read(note, id, provider, role) {
    const comments = items(value(note, 'comments')), body = text(comments[0]), meta = text(comments[1]);
    const prefix = provider === '408' ? 'DAGUANYUAN_408_' : 'DAGUANYUAN_';
    if (!body || /<!--\s*DAGUANYUAN_/.test(body) || !meta.startsWith('[查看原题](')
      || !meta.includes('<!-- ' + prefix + (role === 'ANSWER' ? 'ANSWER_ID:' : 'QUESTION_ID:') + id + ' -->')) {
      throw new Error('题卡评论格式无效，请先在设置中修复已导入题卡');
    }
    const source = __DAGUANYUAN_SOURCE_LINK_GLOBAL__.fromComment(meta);
    if (!source || source.provider !== (provider || 'math') || source.questionId !== Number(id)) throw new Error('题卡的查看原题链接缺失或与身份不符，原内容已保留，请先修复已导入题卡');
    return { index: 0, prefix: body, suffix: '', url: source.url, metadata: meta };
  }
  function editor(note) {
    const result = typeof MNNote !== 'undefined' && MNNote && typeof MNNote.new === 'function' && MNNote.new(String(value(note, 'noteId') || ''));
    if (!result || ['appendMarkdownComment', 'removeCommentByIndex', 'sortCommentsByNewIndices'].some(key => typeof result[key] !== 'function')) {
      throw new Error('编辑题卡需要 MN Utils 的评论接口，请安装并启用最新版 MN Utils');
    }
    return result;
  }
  function sort(edit, order) {
    // MN Utils 参数是旧索引到新位置的映射，不是新评论次序中的旧索引列表。
    const destinations = [];
    order.forEach(function (oldIndex, newIndex) { destinations[oldIndex] = newIndex; });
    edit.sortCommentsByNewIndices(destinations);
  }
  function append(edit, body, isMarkdown) {
    const method = isMarkdown === false ? 'appendTextComment' : 'appendMarkdownComment';
    if (typeof edit[method] !== 'function') throw new Error('MN Utils 缺少评论编辑接口，请更新后重试');
    edit[method](body);
  }
  function restore(note, before, edit) {
    let current = items(value(note, 'comments'));
    // 追加或排序前失败时原评论仍在原位，直接清理新增项，不再依赖失败的排序接口。
    if (current.length >= before.length && before.every((comment, i) => signature(current[i]) === signature(comment))) {
      for (let i = current.length - 1; i >= before.length; i--) edit.removeCommentByIndex(i);
      if (items(value(note, 'comments')).length !== before.length) throw new Error('评论恢复未完成，请使用 MN 撤销');
      return;
    }
    const used = [], order = before.map(function (comment) {
      let found = current.findIndex((item, index) => !used.includes(index) && signature(item) === signature(comment));
      if (found < 0) {
        if (value(comment, 'paint') || value(comment, 'type') === 'PaintNote') throw new Error('请使用 MN 撤销恢复手写评论');
        append(edit, text(comment), markdown(comment)); current = items(value(note, 'comments')); found = current.length - 1;
      }
      used.push(found); return found;
    });
    current.forEach(function (_, index) { if (!used.includes(index)) order.push(index); });
    sort(edit, order);
    for (let i = current.length - 1; i >= before.length; i--) edit.removeCommentByIndex(i);
    current = items(value(note, 'comments'));
    if (current.length !== before.length || current.some((item, i) => signature(item) !== signature(before[i]))) throw new Error('评论恢复未完成，请使用 MN 撤销');
  }
  function apply(note, output) {
    const before = items(value(note, 'comments')), edit = editor(note), signatures = before.map(signature), order = [];
    let count = before.length;
    try {
      output.forEach(function (item) {
        if (item.replacement === undefined) { order.push(item.index); return; }
        append(edit, item.replacement, item.markdown);
        const current = items(value(note, 'comments'));
        if (current.length !== count + 1 || text(current[count]) !== item.replacement) throw new Error('新评论没有完整保存');
        order.push(count++);
      });
      before.forEach(function (_, index) { if (!order.includes(index)) order.push(index); });
      sort(edit, order);
      const sorted = items(value(note, 'comments'));
      if (sorted.length !== count || output.some(function (item, index) {
        return item.replacement === undefined ? signature(sorted[index]) !== signatures[item.index] : text(sorted[index]) !== item.replacement;
      })) throw new Error('评论排序没有完成');
      // 新评论完整保存后才移除旧插件评论，个人评论和手写对象不重建。
      for (let i = count - 1; i >= output.length; i--) edit.removeCommentByIndex(i);
      if (items(value(note, 'comments')).length !== output.length) throw new Error('旧插件评论没有完整移除');
    } catch (error) {
      try { restore(note, before, edit); } catch (failure) { error.message += '；' + String(failure.message || failure); }
      throw error;
    }
  }
  return { value, items, text, markdown, signature, metadata, read, editor, sort, restore, apply };
})();
