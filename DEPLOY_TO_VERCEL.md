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

## Important Note

HyperDect is a screening-support and health-awareness prototype. It is not for
diagnosing or treating hypertension and should not replace guidance from a
licensed health professional.
