const orders = require("../../orders.json");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const s = (v) => (v == null ? "" : String(v)); // string or empty
const n = (v) => (typeof v === "number" ? v : null); // numeric or null

function unauthorized() {
  return {
    statusCode: 401,
    headers: {
      ...CORS_HEADERS,
      "WWW-Authenticate": 'Basic realm="WISMO-Demo"',
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

  // --- Extract Query Params ---
  const { id, email, phone } = event.queryStringParameters || {};
  if (!id && !email && !phone) {
    return json(400, {
      error: "BadRequest",
      message: "Provide one of: id, email, or phone",
      count: 0,
      orders: [],
    });
  }

  const normalizedPhone = phone ? phone.replace(/\s/g, "+").trim() : "";

  // --- Filter Orders ---
  let results = orders;
  if (id) {
    results = results.filter((o) => o.id === id);
  } else if (email) {
    results = results.filter(
      (o) => (o.email || "").toLowerCase() === email.toLowerCase()
    );
  } else if (phone) {
    results = results.filter((o) => o.phone === normalizedPhone);
  }

  // --- Format Response ---
  const payload = {
    count: results.length,
    orders: results.map((o) => ({
      id: s(o.id),
      email: s(o.email),
      phone: s(o.phone),
      status: s(o.status),
      carrier: s(o.carrier),
      tracking: s(o.tracking),
      trackingLink: s(o.trackingLink),
      estimatedDelivery: s(o.estimatedDelivery),
      membershipTier: s(o.membershipTier),
      deliveryAddress: {
        name: s(o.deliveryAddress?.name),
        line1: s(o.deliveryAddress?.line1),
        line2: s(o.deliveryAddress?.line2),
        city: s(o.deliveryAddress?.city),
        region: s(o.deliveryAddress?.region),
        postal: s(o.deliveryAddress?.postal),
        country: s(o.deliveryAddress?.country),
      },
      items: Array.isArray(o.items)
        ? o.items.map((it) => ({
            sku: s(it.sku),
            itemName: s(it.itemName),
            description: s(it.description),
            cost: n(it.cost),
            qty: n(it.qty),
          }))
        : [],
    })),
  };

  if (results.length === 0)
    return json(404, {
      error: "NotFound",
      message: "No matching orders",
      count: 0,
      orders: [],
    });

  return json(200, payload);
};
