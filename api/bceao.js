const LIST_URL = "https://www.bceao.int/fr/communique-presse";
const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://xjwimhgdqcaqqadhhtnz.supabase.co";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html",
  "Accept-Language": "fr-FR,fr;q=0.9"
};

function decode(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&#(\d+);/g, function (_, n) {
      return String.fromCharCode(Number(n));
    })
    .replace(/&#x([0-9a-f]+);/gi, function (_, n) {
      return String.fromCharCode(parseInt(n, 16));
    })
    .replace(/\s+/g, " ")
    .trim();
}

function fold(value) {
  return decode(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function relevant(text) {
  const n = fold(text);
  if (/liste des participants|appel a candidatures/.test(n)) {
    return false;
  }
  return /politique monetaire|conseil des ministres|pi-spi|paiement|monnaie electronique|sanction|commission bancaire|billet|cote d.?ivoire|stabilite financiere|tresor|fraude/.test(
    n
  );
}

function parseList(html) {
  const items = [];
  const re = /<div class="elemCommunique views-row">([\s\S]*?)<\/a>/g;
  let match;
  while ((match = re.exec(html))) {
    const block = match[1];
    const href = (block.match(/href="(https:\/\/www\.bceao\.int\/[^"]+)"/) || [])[1];
    const date = decode((block.match(/<span class="date">([\s\S]*?)<\/span>/) || [])[1]);
    const desc = decode((block.match(/<span class="desc">([\s\S]*?)<\/span>/) || [])[1]);
    if (!href || !date || !relevant(desc + " " + href)) {
      continue;
    }
    items.push({
      url: href,
      date: date,
      title: desc.replace(/[…\u2026]\s*$/, "").trim()
    });
  }
  return items.slice(0, 8);
}

function parseArticle(html, item) {
  const title = decode(
    (html.match(/<h1>\s*<span>([\s\S]*?)<\/span>/i) || [])[1] || item.title
  );
  const article = (html.match(/<article\b[\s\S]*?<\/article>/i) || [html])[0];
  const paragraphs = [];
  const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let match;
  while ((match = re.exec(article))) {
    const text = decode(match[1]);
    if (text.length > 1) {
      paragraphs.push(text);
    }
  }
  const pdf = (
    (article.match(
      /href="(https:\/\/www\.bceao\.int\/sites\/default\/files\/[^"]+\.pdf)"/i
    ) || [])[1] || ""
  ).replace(/&amp;/g, "&");
  const lead = paragraphs.filter(function (paragraph) {
    return paragraph.length > 80;
  })[0] || paragraphs[0] || "";
  let excerpt = lead;
  if (excerpt.length > 340) {
    excerpt = excerpt.slice(0, 320).replace(/\s+\S*$/, "") + "…";
  }
  return {
    title: title || item.title,
    date: item.date,
    url: item.url,
    excerpt: excerpt,
    pdf: pdf,
    paragraphs: paragraphs.slice(0, 6)
  };
}

async function fetchText(url) {
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) {
    throw new Error("BCEAO " + response.status);
  }
  return response.text();
}

function articleBody(item) {
  const parts = [
    "La BCEAO a publié, le " + item.date + ", le communiqué officiel ci-dessous.",
    ""
  ];
  item.paragraphs.forEach(function (paragraph) {
    parts.push(paragraph, "");
  });
  if (!item.paragraphs.length) {
    parts.push("Le texte complet est publié sur le site de la BCEAO.", "");
  }
  parts.push("Source officielle : " + item.url);
  if (item.pdf) {
    parts.push("Version PDF : " + item.pdf);
  }
  return parts.join("\n").trim();
}

async function publishNew(items) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    return 0;
  }

  const headers = {
    apikey: key,
    Authorization: "Bearer " + key,
    "Content-Type": "application/json"
  };

  const existingResponse = await fetch(
    SUPABASE_URL +
      "/rest/v1/Articles?select=titre,contenu&auteur=eq.BCEAO&order=created_at.desc&limit=80",
    { headers: headers }
  );
  const existing = existingResponse.ok ? await existingResponse.json() : [];
  const known = new Set();
  (Array.isArray(existing) ? existing : []).forEach(function (row) {
    known.add(fold(row.titre || ""));
    const source = String(row.contenu || "").match(/https:\/\/www\.bceao\.int\/\S+/g) || [];
    source.forEach(function (url) {
      known.add(url);
    });
  });

  let created = 0;
  for (const item of items) {
    if (known.has(item.url) || known.has(fold(item.title))) {
      continue;
    }
    const response = await fetch(SUPABASE_URL + "/rest/v1/Articles", {
      method: "POST",
      headers: Object.assign({ Prefer: "return=minimal" }, headers),
      body: JSON.stringify({
        titre: item.title,
        categorie: "Banques & Finance",
        auteur: "BCEAO",
        image_url: "",
        contenu: articleBody(item)
      })
    });
    if (response.ok) {
      created += 1;
      known.add(item.url);
      known.add(fold(item.title));
    }
  }
  return created;
}

export default async function handler(req, res) {
  try {
    const html = await fetchText(LIST_URL);
    const listed = parseList(html);
    const detailed = await Promise.all(
      listed.map(async function (item) {
        try {
          const page = await fetchText(item.url);
          return parseArticle(page, item);
        } catch (error) {
          return {
            title: item.title,
            date: item.date,
            url: item.url,
            excerpt: "",
            pdf: "",
            paragraphs: []
          };
        }
      })
    );

    const items = detailed.filter(function (item) {
      return item.title && item.url;
    });

    let published = 0;
    try {
      published = await publishNew(items);
    } catch (error) {
      console.error(error);
    }

    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=120");
    return res.status(200).json({
      source: LIST_URL,
      updatedAt: new Date().toISOString(),
      published: published,
      items: items.map(function (item) {
        return {
          title: item.title,
          date: item.date,
          url: item.url,
          excerpt: item.excerpt,
          pdf: item.pdf
        };
      })
    });
  } catch (error) {
    console.error(error);
    return res.status(502).json({ error: "Communiqués BCEAO indisponibles." });
  }
}
