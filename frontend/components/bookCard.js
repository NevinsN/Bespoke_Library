/**
 * bookCard.js
 *
 * The old HTML-string bookCard has been replaced by renderDraftCard()
 * in bookshelfView.js, which uses the appState progress tracking.
 *
 * This file is retained to avoid import errors but exports nothing functional.
 * If you need a standalone card element, use renderDraftCard() directly.
 */
export function bookCard() {
  console.warn('bookCard() is deprecated — use renderDraftCard() in bookshelfView.js');
  return document.createElement('div');
}
