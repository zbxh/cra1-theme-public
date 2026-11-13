/* Shared text matching for public search titles and the permitted member menu. */
(function (root) {
  'use strict';
  var shared = root.CRA1Shared = root.CRA1Shared || {};
  if (shared.SearchMatch) return;
  var invisible = /[\u180e\u200b-\u200d\u2060\ufeff]/g;
  var hanLatin = /(\p{Script=Han})([a-z0-9])/gu;
  var latinHan = /([a-z0-9])(\p{Script=Han})/gu;
  var segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  function text(value) { return value === null || value === undefined ? '' : String(value); }
  function normalize(value) { return text(value).normalize('NFKC').toLowerCase().replace(invisible, '').replace(/\s+/g, ' ').trim(); }
  function compact(value) { return value.replace(/\s/g, ''); }
  function tokens(value) {
    var normalized = normalize(value);
    return normalized ? normalized.replace(hanLatin, '$1 $2').replace(latinHan, '$1 $2').split(/\s+/) : [];
  }
  function titleScore(title, term) {
    if (!title || !term) return 0;
    if (title === term) return 980;
    var tightTitle = compact(title), tightTerm = compact(term);
    if (tightTitle === tightTerm) return 960;
    if (title.indexOf(term) === 0) return 850;
    if (tightTitle.indexOf(tightTerm) === 0) return 830;
    if (title.indexOf(term) !== -1) return 750;
    if (tightTitle.indexOf(tightTerm) !== -1) return 730;
    var words = tokens(term);
    return words.length > 1 && words.every(function (word) { return tightTitle.indexOf(compact(word)) !== -1; }) ? 600 : 0;
  }
  function score(title, query, options) {
    options = options || {};
    var original = text(title), rawTerm = text(query).trim(), term = normalize(rawTerm);
    if (!term) return 0;
    if (original === rawTerm) return 1000;
    var normalizedTitle = normalize(original), rank = titleScore(normalizedTitle, term);
    if (rank) return rank;
    var aliases = Array.isArray(options.aliases) ? options.aliases : [];
    if (aliases.some(function (alias) { return titleScore(normalize(alias), term) > 0; })) return 450;
    var description = normalize(options.description);
    if (titleScore(description, term)) return 300;
    var words = tokens(term), combined = compact(normalizedTitle + ' ' + description);
    return words.length > 1 && words.every(function (word) { return combined.indexOf(compact(word)) !== -1; }) ? 300 : 0;
  }
  function graphemes(value) {
    if (segmenter) return Array.from(segmenter.segment(value), function (entry) { return { text: entry.segment, start: entry.index, end: entry.index + entry.segment.length }; });
    var result = [], offset = 0, regional = 0;
    Array.from(value).forEach(function (character) {
      var code = character.codePointAt(0), previous = result[result.length - 1];
      var isRegional = code >= 0x1f1e6 && code <= 0x1f1ff;
      var attached = previous && (/\p{Mark}/u.test(character) || code === 0x200d || /\u200d$/.test(previous.text) ||
        (code >= 0xfe00 && code <= 0xfe0f) || (code >= 0x1f3fb && code <= 0x1f3ff) || (isRegional && regional % 2 === 1));
      if (attached) { previous.text += character; previous.end += character.length; }
      else result.push({ text: character, start: offset, end: offset + character.length });
      offset += character.length; regional = isRegional ? regional + 1 : 0;
    });
    return result;
  }
  // Each normalized UTF-16 unit points back to a complete original grapheme.
  // NFKC ligatures, case expansions and emoji therefore keep safe text slices.
  function mapped(value) {
    var compatible = '', originalMap = [];
    graphemes(value).forEach(function (entry) {
      var normalized = entry.text.normalize('NFKC'); compatible += normalized;
      for (var index = 0; index < normalized.length; index++) originalMap.push({ start: entry.start, end: entry.end });
    });
    var lower = compatible.toLowerCase(), lowerMap = [], offset = 0;
    Array.from(compatible).forEach(function (character) {
      var source = originalMap[offset], length = character.toLowerCase().length;
      for (var index = 0; index < length; index++) lowerMap.push(source);
      offset += character.length;
    });
    var result = '', map = [];
    for (var index = 0; index < lower.length; index++) {
      var character = lower[index], source = lowerMap[index];
      if (/[\u180e\u200b-\u200d\u2060\ufeff]/.test(character)) continue;
      if (/\s/.test(character)) {
        if (!result || result[result.length - 1] === ' ') {
          if (map.length) map[map.length - 1] = { start: map[map.length - 1].start, end: source.end };
          continue;
        }
        character = ' ';
      }
      result += character; map.push(source);
    }
    if (result[result.length - 1] === ' ') { result = result.slice(0, -1); map.pop(); }
    return { text: result, map: map };
  }
  function parts(title, query) {
    var original = text(title), term = normalize(query), normalized = mapped(original), ranges = [];
    if (!term || !normalized.text) return [{ text: original, match: false }];
    var tight = { text: '', map: [] };
    for (var index = 0; index < normalized.text.length; index++) {
      if (normalized.text[index] !== ' ') { tight.text += normalized.text[index]; tight.map.push(normalized.map[index]); }
    }
    function find(view, word) {
      if (!word) return;
      for (var start = view.text.indexOf(word); start !== -1; start = view.text.indexOf(word, start + 1)) {
        ranges.push({ start: view.map[start].start, end: view.map[start + word.length - 1].end });
      }
    }
    find(normalized, term); find(tight, compact(term));
    tokens(term).forEach(function (word) { find(normalized, word); find(tight, compact(word)); });
    ranges.sort(function (a, b) { return a.start - b.start || b.end - a.end; });
    var merged = [];
    ranges.forEach(function (range) {
      var last = merged[merged.length - 1];
      if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
      else merged.push({ start: range.start, end: range.end });
    });
    var result = [], offset = 0;
    merged.forEach(function (range) {
      if (range.start > offset) result.push({ text: original.slice(offset, range.start), match: false });
      result.push({ text: original.slice(range.start, range.end), match: true }); offset = range.end;
    });
    if (offset < original.length || !result.length) result.push({ text: original.slice(offset), match: false });
    return result;
  }
  function variants(query) {
    var original = text(query).trim();
    if (!original || original === '0') return [];
    var result = [original], normalized = normalize(original), compatible = original.normalize('NFKC');
    if (!normalized || normalized === '0') return [];
    // Only words and whitespace can produce SQL-LIKE alternatives. Keep
    // identifiers, URLs and user-supplied search syntax as one literal query.
    if (/[^\p{Letter}\p{Number}\p{Mark}\s]/u.test(original + compatible)) return result;
    var words = tokens(normalized);
    if (words.length < 2 && compatible === original) return result;
    [normalized, words.join('%'), words.slice().reverse().join('%')].forEach(function (value) {
      if (value && result.indexOf(value) === -1 && result.length < 4) result.push(value);
    });
    return result;
  }
  shared.SearchMatch = { normalize: normalize, tokens: tokens, score: score, parts: parts, variants: variants };
})(typeof window !== 'undefined' ? window : globalThis);
