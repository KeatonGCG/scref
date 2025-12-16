const { getStore } = require("@netlify/blobs");


function safeCode(s) {
  return (s || "").toString().trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
}

async function incr(store, key) {
  const cur = await store.get(key);
  const n = Number(cur || 0) + 1;
  await store.set(key, String(n));
  return n;
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

    const store = getStore({ name: "sandcastle-referrals" });
    const body = JSON.parse(event.body || "{}");

    const lastCode = safeCode(body.ref_last || body.ref_code);
    const firstCode = safeCode(body.ref_first);
    const clickId = safeCode(body.click_id);
    const now = new Date().toISOString();

    if (lastCode) {
      await incr(store, `codes/${lastCode}/leads`);
      await store.set(`codes/${lastCode}/last_seen`, now);
    }
    if (firstCode) {
      await incr(store, `codes/${firstCode}/leads_first`);
      await store.set(`codes/${firstCode}/last_seen`, now);
    }

    if (clickId) {
      await store.set(`clicks/${clickId}/lead_at`, now);
      if (lastCode) await store.set(`clicks/${clickId}/code_last`, lastCode);
      if (firstCode) await store.set(`clicks/${clickId}/code_first`, firstCode);
    }

    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, body: "Error" };
  }
};
