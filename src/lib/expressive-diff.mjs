import { diffArrays, diffWordsWithSpace } from 'diff';

function wordRanges(removed, inserted) {
  const ranges = { del: [], ins: [] };
  let before = 0;
  let after = 0;
  for (const part of diffWordsWithSpace(
    removed.join('\n'),
    inserted.join('\n'),
  )) {
    if (part.removed) ranges.del.push([before, before + part.value.length]);
    if (part.added) ranges.ins.push([after, after + part.value.length]);
    if (!part.added) before += part.value.length;
    if (!part.removed) after += part.value.length;
  }
  return ranges;
}

// Repeated old/new context becomes one unchanged line. Only real edits stay marked.
function refineDiff(entries) {
  const result = [];
  for (let index = 0; index < entries.length;) {
    if (!entries[index].kind) {
      result.push(entries[index++]);
      continue;
    }
    const group = [];
    while (index < entries.length && entries[index].kind)
      group.push(entries[index++]);
    const removed = group
      .filter((line) => line.kind === 'del')
      .map((line) => line.text);
    const inserted = group
      .filter((line) => line.kind === 'ins')
      .map((line) => line.text);
    for (const part of diffArrays(removed, inserted)) {
      const kind = part.removed ? 'del' : part.added ? 'ins' : undefined;
      result.push(...part.value.map((text) => ({ text, kind })));
    }
  }

  for (let index = 0; index < result.length;) {
    if (!result[index].kind) {
      index += 1;
      continue;
    }
    const group = [];
    while (index < result.length && result[index].kind)
      group.push(result[index++]);
    const removed = group.filter((line) => line.kind === 'del');
    const inserted = group.filter((line) => line.kind === 'ins');
    const ranges = wordRanges(
      removed.map((line) => line.text),
      inserted.map((line) => line.text),
    );
    for (const [kind, lines] of [
      ['del', removed],
      ['ins', inserted],
    ]) {
      let offset = 0;
      for (const line of lines) {
        line.ranges = ranges[kind]
          .map(([start, end]) => [
            Math.max(0, start - offset),
            Math.min(line.text.length, end - offset),
          ])
          .filter(([start, end]) => end > start);
        offset += line.text.length + 1;
      }
    }
  }
  return result;
}

function lineMarker(kind) {
  return {
    name: 'diff-line',
    render({ nodesToTransform }) {
      for (const node of nodesToTransform) {
        node.properties.className.push('highlight', kind);
      }
      return nodesToTransform;
    },
  };
}

function wordMarker(kind, [columnStart, columnEnd]) {
  return {
    name: 'diff-word',
    inlineRange: { columnStart, columnEnd },
    render({ nodesToTransform }) {
      return nodesToTransform.map((node) => ({
        type: 'element',
        tagName: 'span',
        properties: { className: ['diff-word', `diff-word--${kind}`] },
        children: [node],
      }));
    },
  };
}

export function pluginDiffDetails() {
  return {
    name: 'DiffDetails',
    hooks: {
      preprocessCode({ codeBlock }) {
        if (codeBlock.language !== 'diff' && !codeBlock.props.useDiffSyntax)
          return;
        const entries = codeBlock.getLines().map((line) => {
          const kind = line
            .getAnnotations()
            .find((annotation) =>
              ['ins', 'del'].includes(annotation.markerType),
            )?.markerType;
          if (kind) return { text: line.text, kind };
          // Unified diff headers are context, while single +/- prefixes mark edits.
          const match = line.text.match(/^([+-])(?!\1\1)(.*)$/);
          return match
            ? { text: match[2], kind: match[1] === '+' ? 'ins' : 'del' }
            : { text: line.text };
        });
        const refined = refineDiff(entries);
        codeBlock.deleteLines(codeBlock.getLines().map((_, index) => index));
        const lines = codeBlock.insertLines(
          0,
          refined.map((line) => line.text),
        );
        for (const [index, entry] of refined.entries()) {
          if (!entry.kind) continue;
          lines[index].addAnnotation(lineMarker(entry.kind));
          for (const range of entry.ranges)
            lines[index].addAnnotation(wordMarker(entry.kind, range));
        }
      },
    },
  };
}
