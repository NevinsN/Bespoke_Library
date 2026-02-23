import { getClientPrincipal } from './core/state.js';
import { route } from './core/router.js';

window.addEventListener('load', async () => {
    const user = await getClientPrincipal();

    if (!user) {
        // Anonymous user: don't auto-login
        console.log("Anonymous user detected, showing public content.");
        route(); // render bookshelfView for anonymous/public content
        return;
    }

    // Logged-in user: start app as usual
    console.log(`Logged in as: ${user.userDetails}`);
    route();
});