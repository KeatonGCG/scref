const { getStore } = require("@netlify/blobs");
const crypto = require("crypto");


function safeCode(s) {
  return (s || "").toString().trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
}

function makeClickId() {
  return crypto.randomBytes(10).toString("hex");
}

function cookie(name, value, maxAgeSeconds) {
  return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax; Secure`;
}

function getCookieFromHeader(cookieHeader, name) {
  if (!cookieHeader) return "";
  const m = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : "";
}

async function incr(store, key) {
  const cur = await store.get(key);
  const n = Number(cur || 0) + 1;
  await store.set(key, String(n));
  return n;
}

exports.handler = async (event) => {
  try {
    const code = safeCode(event.queryStringParameters && event.queryStringParameters.code);
    const clickId = makeClickId();
    const now = new Date().toISOString();

    const store = getStore({ name: "sandcastle-referrals" });

    if (code) {
      await incr(store, `codes/${code}/clicks`);
      await store.set(`codes/${code}/last_seen`, now);
      await store.set(`clicks/${clickId}/code`, code);
      await store.set(`clicks/${clickId}/at`, now);
    } else {
      await store.set(`clicks/${clickId}/at`, now);
    }

    const maxAge = 60 * 60 * 24 * 45;
    const cookieHeader = (event.headers && (event.headers.cookie || event.headers.Cookie)) || "";
    const existingFirst = getCookieFromHeader(cookieHeader, "sc_ref_first");

    const setCookies = [];
    if (code) {
      if (!existingFirst) setCookies.push(cookie("sc_ref_first", code, maxAge));
      setCookies.push(cookie("sc_ref_last", code, maxAge));
      setCookies.push(cookie("sc_ref_code", code, maxAge));
    }
    setCookies.push(cookie("sc_click_id", clickId, maxAge));

    const dest = code ? `/?ref=${encodeURIComponent(code)}` : "/";

    return {
      statusCode: 302,
      headers: { Location: dest },
      multiValueHeaders: { "Set-Cookie": setCookies },
      body: ""
    };
  } catch (e) {
    return { statusCode: 302, headers: { Location: "/" }, body: "" };
  }
};
