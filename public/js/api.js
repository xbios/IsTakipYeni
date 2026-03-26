// apiFetch() — Bearer header ekleyen, silent refresh yapan wrapper
// Access token memory'de tutulur, localStorage'a yazılmaz (XSS koruması)

let accessToken = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function clearAccessToken() {
  accessToken = null;
}

/**
 * API çağrısı yapar. Token expire olmuşsa refresh dener.
 * Refresh da başarısız olursa login sayfasına yönlendirir.
 */
export async function apiFetch(url, options = {}) {
  const response = await doFetch(url, options);

  if (response.status === 401) {
    // Access token süresi dolmuş olabilir, refresh dene
    const refreshed = await tryRefresh();
    if (!refreshed) {
      window.location.href = '/login.html';
      return;
    }
    // Yenilenen token ile tekrar dene
    return doFetch(url, options);
  }

  return response;
}

async function doFetch(url, options) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  return fetch(url, { ...options, headers, credentials: 'include' });
}

async function tryRefresh() {
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include', // HttpOnly cookie gönderilir
    });
    if (!res.ok) return false;
    const data = await res.json();
    setAccessToken(data.accessToken);
    return true;
  } catch {
    return false;
  }
}
