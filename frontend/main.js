import { getClientPrincipal } from './core/state.js';
import { route } from './core/router.js';

window.addEventListener('load', async () => {
    let user = null;
    try {
        user = await getClientPrincipal();
    } catch {
        // Silently treat as anonymous if /.auth/me is unavailable
    }

    if (!user) {
        console.log("Anonymous user detected, showing public content.");
    } else {
        console.log(`Logged in as: ${user.userDetails}`);
    }

    route(); // Always render — auth button handles its own state
});
