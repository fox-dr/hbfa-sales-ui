import React, { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import AppHeader from "../components/AppHeader";

const targets = [
  { key: "offers", url: "/.netlify/functions/offers" },
  { key: "tracking-search", url: "/.netlify/functions/tracking-search?query=test" },
  { key: "offer-read", needsOfferId: true },
  { key: "offer-details", needsOfferId: true },
  { key: "report-status-coe", url: "/.netlify/functions/report-status-coe" },
  { key: "health", url: "/.netlify/functions/health" },
];

export default function Healthcheck() {
  const auth = useAuth();
  const [status, setStatus] = useState({});
  const [offerId, setOfferId] = useState(null);

  useEffect(() => {
    (async () => {
      const jwt = auth?.user?.access_token || auth?.user?.id_token || null;
      if (!jwt) return;
      const headers = { Authorization: `Bearer ${jwt}` };

      // 1) Try offers list to grab an offerId
      let firstOfferId = null;
      try {
        const res = await fetch("/.netlify/functions/offers", { headers });
        setStatus((s) => ({ ...s, offers: res.ok ? "ok" : `err ${res.status}` }));
        if (res.ok) {
          const arr = await res.json();
          if (Array.isArray(arr) && arr.length) firstOfferId = arr[0]?.offerId;
        }
      } catch (e) {
        setStatus((s) => ({ ...s, offers: e.message }));
      }
      setOfferId(firstOfferId);

      // 2) Ping others
      const rest = targets.filter((t) => t.key !== "offers");
      for (const t of rest) {
        try {
          let url = t.url;
          if (!url && t.needsOfferId && firstOfferId) {
            url = `/.netlify/functions/${t.key}?offerId=${encodeURIComponent(firstOfferId)}`;
          }
          if (!url && t.needsOfferId && !firstOfferId) {
            setStatus((s) => ({ ...s, [t.key]: "skipped (no offerId)" }));
            continue;
          }
          if (!url) continue;
          const res = await fetch(url, { headers });
          setStatus((s) => ({ ...s, [t.key]: res.ok ? "ok" : `err ${res.status}` }));
        } catch (e) {
          setStatus((s) => ({ ...s, [t.key]: e.message }));
        }
      }
    })();
  }, [auth?.user]);

  return (
    <div className="p-8">
      <AppHeader />
      <h1 className="text-xl font-bold mb-4">Healthcheck</h1>
      <p>OfferId used: {offerId || "(none)"}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, maxWidth: 520 }}>
        {targets.map((t) => (
          <div key={t.key} style={{ display: "flex", justifyContent: "space-between", border: "1px solid #eee", borderRadius: 6, padding: 8 }}>
            <div>{t.key}</div>
            <div style={{ fontWeight: 600, color: status[t.key] === "ok" ? "#0a7a2d" : status[t.key]?.startsWith("skipped") ? "#946200" : "#b00020" }}>
              {status[t.key] || "…"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

