const FACTORS = [
  ["smoking_history", "Smoking history", "regional_smoking_history_rate"],
  ["binge_drinking", "Binge drinking", "regional_binge_drinking_rate"],
  ["insufficient_physical_activity", "Lack of exercise", "regional_insufficient_physical_activity_rate"],
  ["unhealthy_diet", "Unhealthy diet", "regional_unhealthy_diet_rate"],
  ["overweight", "Overweight", "regional_overweight_rate"],
  ["obesity", "Obesity", "regional_obesity_rate"],
];

const state = {
  records: [],
};

const areaSelect = document.querySelector("#area-select");
const populationSelect = document.querySelector("#population-select");
const form = document.querySelector("#screening-form");
const dataStatus = document.querySelector("#data-status");
const riskCategory = document.querySelector("#risk-category");
const riskScore = document.querySelector("#risk-score");
const riskExplanation = document.querySelector("#risk-explanation");
const explanationSource = document.querySelector("#explanation-source");
const metricsGrid = document.querySelector("#metrics-grid");

function percent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function titleRisk(score) {
  if (score >= 0.55) return "High";
  if (score >= 0.32) return "Moderate";
  return "Low";
}

function average(values) {
  const valid = values.map(Number).filter(Number.isFinite);
  if (valid.length === 0) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function summarizeRegion(area, populationGroup) {
  const regionRows = state.records.filter(
    (record) => record.Area === area && record.population_group === populationGroup,
  );
  const fallbackRows = state.records.filter((record) => record.Area === area);
  const rows = regionRows.length > 0 ? regionRows : fallbackRows;

  const summary = {
    area,
    populationGroup,
    rowCount: rows.length,
  };

  for (const [key, , column] of FACTORS) {
    summary[key] = average(rows.map((record) => record[column]));
  }

  summary.regionalRiskScore = average(rows.map((record) => record.regional_risk_score));
  return summary;
}

function checklistScore(formData) {
  const checked = FACTORS.filter(([key]) => formData.get(key) === "on");
  return {
    count: checked.length,
    names: checked.map(([, label]) => label),
    score: checked.length / FACTORS.length,
  };
}

function computeScreening(summary, checklist) {
  const finalScore = Math.min(1, (summary.regionalRiskScore * 0.55) + (checklist.score * 0.45));
  return {
    score: finalScore,
    category: titleRisk(finalScore),
  };
}

function renderMetrics(summary) {
  metricsGrid.innerHTML = FACTORS.map(([, label, column]) => {
    const key = column.replace("regional_", "").replace("_rate", "");
    const value = summary[key];
    return `
      <div class="metric">
        <span>${label}</span>
        <strong>${percent(value)}</strong>
      </div>
    `;
  }).join("");
}

function renderResult(summary, checklist, result) {
  riskCategory.textContent = result.category;
  riskCategory.className = `risk-${result.category.toLowerCase()}`;
  riskScore.textContent = `Screening score: ${percent(result.score)} based on ${summary.rowCount.toLocaleString()} regional records.`;

  const selectedFactors = checklist.names.length > 0
    ? checklist.names.join(", ")
    : "no checklist risk factors selected";

  explanationSource.textContent = "Local fallback";
  riskExplanation.textContent = `For ${summary.area}, the regional background score is ${percent(summary.regionalRiskScore)}. Your checklist shows ${selectedFactors}. HyperDect combines those inputs to produce a ${result.category.toLowerCase()} screening-support category. This result is for awareness and early risk checking only.`;

  renderMetrics(summary);
}

async function renderLlmExplanation(summary, checklist, result) {
  riskExplanation.textContent = "Generating plain-English explanation...";

  const payload = {
    area: summary.area,
    populationGroup: summary.populationGroup,
    rowCount: summary.rowCount,
    score: result.score,
    riskCategory: result.category,
    regionalRiskScore: summary.regionalRiskScore,
    regionalRates: {
      smoking_history: summary.smoking_history,
      binge_drinking: summary.binge_drinking,
      insufficient_physical_activity: summary.insufficient_physical_activity,
      unhealthy_diet: summary.unhealthy_diet,
      overweight: summary.overweight,
      obesity: summary.obesity,
    },
    checklist: {
      selectedFactors: checklist.names,
      selectedCount: checklist.count,
    },
  };

  try {
    const response = await fetch("/api/explain", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Unable to generate explanation.");
    }
    riskExplanation.textContent = data.explanation;
    explanationSource.textContent = data.source === "llm" ? "LLM via OpenAI" : "Local fallback";

    if (data.source !== "llm" && data.reason) {
      riskExplanation.textContent += ` Reason: ${data.reason}`;
    }
  } catch (error) {
    explanationSource.textContent = "Local fallback";
    renderResult(summary, checklist, result);
  }
}

function populateAreas() {
  const areas = [...new Set(state.records.map((record) => record.Area).filter(Boolean))].sort();
  areaSelect.innerHTML = areas.map((area) => `<option value="${area}">${area}</option>`).join("");
}

async function loadDataset() {
  try {
    const response = await fetch("/api/dataset");
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Unable to load dataset.");
    }

    state.records = payload.records;
    populateAreas();
    dataStatus.textContent = `${state.records.length.toLocaleString()} rows`;
  } catch (error) {
    dataStatus.textContent = "Dataset error";
    areaSelect.innerHTML = '<option value="">Dataset unavailable</option>';
    riskExplanation.textContent = error.message;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const area = formData.get("area");
  const populationGroup = formData.get("population_group");

  if (!area || state.records.length === 0) {
    return;
  }

  const summary = summarizeRegion(area, populationGroup);
  const checklist = checklistScore(formData);
  const result = computeScreening(summary, checklist);
  renderResult(summary, checklist, result);
  renderLlmExplanation(summary, checklist, result);
});

loadDataset();
