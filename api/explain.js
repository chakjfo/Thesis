const OPENAI_API_URL = "https://api.openai.com/v1/responses";

function percent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function fallbackExplanation(payload) {
  const selectedFactors = payload.checklist?.selectedFactors?.length
    ? payload.checklist.selectedFactors.join(", ")
    : "no checklist risk factors selected";

  return (
    `For ${payload.area}, the regional background risk score is ${percent(payload.regionalRiskScore)}. ` +
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
Use careful wording such as "may indicate", "screening-support result", and "consider consulting a health worker".
Do not say the user has hypertension.

Input:
- Region: ${payload.area}
- Population group: ${payload.populationGroup}
- Screening risk category: ${payload.riskCategory}
- Screening score: ${percent(payload.score)}
- Regional background risk score: ${percent(payload.regionalRiskScore)}
- Regional records used: ${payload.rowCount}
- Selected checklist factors: ${payload.checklist?.selectedFactors?.join(", ") || "none"}

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

  if (!process.env.OPENAI_API_KEY) {
    response.status(200).json({
      explanation: fallbackExplanation(payload),
      source: "local-fallback",
      reason: "OPENAI_API_KEY is missing in this deployment.",
    });
    return;
  }

  try {
    const openaiResponse = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        input: buildPrompt(payload),
        max_output_tokens: 180,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      response.status(200).json({
        explanation: fallbackExplanation(payload),
        source: "local-fallback",
        reason: `OpenAI request failed with status ${openaiResponse.status}.`,
        detail: errorText.slice(0, 500),
      });
      return;
    }

    const data = await openaiResponse.json();
    const explanation =
      data.output_text ||
      data.output?.flatMap((item) => item.content || [])
        .map((content) => content.text)
        .filter(Boolean)
        .join(" ")
        .trim();

    response.status(200).json({
      explanation: explanation || fallbackExplanation(payload),
      source: explanation ? "llm" : "local-fallback",
      reason: explanation ? undefined : "OpenAI returned an empty explanation.",
    });
  } catch (error) {
    response.status(200).json({
      explanation: fallbackExplanation(payload),
      source: "local-fallback",
      reason: error.message,
    });
  }
}
