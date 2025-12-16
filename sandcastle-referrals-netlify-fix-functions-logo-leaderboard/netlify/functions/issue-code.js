const { getStore } = require("@netlify/blobs");
const crypto = require("crypto");

function normContact(s) {
  return (s || "").toString().trim().toLowerCase().replace(/\s+/g, "");
}

function looksLikeEmailOrPhone(contact) {
  if (!contact) return false;
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
  const digits = contact.replace(/\D/g, "");
  const isPhone = digits.length >= 10 && digits.length <= 15;
  return isEmail || isPhone;
}

function makePersonId(contact) {
  return crypto.createHash("sha256").update(contact).digest("hex").slice(0, 16);
}

function makeIpId(ip) {
  return crypto.createHash("sha256").update(ip || "unknown").digest("hex").slice(0, 12);
}

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "SC-";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
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

    if ((body.website || "").toString().trim()) {
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: true }) };
    }

    const name = (body.name || "").toString().trim().slice(0, 80);
    const contact = normContact(body.contact);

    if (!looksLikeEmailOrPhone(contact)) {
      return { statusCode: 400, body: "Enter a valid email or phone number." };
    }

    const ip =
      (event.headers && (event.headers["x-nf-client-connection-ip"] || event.headers["x-forwarded-for"] || event.headers["X-Forwarded-For"])) ||
      "unknown";
    const ipFirst = (ip || "").split(",")[0].trim();
    const ipId = makeIpId(ipFirst);

    const now = new Date();
    const hourKey = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}${String(now.getUTCHours()).padStart(2, "0")}`;
    const rateKey = `rate/${ipId}/${hourKey}`;
    const count = await incr(store, rateKey);
    if (count > 12) return { statusCode: 429, body: "Please try again in a bit." };

    const pid = makePersonId(contact);
    const personKey = `people/${pid}.json`;
    const existing = await store.get(personKey);

    if (existing) {
      const data = JSON.parse(existing);
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: true, code: data.code, note: "Welcome back — here’s your link." }) };
    }

    let code = makeCode();
    for (let i = 0; i < 8; i++) {
      const taken = await store.get(`codes/${code}/owner`);
      if (!taken) break;
      code = makeCode();
    }

    const created_at = new Date().toISOString();

    await store.set(`codes/${code}/owner`, pid);
    await store.set(personKey, JSON.stringify({ id: pid, code, name, contact, created_at }));

    try {
      const idxKey = "index/codes.json";
      const cur = await store.get(idxKey);
      const arr = cur ? JSON.parse(cur) : [];
      const list = Array.isArray(arr) ? arr : [];
      if (!list.includes(code)) {
        list.push(code);
        await store.set(idxKey, JSON.stringify(list.slice(-5000)));
      }
    } catch (e) {}

    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: true, code, note: "Your link is ready." }) };
  } catch (e) {
    return { statusCode: 500, body: "Error" };
  }
};
