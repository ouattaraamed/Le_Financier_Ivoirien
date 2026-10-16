const DESTINATION = "ouattaraamed0507@gmail.com";

function clean(value, max) {
  return String(value || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Méthode refusée." });
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
  const message = String(body.message || "").trim().slice(0, 4000);

  if (!name || !subject || message.length < 10 || !validEmail(email)) {
    return res.status(400).json({
      error: "Indiquez un nom, un e-mail valide, un sujet et un message."
    });
  }

  try {
    const response = await fetch(
      "https://formsubmit.co/ajax/" + encodeURIComponent(DESTINATION),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          name: name,
          email: email,
          _replyto: email,
          _subject: "Le Financier Ivoirien — " + subject,
          _template: "table",
          _captcha: "false",
          message: message
        })
      }
    );

    const data = await response.json().catch(function () {
      return {};
    });

    if (!response.ok || String(data.success) === "false") {
      return res.status(502).json({
        error: "L’envoi n’a pas abouti. Réessayez dans un instant."
      });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(502).json({
      error: "L’envoi n’a pas abouti. Réessayez dans un instant."
    });
  }
}
