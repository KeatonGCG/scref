const { getStore } = require("@netlify/blobs");


function safeCode(s) {
  return (s || "").toString().trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
}

exports.handler = async (event) => {
  try {
    const code = safeCode(event.queryStringParameters && event.queryStringParameters.code);
    if (!code) return { statusCode: 400, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: false, error: "Missing code" }) };

    const store = getStore({ name: "sandcastle-referrals" });
    const [clicks, leads, leadsFirst, last] = await Promise.all([
      store.get(`codes/${code}/clicks`),
      store.get(`codes/${code}/leads`),
      store.get(`codes/${code}/leads_first`),
      store.get(`codes/${code}/last_seen`)
    ]);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=15" },
      body: JSON.stringify({
        ok: true,
        code,
        clicks: Number(clicks || 0),
        leads: Number(leads || 0),
        leads_first: Number(leadsFirst || 0),
        last_seen: (last || "").toString()
      })
    };
  } catch (e) {
    return { statusCode: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: false, error: "Error" }) };
  }
};
