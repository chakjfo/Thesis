# Deploy HyperDect to Vercel

This project is ready for Vercel. The app reads the dataset from a published
Google Sheet CSV URL through the Vercel API route at `/api/dataset`.

## 1. Prepare the Google Sheet

1. Open `synthetic_dataset/03_modeling/random_forest_ready_dataset.csv`.
2. Upload or import it into Google Sheets.
3. Publish or expose the sheet as CSV.
4. Copy the CSV export URL.

The URL should look similar to:

```text
https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/export?format=csv&gid=YOUR_GID
```

## 2. Add the Vercel environment variable

In Vercel Project Settings, add:

```text
HYPERDECT_GOOGLE_SHEET_CSV_URL=your_google_sheet_csv_export_url
```

Use the same variable name for Production and Preview if you want both
deployments to read the same dataset.

## 3. Deploy

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
