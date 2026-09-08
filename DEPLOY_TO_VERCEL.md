# Deploy HyperDect to Vercel

This project is ready for Vercel. The app reads the bundled synthetic dataset
from `public/data/random_forest_ready_dataset.csv` through the Vercel API route
at `/api/dataset`.

## 1. Prepare the Dataset

The deployable dataset is already copied to:

```text
public/data/random_forest_ready_dataset.csv
```

If you regenerate the synthetic dataset later, copy the new file from:

```text
synthetic_dataset/03_modeling/random_forest_ready_dataset.csv
```

into:

```text
public/data/random_forest_ready_dataset.csv
```

## 2. Deploy

From this folder:

```powershell
vercel
```

For production:

```powershell
vercel --prod
```

## Optional Gemini LLM Support

The app includes `/api/explain` for the HyperDect LLM component. Gemini is used
for checklist interpretation, risk reasoning support, a health-awareness
message, regional context summary, and a professional screening note. Without
an API key, the app uses local fallback text for the same sections so the
deployment still works.

To enable real Gemini-generated LLM support in Vercel, add:

```text
GEMINI_API_KEY=your_gemini_api_key
```

Optional:

```text
GEMINI_MODEL=gemini-3.6-flash
```

## Important Note

HyperDect is a screening-support and health-awareness prototype. It is not for
diagnosing or treating hypertension and should not replace guidance from a
licensed health professional.
