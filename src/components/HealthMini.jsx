import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "react-oidc-context";

const HEART = "\u2665"; // ♥

const targets = [
  { code: "ofs", name: "offers", url: "/.netlify/functions/offers" },
  { code: "tsc", name: "tracking-search", url: "/.netlify/functions/tracking-search?query=test" },
  { code: "ord", name: "offer-read", needsOfferId: true, buildUrl: (id) => `/.netlify/functions/offer-read?offerId=${encodeURIComponent(id)}` },
  { code: "odt", name: "offer-details", needsOfferId: true, buildUrl: (id) => `/.netlify/functions/offer-details?offerId=${encodeURIComponent(id)}` },
  { code: "rsc", name: "report-status-coe", url: "/.netlify/functions/report-status-coe" },
  { code: "hth", name: "health", url: "/.netlify/functions/health" },
];

function colorFor(status) {
  if (status === "ok") return "#0a7a2d"; // green
  if (status === "unauth") return "#d97706"; // amber
  if (status === "skip") return "#999999"; // gray
  return "#b00020"; // red for errors
}

export default function HealthMini() {
  const auth = useAuth();
  const [statuses, setStatuses] = useState({}); // code -> status: ok|unauth|err|skip
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    try {
      setLoading(true);
      const jwt = auth?.user?.id_token || auth?.user?.access_token || null;
      if (!jwt) {
        // Unauthenticated users: mark as unauth (amber) so widget doesn't scream red
        const base = Object.fromEntries(targets.map((t) => [t.code, "unauth"]));
        setStatuses(base);
        return;
      }

      const headers = { Authorization: `Bearer ${jwt}` };

      // Seed all as pending
      setStatuses((s) => ({ ...Object.fromEntries(targets.map((t) => [t.code, "pending"])) }));

      // 1) Fetch offers to get an offerId; also record ofs status
      let firstOfferId = null;
      try {
        const res = await fetch("/.netlify/functions/offers", { headers });
        if (res.status === 401 || res.status === 403) {
          setStatuses((s) => ({ ...s, ofs: "unauth" }));
        } else if (res.ok) {
          setStatuses((s) => ({ ...s, ofs: "ok" }));
          const arr = await res.json().catch(() => []);
          if (Array.isArray(arr) && arr.length) firstOfferId = arr[0]?.offerId;
        } else {
          setStatuses((s) => ({ ...s, ofs: "err" }));
        }
      } catch {
        setStatuses((s) => ({ ...s, ofs: "err" }));
      }

      // 2) Build and fire remaining requests in parallel
      const checks = targets
        .filter((t) => t.code !== "ofs")
        .map(async (t) => {
          try {
            let url = t.url;
            if (!url && t.needsOfferId) {
              if (!firstOfferId) {
                setStatuses((s) => ({ ...s, [t.code]: "skip" }));
                return;
              }
              url = t.buildUrl(firstOfferId);
            }
            if (!url) {
              setStatuses((s) => ({ ...s, [t.code]: "skip" }));
              return;
            }
            const res = await fetch(url, { headers });
            if (res.status === 401 || res.status === 403) {
              setStatuses((s) => ({ ...s, [t.code]: "unauth" }));
            } else if (res.ok) {
              setStatuses((s) => ({ ...s, [t.code]: "ok" }));
            } else {
              setStatuses((s) => ({ ...s, [t.code]: "err" }));
            }
          } catch {
            setStatuses((s) => ({ ...s, [t.code]: "err" }));
          }
        });

      await Promise.all(checks);
    } finally {
      setLoading(false);
    }
  }, [auth?.user]);

  useEffect(() => {
    run();
  }, [run]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {targets.map((t) => {
        const st = statuses[t.code];
        const c = colorFor(st);
        const title = `${t.code} • ${t.name} • ${st || (loading ? "checking" : "")}`.trim();
        return (
          <div key={t.code} title={title} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
            <span style={{ fontFamily: "monospace", opacity: 0.85 }}>{t.code}</span>
            <span style={{ color: c, fontSize: 14, lineHeight: 1 }}>{HEART}</span>
          </div>
        );
      })}
      <button
        onClick={run}
        title="Refresh health"
        style={{
          border: "none",
          background: "transparent",
          color: "#555",
          cursor: "pointer",
          padding: 0,
          fontSize: 12,
        }}
      >
        {loading ? "…" : "refresh"}
      </button>
    </div>
  );
}
