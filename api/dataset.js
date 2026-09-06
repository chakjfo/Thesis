import { readFile } from "node:fs/promises";
import path from "node:path";

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

const DATASET_PATH = path.join(process.cwd(), "public", "data", "random_forest_ready_dataset.csv");

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
  try {
    const csvText = await readFile(DATASET_PATH, "utf-8");
    const records = parseCsv(csvText).map(normalizeRecord);
    response.status(200).json({
      records,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    response.status(500).json({
      error: "Unable to load the bundled synthetic dataset.",
      detail: error.message,
    });
  }
}
