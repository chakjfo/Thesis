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
    `For ${payload.area}, the regional background risk score is ${percent(payload.regionalRiskScore)}. ` +
    `In the dataset, the strongest regional factors are ${topFactors}. ` +
    `Your checklist shows ${selectedFactors}. Based on these screening-support inputs, ` +
    `HyperDect places the result in the ${String(payload.riskCategory).toLowerCase()} risk category. ` +
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
Use the dataset details below, especially the strongest regional factors.

Input:
- Region: ${payload.area}
- Population group: ${payload.populationGroup}
- Screening risk category: ${payload.riskCategory}
- Screening score: ${percent(payload.score)}
- Regional background risk score: ${percent(payload.regionalRiskScore)}
- Regional records used: ${payload.rowCount}
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
