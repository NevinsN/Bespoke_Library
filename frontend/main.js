import { getUser } from './core/appState.js';
import { route } from './core/router.js';

window.addEventListener('load', async () => {
  const user = await getUser();

  if (!user) {
    console.log('Anonymous user — showing public content.');
  } else {
    console.log(`Logged in as: ${user.userDetails}`);
  }

  route();
});
