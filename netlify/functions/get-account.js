const accounts = require("../../public/accounts.json");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const s = (v) => (v == null ? "" : String(v)); // normalize to string
const n = (v) => (typeof v === "number" ? v : null); // normalize to number

function unauthorized() {
  return {
    statusCode: 401,
    headers: {
      ...CORS_HEADERS,
      "WWW-Authenticate": 'Basic realm="AccountLookup"',
    },
    body: JSON.stringify({ error: "Unauthorized" }),
  };
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS")
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };

  // --- Basic Auth ---
  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth || !auth.startsWith("Basic ")) return unauthorized();

  const [user, pass] = Buffer.from(auth.slice(6), "base64")
    .toString()
    .split(":");
  if (user !== process.env.BASIC_USER || pass !== process.env.BASIC_PASS)
    return unauthorized();

  // --- Query Params ---
  const { phone, email, accountId } = event.queryStringParameters || {};
  if (!phone && !email && !accountId) {
    return json(400, {
      error: "BadRequest",
      message: "Provide one of: phone, email, or accountId",
      count: 0,
      accounts: [],
    });
  }

  const normalizedPhone = phone ? phone.replace(/\s/g, "+").trim() : "";

  // --- Filter Matching Account ---
  let results = accounts;
  if (accountId) {
    results = results.filter((a) => a.accountId === accountId);
  } else if (email) {
    results = results.filter(
      (a) => (a.email || "").toLowerCase() === email.toLowerCase()
    );
  } else if (phone) {
    results = results.filter((a) => a.phone === normalizedPhone);
  }

  const payload = {
    count: results.length,
    accounts: results.map((a) => ({
      accountId: s(a.accountId),
      name: s(a.name),
      email: s(a.email),
      phone: s(a.phone),
      membershipTier: s(a.membershipTier),
      billingAddress: {
        line1: s(a.billingAddress?.line1),
        line2: s(a.billingAddress?.line2),
        city: s(a.billingAddress?.city),
        region: s(a.billingAddress?.region),
        postal: s(a.billingAddress?.postal),
        country: s(a.billingAddress?.country),
      },
      balanceDue: n(a.balanceDue),
      dueDate: s(a.dueDate),
      billingPeriod: {
        start: s(a.billingPeriod?.start),
        end: s(a.billingPeriod?.end),
      },
      accountType: s(a.accountType),
    })),
  };

  if (results.length === 0) {
    return json(404, {
      error: "NotFound",
      message: "No matching account found",
      count: 0,
      accounts: [],
    });
  }

  return json(200, payload);
};
