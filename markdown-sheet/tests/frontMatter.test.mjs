import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractFrontMatter, splitFrontMatter } from '../src/lib/frontMatter.ts';
const sample = '---\nstatus: draft\nowner: Makoto Komatsu\nlast_updated: 2026-09-12\nopen_issues:\n  - 各章の相互依存関係の精査\n  - 共同研究への移行条件\n---\n# 本文';
test('metadata lists and dates survive LF and CRLF', () => {
  for (const text of [sample, sample.replaceAll('\n', '\r\n')]) {
    const result = extractFrontMatter(text);
    assert.deepEqual(result.meta?.open_issues, ['各章の相互依存関係の精査', '共同研究への移行条件']);
    assert.equal(result.meta?.last_updated, '2026-09-12');
    assert.equal(result.body, '# 本文');
    assert.equal(splitFrontMatter(text)?.lineCount, 8);
  }
});
test('nested maps, multiline strings and inline lists', () => {
  const result = extractFrontMatter('---\ninfo:\n  tags: [one, two]\ntext: |\n  first\n  second\n---\n');
  assert.deepEqual(result.meta?.info, { tags: ['one', 'two'] });
  assert.equal(result.meta?.text, 'first\nsecond\n');
});
test('malformed YAML remains visible', () => {
  assert.equal(extractFrontMatter('---\nlist: [\n---\nbody').meta?.YAML, 'list: [');
});
test('only standalone delimiters close metadata', () => {
  assert.equal(splitFrontMatter('---\na: b\n---text'), null);
  assert.equal(splitFrontMatter('body\n---\na: b\n---'), null);
});

