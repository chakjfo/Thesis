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
const llmGrid = document.querySelector("#llm-grid");
const metricsGrid = document.querySelector("#metrics-grid");
const evaluationStatus = document.querySelector("#evaluation-status");
const evaluationGrid = document.querySelector("#evaluation-grid");

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
    totalRecords: state.records.length,
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

function topRegionalFactors(summary) {
  return FACTORS.map(([key, label]) => ({
    key,
    label,
    value: summary[key],
  }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);
}

function computeScreening(summary, checklist) {
  const finalScore = Math.min(1, checklist.score);
  return {
    score: finalScore,
    category: titleRisk(finalScore),
  };
}

function preventionRecommendationsFor(factors = []) {
  const recommendationMap = {
    "Smoking history": "avoid smoking exposure and seek support from a health worker if quitting is needed",
    "Binge drinking": "limit alcohol intake and avoid binge drinking patterns",
    "Lack of exercise": "add regular physical activity that fits the user's capacity",
    "Unhealthy diet": "choose more balanced meals with less salty, fatty, or highly processed food",
    Overweight: "work toward gradual weight management through food choices and movement",
    Obesity: "ask a health worker for weight-management guidance and follow-up screening",
  };

  const recommendations = factors
    .map((factor) => recommendationMap[factor])
    .filter(Boolean);

  if (recommendations.length === 0) {
    return "continue healthy habits and consider routine blood pressure screening when available";
  }

  return recommendations.join("; ");
}

function renderMetrics(summary) {
  metricsGrid.innerHTML = FACTORS.map(([, label, column]) => {
    const key = column.replace("regional_", "").replace("_rate", "");
    const value = summary[key];
    return `
      <div class="metric">
        <span>Regional ${label}</span>
        <strong>${percent(value)}</strong>
      </div>
    `;
  }).join("");
}

function renderResult(summary, checklist, result) {
  riskCategory.textContent = result.category;
  riskCategory.className = `risk-${result.category.toLowerCase()}`;
  riskScore.textContent = `Screening score: ${percent(result.score)} based on the user's checklist record. Regional background reference: ${summary.rowCount.toLocaleString()} matching records from ${summary.area}; dataset total: ${summary.totalRecords.toLocaleString()} records.`;

  const selectedFactors = checklist.names.length > 0
    ? checklist.names.join(", ")
    : "no checklist risk factors selected";
  const topFactors = topRegionalFactors(summary)
    .map((factor) => `${factor.label} (${percent(factor.value)})`)
    .join(", ");

  explanationSource.textContent = "Local fallback";
  riskExplanation.textContent = `The user's checklist record shows ${selectedFactors}, giving a ${result.category.toLowerCase()} screening-support category. As added background only, the dataset for ${summary.area} shows a ${percent(summary.regionalRiskScore)} regional risk-factor indicator, with the strongest recorded factors being ${topFactors}. This regional information helps health professionals understand the community context, but the user's screening score is based on the user's own checklist record.`;
  renderLlmSections({
    checklistInterpretation: `The user's checklist record includes ${selectedFactors}.`,
    riskReasoning: `The checklist result places the user in the ${result.category.toLowerCase()} screening-support category with a score of ${percent(result.score)}.`,
    awarenessMessage: "This result is not a diagnosis and may be used to support early awareness and follow-up screening.",
    preventionRecommendations: `For the selected factors, the user may consider these prevention steps: ${preventionRecommendationsFor(checklist.names)}.`,
    regionalContext: `The dataset for ${summary.area} is used only as background context and shows strongest regional factors of ${topFactors}.`,
    professionalNote: "Health professionals may review this result together with direct measurements such as blood pressure when available.",
  });

  renderMetrics(summary);
}

function renderLlmSections(sections = {}) {
  const items = [
    ["Checklist Interpretation", sections.checklistInterpretation],
    ["Risk Reasoning Support", sections.riskReasoning],
    ["Health Awareness Message", sections.awarenessMessage],
    ["Prevention Recommendations", sections.preventionRecommendations],
    ["Regional Context Summary", sections.regionalContext],
    ["Professional Screening Note", sections.professionalNote],
  ];

  llmGrid.innerHTML = items.map(([title, text]) => `
    <div class="llm-card">
      <span>${title}</span>
      <p>${text || "No section generated."}</p>
    </div>
  `).join("");
}

async function renderLlmExplanation(summary, checklist, result) {
  riskExplanation.textContent = "Generating plain-English explanation...";
  llmGrid.innerHTML = "";

  const payload = {
    area: summary.area,
    populationGroup: summary.populationGroup,
    rowCount: summary.rowCount,
    totalRecords: summary.totalRecords,
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
    topRegionalFactors: topRegionalFactors(summary),
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
    renderLlmSections(data.sections);
    explanationSource.textContent = data.source === "llm" ? "LLM via Gemini" : "Local fallback";

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

function metricPercent(value) {
  return `${(Number(value || 0) * 100).toFixed(2)}%`;
}

async function loadEvaluation() {
  try {
    const response = await fetch("/data/evaluation/random_forest_metrics.json");
    if (!response.ok) {
      throw new Error("Evaluation unavailable.");
    }

    const metrics = await response.json();
    evaluationGrid.innerHTML = [
      ["Accuracy", metricPercent(metrics.accuracy)],
      ["Precision", metricPercent(metrics.precision_weighted)],
      ["Recall", metricPercent(metrics.recall_weighted)],
      ["F1 Score", metricPercent(metrics.f1_weighted)],
      ["Training Time", `${Number(metrics.training_time_seconds).toFixed(2)}s`],
      ["Test Rows", Number(metrics.test_rows).toLocaleString()],
    ].map(([label, value]) => `
      <div class="evaluation-metric">
        <span>${label}</span>
        <strong>${value}</strong>
      </div>
    `).join("");
    evaluationStatus.textContent = "Loaded";
  } catch (error) {
    evaluationStatus.textContent = "Unavailable";
    evaluationGrid.innerHTML = "";
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
loadEvaluation();
