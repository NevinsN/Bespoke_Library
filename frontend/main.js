import { getClientPrincipal } from './core/state.js';
import { route } from './core/router.js';

window.addEventListener('load', async () => {
    const user = await getClientPrincipal();

    if (!user) {
        // This is the Microsoft-specific login route for Azure SWA
        window.location.href = "/.auth/login/aad?post_login_redirect_uri=" + window.location.href;
        return;
    }

    // If we have a user, start the app
    console.log(`Logged in as: ${user.userDetails}`);
    route();
});