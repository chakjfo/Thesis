const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

function percent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function fallbackExplanation(payload) {
  const selectedFactors = payload.checklist?.selectedFactors?.length
    ? payload.checklist.selectedFactors.join(", ")
    : "no checklist risk factors selected";
  const topFactors = payload.topRegionalFactors?.length
    ? payload.topRegionalFactors
        .map((factor) => `${factor.label} (${percent(factor.value)})`)
        .join(", ")
    : "the available regional factors";

  return (
    `The user's checklist record shows ${selectedFactors}, giving a ${String(payload.riskCategory).toLowerCase()} screening-support category. ` +
    `As added background only, the dataset for ${payload.area} shows a ${percent(payload.regionalRiskScore)} regional risk-factor indicator. ` +
    `The strongest recorded regional factors are ${topFactors}. ` +
    "This regional information helps health professionals understand the community context, but the user's screening score is based on the user's own checklist record. " +
    "This is not a diagnosis. It is meant to support early awareness and encourage follow-up with a health worker or licensed clinician."
  );
}

function buildPrompt(payload) {
  return `
You are the explanation component of HyperDect, a prototype hypertension screening-support system.

HyperDect is for health awareness and screening support only. It must not diagnose, treat, or replace advice from a licensed health professional.

Write one short plain-English paragraph for the user.
Keep it brief: 3 to 5 sentences only.
Use careful wording such as "may indicate", "screening-support result", and "consider consulting a health worker".
Do not say the user has hypertension.
The user's screening score must be explained as based on the user's own checklist record.
The regional dataset must be described only as added background/context about recorded community-level risk-factor patterns.
Do not imply that the selected region determines whether the user has hypertension.
Use the dataset details below, especially the strongest regional factors, as contextual information for health professionals.

Input:
- Region: ${payload.area}
- Population group: ${payload.populationGroup}
- Screening risk category: ${payload.riskCategory}
- User checklist screening score: ${percent(payload.score)}
- Regional background risk-factor indicator: ${percent(payload.regionalRiskScore)}
- Matching records for selected region/group: ${payload.rowCount}
- Total syntheticized dataset records: ${payload.totalRecords}
- Selected checklist factors: ${payload.checklist?.selectedFactors?.join(", ") || "none"}
- Strongest regional dataset factors: ${
    payload.topRegionalFactors?.map((factor) => `${factor.label} ${percent(factor.value)}`).join(", ") || "none"
  }

Regional factor rates:
- Smoking history: ${percent(payload.regionalRates?.smoking_history)}
- Binge drinking: ${percent(payload.regionalRates?.binge_drinking)}
- Insufficient physical activity: ${percent(payload.regionalRates?.insufficient_physical_activity)}
- Unhealthy diet: ${percent(payload.regionalRates?.unhealthy_diet)}
- Overweight: ${percent(payload.regionalRates?.overweight)}
- Obesity: ${percent(payload.regionalRates?.obesity)}
`.trim();
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  const payload = request.body || {};

  if (!process.env.GEMINI_API_KEY) {
    response.status(200).json({
      explanation: fallbackExplanation(payload),
      source: "local-fallback",
      reason: "GEMINI_API_KEY is missing in this deployment.",
    });
    return;
  }

  try {
    const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: buildPrompt(payload),
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 180,
          temperature: 0.4,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      response.status(200).json({
        explanation: fallbackExplanation(payload),
        source: "local-fallback",
        reason: `Gemini request failed with status ${geminiResponse.status}.`,
        detail: errorText.slice(0, 500),
      });
      return;
    }

    const data = await geminiResponse.json();
    const explanation = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .filter(Boolean)
      .join(" ")
      .trim();

    response.status(200).json({
      explanation: explanation || fallbackExplanation(payload),
      source: explanation ? "llm" : "local-fallback",
      provider: explanation ? "gemini" : undefined,
      model: explanation ? model : undefined,
      reason: explanation ? undefined : "Gemini returned an empty explanation.",
    });
  } catch (error) {
    response.status(200).json({
      explanation: fallbackExplanation(payload),
      source: "local-fallback",
      reason: error.message,
    });
  }
}
