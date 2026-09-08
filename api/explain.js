const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

function percent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function fallbackSections(payload) {
  const selectedFactors = payload.checklist?.selectedFactors?.length
    ? payload.checklist.selectedFactors.join(", ")
    : "no checklist risk factors selected";
  const topFactors = payload.topRegionalFactors?.length
    ? payload.topRegionalFactors
        .map((factor) => `${factor.label} (${percent(factor.value)})`)
        .join(", ")
    : "the available regional factors";

  return {
    checklistInterpretation: `The user's checklist record includes ${selectedFactors}.`,
    riskReasoning: `The checklist result places the user in the ${String(payload.riskCategory).toLowerCase()} screening-support category with a score of ${percent(payload.score)}.`,
    awarenessMessage: "This result is not a diagnosis and may be used to support early awareness and follow-up screening.",
    regionalContext: `As added background only, the dataset for ${payload.area} shows a ${percent(payload.regionalRiskScore)} regional risk-factor indicator, with strongest recorded factors of ${topFactors}.`,
    professionalNote: "Health professionals may review this checklist result with direct measurements such as blood pressure when available, while using regional records only as community-level context.",
  };
}

function sectionsToExplanation(sections) {
  return [
    sections.checklistInterpretation,
    sections.riskReasoning,
    sections.awarenessMessage,
    sections.regionalContext,
    sections.professionalNote,
  ].filter(Boolean).join(" ");
}

function buildPrompt(payload) {
  return `
You are the LLM component of HyperDect, a prototype hypertension screening-support system.

HyperDect is for health awareness and screening support only. It must not diagnose, treat, or replace advice from a licensed health professional.

Return only valid minified JSON. Do not use markdown. Do not wrap it in code fences.
Use these exact keys:
checklistInterpretation, riskReasoning, awarenessMessage, regionalContext, professionalNote

Each value must be 1 brief sentence.
Use careful wording such as "may indicate", "screening-support result", and "consider consulting a health worker".
Do not say the user has hypertension.
The user's screening score must be explained as based on the user's own checklist record.
The regional dataset must be described only as added background/context about recorded community-level risk-factor patterns.
Do not imply that the selected region determines whether the user has hypertension.

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

function parseGeminiSections(text) {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");
  const jsonText = jsonStart >= 0 && jsonEnd > jsonStart
    ? cleaned.slice(jsonStart, jsonEnd + 1)
    : cleaned;
  const parsed = JSON.parse(jsonText);

  return {
    checklistInterpretation: String(parsed.checklistInterpretation || "").trim(),
    riskReasoning: String(parsed.riskReasoning || "").trim(),
    awarenessMessage: String(parsed.awarenessMessage || "").trim(),
    regionalContext: String(parsed.regionalContext || "").trim(),
    professionalNote: String(parsed.professionalNote || "").trim(),
  };
}

function geminiTextToSections(text, payload) {
  if (!text) {
    return {
      sections: fallbackSections(payload),
      parsed: false,
    };
  }

  try {
    return {
      sections: parseGeminiSections(text),
      parsed: true,
    };
  } catch (error) {
    return {
      sections: {
        ...fallbackSections(payload),
        riskReasoning: text.trim(),
      },
      parsed: false,
      reason: "Gemini returned text instead of valid JSON, so the text was kept as the risk reasoning section.",
    };
  }
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  const payload = request.body || {};

  if (!process.env.GEMINI_API_KEY) {
    const sections = fallbackSections(payload);
    response.status(200).json({
      explanation: sectionsToExplanation(sections),
      sections,
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
          maxOutputTokens: 320,
          temperature: 0.4,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      const sections = fallbackSections(payload);
      response.status(200).json({
        explanation: sectionsToExplanation(sections),
        sections,
        source: "local-fallback",
        reason: `Gemini request failed with status ${geminiResponse.status}.`,
        detail: errorText.slice(0, 500),
      });
      return;
    }

    const data = await geminiResponse.json();
    const text = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .filter(Boolean)
      .join(" ")
      .trim();
    const parsedResult = geminiTextToSections(text, payload);

    response.status(200).json({
      explanation: sectionsToExplanation(parsedResult.sections),
      sections: parsedResult.sections,
      source: text ? "llm" : "local-fallback",
      provider: text ? "gemini" : undefined,
      model: text ? model : undefined,
      reason: text ? parsedResult.reason : "Gemini returned an empty explanation.",
    });
  } catch (error) {
    const sections = fallbackSections(payload);
    response.status(200).json({
      explanation: sectionsToExplanation(sections),
      sections,
      source: "local-fallback",
      reason: error.message,
    });
  }
}
