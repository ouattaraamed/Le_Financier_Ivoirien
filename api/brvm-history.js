const STOCKS = {
  ABJC: "ABJC.ci",
  BBGC: "BBGC.ci",
  BICB: "BICB.bj",
  BICC: "BICC.ci",
  BNBC: "BNBC.ci",
  BOAB: "BOAB.bj",
  BOABF: "BOABF.bf",
  BOAC: "BOAC.ci",
  BOAM: "BOAM.ml",
  BOAN: "BOAN.ne",
  BOAS: "BOAS.sn",
  CABC: "CABC.ci",
  CBIBF: "CBIBF.bf",
  CFAC: "CFAC.ci",
  CIEC: "CIEC.ci",
  ECOC: "ECOC.ci",
  ETIT: "ETIT.tg",
  FTSC: "FTSC.ci",
  LNBB: "LNBB.bj",
  NEIC: "NEIC.ci",
  NSBC: "NSBC.ci",
  NTLC: "NTLC.ci",
  ONTBF: "ONTBF.bf",
  ORAC: "ORAC.ci",
  ORGT: "ORGT.tg",
  PALC: "PALC.ci",
  PRSC: "PRSC.ci",
  SAFC: "SAFC.ci",
  SCRC: "SCRC.ci",
  SDCC: "SDCC.ci",
  SDSC: "SDSC.ci",
  SEMC: "SEMC.ci",
  SGBC: "SGBC.ci",
  SHEC: "SHEC.ci",
  SIBC: "SIBC.ci",
  SICC: "SICC.ci",
  SIVC: "SIVC.ci",
  SLBC: "SLBC.ci",
  SMBC: "SMBC.ci",
  SNTS: "SNTS.sn",
  SOGC: "SOGC.ci",
  SPHC: "SPHC.ci",
  STAC: "STAC.ci",
  STBC: "STBC.ci",
  TTLC: "TTLC.ci",
  TTLS: "TTLS.sn",
  UNLC: "UNLC.ci",
  UNXC: "UNXC.ci"
};

const INDICES = {
  BRVM30: "BRVM30",
  BRVMC: "BRVMC",
  BRVMCOMPOSITE: "BRVMC",
  BRVMPRESTIGE: "BRVMPR",
  BRVMPRINCIPAL: "BRVMPA",
  BRVMCONSOMMATIONDEBASE: "BRVM-CB",
  BRVMCONSOMMATIONDISCRETIONNAIRE: "BRVM-CD",
  BRVMENERGIE: "BRVM-EN",
  BRVMINDUSTRIELS: "BRVM-IN",
  BRVMSERVICESFINANCIERS: "BRVM-SF",
  BRVMSERVICESPUBLICS: "BRVM-SP",
  BRVMTELECOMMUNICATIONS: "BRVM-TEL"
};

function compact(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function resolveTicker(input) {
  const raw = String(input || "").trim().toUpperCase();
  if (STOCKS[raw]) return STOCKS[raw];
  const key = compact(raw);
  if (INDICES[key]) return INDICES[key];
  return null;
}

function isoDate(value) {
  const parts = String(value || "").split("/");
  if (parts.length !== 3) return null;
  const day = parts[0].padStart(2, "0");
  const month = parts[1].padStart(2, "0");
  return parts[2] + "-" + month + "-" + day;
}

function ymd(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

export default async function handler(req, res) {
  const ticker = resolveTicker(req.query.symbol || "BRVMC");
  if (!ticker) {
    return res.status(404).json({ error: "Titre sans historique." });
  }

  const end = new Date();
  const start = new Date(end.getTime() - 88 * 24 * 60 * 60 * 1000);

  try {
    const response = await fetch("https://www.sikafinance.com/api/general/GetHistos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
        Referer: "https://www.sikafinance.com/marches/historiques/" + ticker
      },
      body: JSON.stringify({
        ticker: ticker,
        datedeb: ymd(start),
        datefin: ymd(end),
        xperiod: "0"
      })
    });

    if (!response.ok) {
      return res.status(502).json({ error: "Historique indisponible." });
    }

    const payload = await response.json();
    const rows = Array.isArray(payload.lst) ? payload.lst : [];
    const candles = rows
      .map(function (row) {
        const time = isoDate(row.Date);
        if (!time) return null;
        return {
          time: time,
          open: Number(row.Open),
          high: Number(row.High),
          low: Number(row.Low),
          close: Number(row.Close),
          volume: Number(row.Volume) || 0
        };
      })
      .filter(function (row) {
        return row && Number.isFinite(row.close);
      });

    if (!candles.length) {
      return res.status(404).json({ error: "Pas de séances sur cette période." });
    }

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
    return res.status(200).json({
      symbol: ticker,
      source: "https://www.sikafinance.com",
      candles: candles
    });
  } catch (error) {
    console.error(error);
    return res.status(502).json({ error: "Historique indisponible." });
  }
}
