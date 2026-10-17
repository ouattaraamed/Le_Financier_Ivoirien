import { request as httpsRequest } from "node:https";

const DESTINATION = "lefinancierivoirien@gmail.com";
const PAGE = "https://le-financier-ivoirien.vercel.app/contact.html";

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

function postForm(body) {
  const payload = body.toString();
  return new Promise(function (resolve, reject) {
    const req = httpsRequest(
      "https://formsubmit.co/ajax/" + encodeURIComponent(DESTINATION),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "Content-Length": Buffer.byteLength(payload),
          Referer: PAGE,
          Origin: "https://le-financier-ivoirien.vercel.app"
        }
      },
      function (response) {
        const chunks = [];
        response.on("data", function (chunk) {
          chunks.push(chunk);
        });
        response.on("end", function () {
          const text = Buffer.concat(chunks).toString("utf8");
          let data = {};
          try {
            data = JSON.parse(text);
          } catch (error) {
            data = { message: text.slice(0, 180) };
          }
          resolve({ status: response.statusCode || 0, data: data });
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
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
    const form = new URLSearchParams();
    form.set("name", name);
    form.set("email", email);
    form.set("_replyto", email);
    form.set("_subject", "Le Financier Ivoirien — " + subject);
    form.set("_template", "table");
    form.set("_captcha", "false");
    form.set("_url", PAGE);
    form.set("message", message);

    const response = await postForm(form);
    const upstream = String(response.data.message || "");

    if (/activat/i.test(upstream)) {
      return res.status(200).json({
        pending: true,
        error: "Ouvrez lefinancierivoirien@gmail.com et cliquez sur « Activer le formulaire ». Ensuite, renvoyez le message."
      });
    }

    if (response.status < 200 || response.status >= 300 || String(response.data.success) === "false") {
      console.error("contact", response.status, upstream.slice(0, 180));
      return res.status(502).json({
        error: "L’envoi n’a pas abouti. Réessayez dans un instant.",
        detail: upstream.slice(0, 180) || "sans message"
      });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(502).json({
      error: "L’envoi n’a pas abouti. Réessayez dans un instant.",
      detail: String(error && error.message || error).slice(0, 180)
    });
  }
}
