import { state, setState } from './state.js';
import { renderBookshelf } from '../views/bookshelfView.js';
import { renderReader } from '../views/readerView.js';
import { renderAuthorStudio } from '../views/authorStudioView.js';

export function route() {
  const params = new URLSearchParams(window.location.search);

  const bookId = params.get('book');
  const chapterId = params.get('id');

  // Author mode overrides everything
  if (state.role === 'author') {
    renderAuthorStudio();
    return;
  }

  if (chapterId) {
    setState({ currentChapter: chapterId });
    renderReader(chapterId);
    return;
  }

  if (bookId) {
    setState({ currentBook: bookId });
    renderBookshelf(bookId); // chapter list view
    return;
  }

  renderBookshelf();
}