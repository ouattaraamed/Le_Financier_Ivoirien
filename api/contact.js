const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://xjwimhgdqcaqqadhhtnz.supabase.co";
const BUCKET = "contact-messages";

function clean(value, max) {
  return String(value || "")
    .replace(/[\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function headers(key) {
  return {
    apikey: key,
    Authorization: "Bearer " + key,
    "Content-Type": "application/json"
  };
}

async function ensureBucket(key) {
  const response = await fetch(SUPABASE_URL + "/storage/v1/bucket", {
    method: "POST",
    headers: headers(key),
    body: JSON.stringify({
      id: BUCKET,
      name: BUCKET,
      public: false
    })
  });
  if (!response.ok) {
    const text = await response.text();
    if (/exists|duplicate|already/i.test(text)) {
      return;
    }
    throw new Error("bucket " + response.status + " " + text.slice(0, 120));
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Méthode refusée." });
  }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    return res.status(503).json({
      error: "L’envoi est momentanément indisponible."
    });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (error) {
      body = {};
    }
  }
  body = body || {};

  if (String(body.company || "").trim()) {
    return res.status(200).json({ ok: true });
  }

  const name = clean(body.name, 120);
  const email = clean(body.email, 160);
  const subject = clean(body.subject, 160);
  const message = String(body.message || "").replace(/\u0000/g, "").trim().slice(0, 4000);

  if (!name || !subject || message.length < 10 || !validEmail(email)) {
    return res.status(400).json({
      error: "Indiquez un nom, un e-mail valide, un sujet et un message."
    });
  }

  try {
    await ensureBucket(key);
    const file = Date.now() + "-" + Math.random().toString(36).slice(2, 8) + ".json";
    const response = await fetch(
      SUPABASE_URL + "/storage/v1/object/" + BUCKET + "/" + file,
      {
        method: "POST",
        headers: headers(key),
        body: JSON.stringify({
          nom: name,
          email: email,
          sujet: subject,
          message: message,
          created_at: new Date().toISOString()
        })
      }
    );
    if (!response.ok) {
      const text = await response.text();
      console.error("contact upload", response.status, text.slice(0, 180));
      return res.status(502).json({
        error: "L’envoi n’a pas abouti. Réessayez dans un instant.",
        step: "upload",
        status: response.status
      });
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(502).json({
      error: "L’envoi n’a pas abouti. Réessayez dans un instant.",
      step: String(error && error.message || "erreur").slice(0, 160)
    });
  }
}
