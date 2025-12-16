const { getStore } = require("@netlify/blobs");


function safeCode(s) {
  return (s || "").toString().trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
}

function toInt(x) {
  const n = Number(x || 0);
  return Number.isFinite(n) ? n : 0;
}

function displayNameFromPerson(person, code) {
  const raw = (person && person.name ? String(person.name) : "").trim();
  if (!raw) return `Member ${code.slice(-4)}`;
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${String(parts[1]).slice(0,1).toUpperCase()}.`;
}

exports.handler = async (event) => {
  try {
    const sort = ((event.queryStringParameters && event.queryStringParameters.sort) || "leads").toLowerCase();
    const limitRaw = parseInt((event.queryStringParameters && event.queryStringParameters.limit) || "10", 10);
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 10, 1), 50);

    const store = getStore({ name: "sandcastle-referrals" });

    const cur = await store.get("index/codes.json");
    const codes = cur ? JSON.parse(cur) : [];
    if (!Array.isArray(codes) || codes.length === 0) {
      return { statusCode: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=20" }, body: JSON.stringify({ ok: true, items: [] }) };
    }

    const sample = codes.slice(-2000).reverse();
    const results = [];

    for (const rawCode of sample) {
      const code = safeCode(rawCode);
      if (!code) continue;

      const [clicks, leads, leadsFirst, last, ownerPid] = await Promise.all([
        store.get(`codes/${code}/clicks`),
        store.get(`codes/${code}/leads`),
        store.get(`codes/${code}/leads_first`),
        store.get(`codes/${code}/last_seen`),
        store.get(`codes/${code}/owner`)
      ]);

      const c = toInt(clicks);
      const l = toInt(leads);
      const lf = toInt(leadsFirst);
      if (c === 0 && l === 0 && lf === 0) continue;

      let person = null;
      if (ownerPid) {
        const p = await store.get(`people/${ownerPid}.json`);
        if (p) { try { person = JSON.parse(p); } catch (e) {} }
      }

      results.push({ code, name: displayNameFromPerson(person, code), clicks: c, leads: l, leads_first: lf, last_seen: (last || "").toString() });
    }

    results.sort((a, b) => {
      if (sort === "clicks") {
        if (b.clicks !== a.clicks) return b.clicks - a.clicks;
        return b.leads - a.leads;
      }
      if (sort === "first") {
        if (b.leads_first !== a.leads_first) return b.leads_first - a.leads_first;
        if (b.leads !== a.leads) return b.leads - a.leads;
        return b.clicks - a.clicks;
      }
      if (b.leads !== a.leads) return b.leads - a.leads;
      return b.clicks - a.clicks;
    });

    const items = results.slice(0, limit);
    return { statusCode: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=20" }, body: JSON.stringify({ ok: true, sort, items }) };
  } catch (e) {
    return { statusCode: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: false, error: "Error" }) };
  }
};
