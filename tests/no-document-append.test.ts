import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Obsidian's Node.createEl/createDiv/createSpan create the element AND append it to the
// node they're called on. Called on a Document that means document.appendChild(), which
// throws HierarchyRequestError — this broke every context menu entry and badge in 1.1.1.
const SOURCES = ['main.ts', 'src/badge-renderer.ts'];

describe('DOM element creation', () => {
  it.each(SOURCES)('%s never creates elements on activeDocument/document directly', file => {
    const source = readFileSync(resolve(__dirname, '..', file), 'utf8');
    expect(source).not.toMatch(/\b(activeDocument|document)\.create(El|Div|Span)\(/);
  });
});
