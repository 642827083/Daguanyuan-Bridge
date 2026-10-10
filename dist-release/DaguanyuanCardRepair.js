var __DAGUANYUAN_CARD_REPAIR_GLOBAL__ = (function () {
  const C = __DAGUANYUAN_CARD_COMMENTS_GLOBAL__;
  function context(addon) {
    const app = Application.sharedInstance(), study = app.studyController(addon && addon.window);
    const notebookId = String(C.value(study && study.notebookController, 'notebookId') || '');
    const database = Database.sharedInstance(), notebook = notebookId && database.getNotebookById(notebookId);
    if (!notebook) throw new Error('请先打开要修复题卡的 MarginNote 学习集');
    return { app, notebook, notebookId, topicId: String(C.value(notebook, 'topicId') || notebookId) };
  }
  function notes(notebook) {
    const pending = C.items(C.value(notebook, 'notes') || C.value(notebook, 'childNotes')), seen = new Set(), output = [];
    while (pending.length) {
      const note = pending.pop(), id = String(C.value(note, 'noteId') || '');
      if (!id || seen.has(id)) continue;
      seen.add(id); output.push(note); C.items(C.value(note, 'childNotes')).forEach(child => pending.push(child));
    }
    return output;
  }
  function identity(note) {
    const body = C.items(C.value(note, 'comments')).map(C.text).join('\n');
    const found = Array.from(body.matchAll(/^\s*<!--\s*DAGUANYUAN_(408_)?(QUESTION|ANSWER)_ID:([1-9]\d*)\s*-->\s*$/gm));
    if (!found.length) return null;
    const keys = new Set(found.map(item => (item[1] || '') + item[2] + ':' + item[3]));
    if (keys.size !== 1) throw new Error('题卡身份标记冲突，原内容已保留');
    const first = found[0], provider = first[1] ? '408' : 'math', role = first[2] === 'ANSWER' ? 'ANSWER' : undefined;
    const prefix = provider === '408' ? 'DAGUANYUAN_408_' : 'DAGUANYUAN_';
    const urls = Array.from(body.matchAll(new RegExp('<!--\\s*' + prefix + (role ? 'ANSWER_URL:' : 'URL:') + '(https:\\/\\/[^\\s<>]+)\\s*-->', 'g'))).map(item => item[1]);
    const routes = body.split(/\r?\n/).map(linkRoute).filter(Boolean);
    if (routes.some(route => route.provider !== provider || route.questionId !== Number(first[3]))) throw new Error('原题入口与题卡身份冲突，原内容已保留');
    routes.forEach(route => urls.push(route.url));
    if (new Set(urls).size > 1) throw new Error('题卡来源网址冲突，原内容已保留');
    return { id: Number(first[3]), provider, role, url: urls[0] || '', year: routes[0] && routes[0].year };
  }
  function linkRoute(line) {
    return __DAGUANYUAN_SOURCE_LINK_GLOBAL__.fromComment(line);
  }
  function sourceLink(line, target) {
    const route = linkRoute(line);
    return route && route.provider === target.provider && route.questionId === target.id ? route : null;
  }
  function pluginMarker(line) {
    return /^<!--\s*(DAGUANYUAN_(?:(?:408_)?(?:QUESTION_ID|ANSWER_ID):[1-9]\d*|(?:408_)?(?:URL|ANSWER_URL):https:\/\/[^\s<>]+|(?:408_)?ANSWER_PART:(?:answer|explanation)|SINGLE_IMPORT:1|SOURCE_LINK:(?:math|408):[1-9]\d*|(?:SOURCE|RENDERED)_STAMP:[\da-f:]+))\s*-->$/.exec(line.trim());
  }
  function plan(note, target) {
    const before = C.items(C.value(note, 'comments')), output = [], markers = [];
    const links = before.flatMap(comment => C.text(comment).split(/\r?\n/).map(linkRoute).filter(Boolean));
    if (links.some(link => link.provider !== target.provider || link.questionId !== target.id)) throw new Error('原题入口与题卡身份冲突，原内容已保留');
    if (new Set(links.map(link => link.url + ':' + link.year)).size > 1) throw new Error('存在不同的原题入口，原内容已保留');
    target.url = target.url || links[0] && links[0].url || '';
    if (!target.url && target.role) {
      const parent = identity(C.value(note, 'parentNote'));
      if (parent && !parent.role && parent.provider === target.provider && parent.id === target.id) {
        target.url = parent.url; target.year = parent.year;
        target.parentURL = parent.url;
      }
    }
    if (!target.url) throw new Error('缺少原题网址，无法补齐链接，原内容已保留');
    before.forEach(function (comment, index) {
      // 旧正文末尾追加的个人文字独立保留。
      const original = C.text(comment), identityTag = new RegExp('<!--\\s*DAGUANYUAN_' + (target.provider === '408' ? '408_' : '') + (target.role ? 'ANSWER_ID:' : 'QUESTION_ID:') + target.id + '\\s*-->');
      const hasIdentity = identityTag.test(original);
      let source = original, personal = '';
      if (hasIdentity) {
        const lines = original.split(/\r?\n/); let last = -1;
        lines.forEach((line, i) => { if (pluginMarker(line) || sourceLink(line, target)) last = i; });
        if (last >= 0) { personal = lines.slice(last + 1).join('\n').trim(); source = lines.slice(0, last + 1).join('\n'); }
      }
      let changed = false;
      const cleaned = source.replace(/(?:\r?\n){0,2}^[ \t]*(<!--[^\r\n]*-->|\[查看原题\]\([^\r\n]*\))[ \t]*\r?$/gm, function (whole, line) {
        const tag = pluginMarker(line), link = sourceLink(line, target);
        if (!tag && !link) return whole;
        if (tag && !markers.includes(tag[1])) markers.push(tag[1]);
        changed = true; return '';
      });
      if (!changed) output.push({ index });
      else if (cleaned.trim()) output.push({ index, replacement: cleaned, markdown: C.markdown(comment) });
      if (personal) output.push({ replacement: personal, markdown: C.markdown(comment) });
    });
    const bodyCandidates = output.filter(item => item.index !== undefined && /<!--\s*DAGUANYUAN_(?:408_)?(?:QUESTION|ANSWER)_ID:/.test(C.text(before[item.index])));
    if (bodyCandidates.length > 1) throw new Error('存在多个正文评论，原内容已保留');
    const bodyItem = bodyCandidates[0] || output.find(item => item.index === 0);
    if (!bodyItem || C.value(before[bodyItem.index], 'paint')) throw new Error('缺少可识别的正文，原内容已保留');
    output.splice(output.indexOf(bodyItem), 1); output.unshift(bodyItem);
    const body = output[0].replacement === undefined ? C.text(before[output[0].index]) : output[0].replacement;
    if (!body.trim()) throw new Error('缺少可识别的正文，原内容已保留');
    if (/<!--\s*DAGUANYUAN_/.test(body)) throw new Error('正文含无法识别的插件标记，原内容已保留');
    const parentTitle = target.role ? String(C.value(C.value(note, 'parentNote'), 'noteTitle') || '') : '';
    const year = links[0] && links[0].year || target.year || (String(C.value(note, 'noteTitle') || '').match(/(20\d{2})年/) || [])[1]
      || (target.url.match(/[?&]year=(20\d{2})(?:&|$)/) || [])[1] || (parentTitle.match(/(20\d{2})年/) || [])[1];
    const question = { id: target.id, source: year ? year + '年' : '' };
    let metadata = C.metadata(question, target.url, target.provider, target.role);
    if (markers.some(item => item.startsWith('DAGUANYUAN_SOURCE_LINK:') && item !== 'DAGUANYUAN_SOURCE_LINK:' + target.provider + ':' + target.id)) throw new Error('原题入口标记冲突，原内容已保留');
    const extras = markers.filter(item => /SINGLE_IMPORT:/.test(item));
    if (extras.length) metadata += '\n\n' + extras.map(item => '<!-- ' + item + ' -->').join('\n\n');
    output.splice(1, 0, { replacement: metadata });
    if (before.length === output.length && output.every((item, position) => item.replacement === undefined ? item.index === position : C.text(before[position]) === item.replacement && C.markdown(before[position]))) return null;
    return { noteId: String(C.value(note, 'noteId')), parentId: String(C.value(C.value(note, 'parentNote'), 'noteId') || ''), parentURL: target.parentURL,
      provider: target.provider, questionId: target.id, signatures: before.map(C.signature), output, answer: Boolean(target.role) };
  }
  function requireUtils() {
    if (typeof MNUtil === 'undefined' || typeof MNUtil.undoGrouping !== 'function' || typeof MNNote === 'undefined' || typeof MNNote.new !== 'function') throw new Error('修复题卡需要 MN Utils，请安装并启用最新版 MN Utils');
  }
  function preview(addon) {
    requireUtils(); const captured = context(addon), jobs = [], skipped = [];
    notes(captured.notebook).forEach(function (note) {
      try { const target = identity(note); if (target) { const job = plan(note, target); if (job) jobs.push(job); } }
      catch (error) { skipped.push({ noteId: String(C.value(note, 'noteId')), reason: String(error.message || error) }); }
    });
    if (context(addon).notebookId !== captured.notebookId) throw new Error('学习集已切换，请重新统计');
    return { notebookId: captured.notebookId, topicId: captured.topicId, jobs, skipped,
      questionCount: jobs.filter(job => !job.answer).length, answerCount: jobs.filter(job => job.answer).length };
  }
  function apply(addon, prepared) {
    requireUtils(); const current = context(addon);
    if (!prepared || current.notebookId !== prepared.notebookId || current.topicId !== prepared.topicId) throw new Error('学习集已切换，请重新统计后再修复');
    const live = new Map(notes(current.notebook).map(note => [String(C.value(note, 'noteId')), note]));
    const result = { repairedCount: 0, skippedCount: prepared.skipped.length, failed: [] };
    if (!prepared.jobs.length) return result;
    MNUtil.undoGrouping(function () {
      prepared.jobs.forEach(function (job) {
        const note = live.get(job.noteId), comments = C.items(C.value(note, 'comments'));
        if (!note || String(C.value(C.value(note, 'parentNote'), 'noteId') || '') !== job.parentId || comments.length !== job.signatures.length || comments.some((item, i) => C.signature(item) !== job.signatures[i])) { result.skippedCount++; return; }
        if (job.parentURL) {
          let parent;
          try { parent = identity(live.get(job.parentId)); } catch (error) { result.skippedCount++; return; }
          if (!parent || parent.role || parent.provider !== job.provider || parent.id !== job.questionId || parent.url !== job.parentURL) { result.skippedCount++; return; }
        }
        try { C.apply(note, job.output); result.repairedCount++; } catch (error) { result.failed.push({ noteId: job.noteId, reason: String(error.message || error) }); }
      });
    }, current.topicId);
    current.app.refreshAfterDBChanged(current.topicId);
    return result;
  }
  return { preview, apply };
})();
