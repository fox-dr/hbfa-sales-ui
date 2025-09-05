// src/api/client.js
// Centralized client for Netlify function endpoints used by the app.
// All functions accept a JWT string and return parsed results or throw
// with a normalized error (403 => "User Action Not Authorized").

const JSON_HEADERS = { "Content-Type": "application/json" };

function authHeaders(jwt) {
  return jwt ? { Authorization: `Bearer ${jwt}` } : {};
}

async function handleResponse(res, friendlyContext) {
  if (res.status === 403) {
    throw new Error("User Action Not Authorized");
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    const msg = friendlyContext || `HTTP ${res.status}`;
    // Prefer server error message if any
    try {
      const j = JSON.parse(txt);
      throw new Error(j?.error || msg);
    } catch {
      throw new Error(msg);
    }
  }
}

export async function searchOffers(jwt, query) {
  const url = `/.netlify/functions/tracking-search?query=${encodeURIComponent(query || "")}`;
  const res = await fetch(url, { headers: { ...authHeaders(jwt) } });
  await handleResponse(res, "Search failed");
  const data = await res.json();
  return data?.results || [];
}

export async function getOfferDetails(jwt, offerId) {
  const url = `/.netlify/functions/offer-details?offerId=${encodeURIComponent(offerId)}`;
  const res = await fetch(url, { headers: { ...authHeaders(jwt) } });
  if (res.status === 403) return null; // caller may treat as non-fatal
  await handleResponse(res, "Failed to load details");
  return await res.json();
}

export async function getOfferRead(jwt, offerId) {
  const url = `/.netlify/functions/offer-read?offerId=${encodeURIComponent(offerId)}`;
  const res = await fetch(url, { headers: { ...authHeaders(jwt) } });
  await handleResponse(res, "Failed to load offer");
  return await res.json();
}

export async function saveOfferTracking(jwt, payload) {
  const res = await fetch(`/.netlify/functions/offers`, {
    method: "PUT",
    headers: { ...JSON_HEADERS, ...authHeaders(jwt) },
    body: JSON.stringify(payload || {}),
  });
  await handleResponse(res, "Save failed");
  return await res.json();
}

export async function approveOffer(jwt, offerId, { approved, vp_notes, vp_id } = {}) {
  const url = `/.netlify/functions/offers-approve?offerId=${encodeURIComponent(offerId)}`;
  const body = { approved, vp_notes, vp_id };
  const res = await fetch(url, {
    method: "POST",
    headers: { ...JSON_HEADERS, ...authHeaders(jwt) },
    body: JSON.stringify(body),
  });
  await handleResponse(res, "Approval failed");
  return await res.json();
}

export async function generateOfferDoc(jwt, offer) {
  const url = `/.netlify/functions/offer-doc`;
  const res = await fetch(url, {
    method: "POST",
    headers: { ...JSON_HEADERS, ...authHeaders(jwt) },
    body: JSON.stringify({ offer }),
  });
  await handleResponse(res, "Generate failed");
  return await res.json();
}
