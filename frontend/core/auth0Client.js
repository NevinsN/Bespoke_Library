/**
 * auth0Client.js — Auth0 SPA SDK wrapper.
 *
 * Single instance shared across the whole app.
 * Handles login, logout, token retrieval, and callback processing.
 */

const AUTH0_DOMAIN   = 'dev-11pu823og8y2kbnn.us.auth0.com';
const AUTH0_CLIENT_ID = 'XvxDdrSBv3GkDAb8D8jLVmouO5UsJqO3';
const AUTH0_AUDIENCE  = 'https://api.bespoke.nicholasnevins.org/';

let _client = null;

async function getClient() {
  if (_client) return _client;

  _client = await window.auth0.createAuth0Client({
    domain:   AUTH0_DOMAIN,
    clientId: AUTH0_CLIENT_ID,
    authorizationParams: {
      redirect_uri: window.location.origin,
      audience:     AUTH0_AUDIENCE,
      scope:        'openid profile email',
    },
    cacheLocation: 'localstorage',
    useRefreshTokens: true,
  });

  return _client;
}

export async function initAuth() {
  const client = await getClient();

  // Handle redirect callback after Auth0 login
  const params = new URLSearchParams(window.location.search);
  if (params.has('code') && params.has('state')) {
    try {
      await client.handleRedirectCallback();
    } catch (e) {
      console.error('Auth0 callback error:', e);
    }
    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  return client;
}

export async function loginWithRedirect() {
  const client = await getClient();
  await client.loginWithRedirect();
}

export async function logout() {
  const client = await getClient();
  client.logout({ logoutParams: { returnTo: window.location.origin } });
}

export async function getAccessToken() {
  const client = await getClient();
  try {
    return await client.getTokenSilently();
  } catch (e) {
    return null;
  }
}

export async function getAuth0User() {
  const client = await getClient();
  try {
    const isAuthenticated = await client.isAuthenticated();
    if (!isAuthenticated) return null;
    return await client.getUser();
  } catch (e) {
    return null;
  }
}

export async function isAuthenticated() {
  const client = await getClient();
  try {
    return await client.isAuthenticated();
  } catch (e) {
    return false;
  }
}
