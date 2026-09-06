const REQUIRED_COLUMNS = [
  "Area",
  "population_group",
  "regional_smoking_history_rate",
  "regional_binge_drinking_rate",
  "regional_insufficient_physical_activity_rate",
  "regional_unhealthy_diet_rate",
  "regional_overweight_rate",
  "regional_obesity_rate",
  "regional_risk_score",
  "screening_risk_category",
];

function normalizeGoogleSheetCsvUrl(value) {
  const url = new URL(value);
  const match = url.pathname.match(/\/spreadsheets\/d\/([^/]+)/);

  if (!match) {
    return value;
  }

  const sheetId = match[1];
  const hashGid = url.hash.match(/gid=(\d+)/);
  const gid = url.searchParams.get("gid") || (hashGid ? hashGid[1] : "0");
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== "")) {
    rows.push(row);
  }

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((values) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index] === undefined ? "" : values[index].trim();
    });
    return record;
  });
}

function normalizeRecord(record) {
  const normalized = { ...record };
  for (const column of REQUIRED_COLUMNS) {
    if (!(column in normalized)) {
      normalized[column] = "";
    }
  }

  for (const [key, value] of Object.entries(normalized)) {
    const numericValue = Number(value);
    if (value !== "" && Number.isFinite(numericValue)) {
      normalized[key] = numericValue;
    }
  }
  return normalized;
}

export default async function handler(request, response) {
  const sheetUrl = process.env.HYPERDECT_GOOGLE_SHEET_CSV_URL;

  if (!sheetUrl) {
    response.status(500).json({
      error: "Missing HYPERDECT_GOOGLE_SHEET_CSV_URL environment variable.",
    });
    return;
  }

  try {
    const csvUrl = normalizeGoogleSheetCsvUrl(sheetUrl);
    const sheetResponse = await fetch(csvUrl);
    if (!sheetResponse.ok) {
      response.status(502).json({
        error: `Google Sheet request failed with status ${sheetResponse.status}.`,
        hint: "Check that the sheet is shared publicly or published to the web.",
      });
      return;
    }

    const csvText = await sheetResponse.text();
    if (csvText.trim().startsWith("<")) {
      response.status(502).json({
        error: "Google returned a web page instead of CSV data.",
        hint: "Publish the sheet to the web or set sharing so anyone with the link can view it.",
      });
      return;
    }

    const records = parseCsv(csvText).map(normalizeRecord);
    response.status(200).json({
      records,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    response.status(500).json({
      error: "Unable to load the Google Sheet dataset.",
      detail: error.message,
    });
  }
}
