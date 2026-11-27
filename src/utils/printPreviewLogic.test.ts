import test from 'node:test';
import assert from 'node:assert/strict';
import { PAPER_SPECS, estimatePrintPageFit } from './printPreviewLogic';

test('PAPER_SPECS defines accurate 96 DPI pixel dimensions for Letter and A4', () => {
  assert.equal(PAPER_SPECS.letter.widthPx, 816);
  assert.equal(PAPER_SPECS.letter.pageHeightPx, 1056);
  assert.equal(PAPER_SPECS.a4.widthPx, 794);
  assert.equal(PAPER_SPECS.a4.pageHeightPx, 1123);
});

test('estimatePrintPageFit detects single-page fit and multi-page overflow accurately', () => {
  const fit = estimatePrintPageFit(980, PAPER_SPECS.letter);
  assert.equal(fit.fitsSinglePage, true);
  assert.equal(fit.estimatedPages, 1);
  assert.equal(fit.label, 'Fits 1 page');

  // Within 16px rounding tolerance still counts as 1 page
  const edgeFit = estimatePrintPageFit(1068, PAPER_SPECS.letter);
  assert.equal(edgeFit.fitsSinglePage, true);
  assert.equal(edgeFit.estimatedPages, 1);

  const twoPages = estimatePrintPageFit(1350, PAPER_SPECS.letter);
  assert.equal(twoPages.fitsSinglePage, false);
  assert.equal(twoPages.estimatedPages, 2);
  assert.equal(twoPages.label, '~2 pages');

  const fallback = estimatePrintPageFit(0, PAPER_SPECS.a4);
  assert.equal(fallback.estimatedPages, 1);
  assert.equal(fallback.fitsSinglePage, true);
});
