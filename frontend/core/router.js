import { state, setState } from './state.js';
import { renderBookshelf } from '../views/bookshelfView.js';
import { renderReader } from '../views/readerView.js';
import { renderChapterList } from '../views/chapterListView.js'; 
import { renderAuthorStudio } from '../views/authorStudioView.js';

export function route() {
  const params = new URLSearchParams(window.location.search);

  const bookId = params.get('book');
  const chapterId = params.get('id'); 

  if (state.role === 'author') {
    renderAuthorStudio();
    return;
  }

  if (chapterId) {
    renderReader(chapterId);
    return;
  }

  if (bookId) {
    renderChapterList(bookId);
    return;
  }

  renderBookshelf();
}