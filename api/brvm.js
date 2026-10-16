const PAGES = {
  actions: "https://www.brvm.org/fr/cours-actions/0",
  indices: "https://www.brvm.org/fr/indices",
  obligations: "https://www.brvm.org/fr/cours-obligations/0"
};

function decode(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, function (_, code) {
      return String.fromCharCode(Number(code));
    })
    .replace(/&#x([0-9a-f]+);/gi, function (_, code) {
      return String.fromCharCode(parseInt(code, 16));
    })
    .replace(/\s+/g, " ")
    .trim();
}

function tables(html) {
  return [...String(html).matchAll(/<table[\s\S]*?<\/table>/gi)].map(function (match) {
    return match[0];
  });
}

function cells(row) {
  return [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(function (cell) {
    return decode(cell[1]);
  });
}

function bodyRows(table) {
  const body = (table.split(/<tbody>/i)[1] || "").split(/<\/tbody>/i)[0];
  return [...body.matchAll(/<tr[\s\S]*?<\/tr>/gi)]
    .map(function (row) {
      return cells(row[0]);
    })
    .filter(function (row) {
      return row.length > 1;
    });
}

function updatedAt(html) {
  const match = String(html).match(/Dernière mise à jour\s*:?\s*([^<]+)/i);
  return match ? decode(match[1]) : "";
}

function parseActions(html) {
  const table = tables(html).find(function (item) {
    return /Cours Clôture/i.test(item);
  });
  if (!table) return [];
  return bodyRows(table).map(function (row) {
    return {
      symbol: row[0] || "",
      name: row[1] || "",
      volume: row[2] || "",
      previous: row[3] || "",
      open: row[4] || "",
      last: row[5] || "",
      change: row[6] || ""
    };
  });
}

function parseIndices(html) {
  const main = String(html).split('id="block-system-main"')[1] || html;
  const chunks = main.split(/<h2 class="block-title">/i);
  const groups = ["Majeurs", "Sectoriels", "Rendement"];
  const indices = [];

  chunks.forEach(function (chunk, index) {
    const title = index === 0 ? groups[0] : decode(chunk.split("</h2>")[0]);
    const group = /sector/i.test(title)
      ? "Sectoriels"
      : /return|rendement/i.test(title)
        ? "Rendement"
        : "Majeurs";
    tables(chunk).forEach(function (table) {
      if (!/Fermeture/i.test(table)) return;
      bodyRows(table).forEach(function (row) {
        indices.push({
          group: group,
          name: row[0] || "",
          previous: row[1] || "",
          last: row[2] || "",
          change: row[3] || "",
          year: row[4] || ""
        });
      });
    });
  });

  return indices;
}

function parseBonds(html) {
  const table = tables(html).find(function (item) {
    return /Code obligation/i.test(item);
  });
  if (!table) return [];
  return bodyRows(table).map(function (row) {
    return {
      code: row[0] || "",
      name: row[1] || "",
      issued: row[2] || "",
      maturity: row[3] || "",
      last: row[4] || "",
      accrued: row[5] || "",
      coupon: row[6] || ""
    };
  });
}

async function load(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "LeFinancierIvoirien/1.0",
      Accept: "text/html"
    }
  });
  if (!response.ok) {
    throw new Error("BRVM " + response.status);
  }
  return response.text();
}

export default async function handler(req, res) {
  try {
    const [actionsHtml, indicesHtml, bondsHtml] = await Promise.all([
      load(PAGES.actions),
      load(PAGES.indices),
      load(PAGES.obligations)
    ]);

    const payload = {
      updatedAt: updatedAt(actionsHtml) || updatedAt(indicesHtml),
      source: "https://www.brvm.org",
      indices: parseIndices(indicesHtml),
      actions: parseActions(actionsHtml),
      obligations: parseBonds(bondsHtml)
    };

    if (!payload.actions.length && !payload.indices.length) {
      return res.status(502).json({ error: "Cours BRVM indisponibles." });
    }

    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json(payload);
  } catch (error) {
    console.error(error);
    return res.status(502).json({ error: "Impossible de joindre la BRVM." });
  }
}
