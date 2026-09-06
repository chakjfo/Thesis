from pathlib import Path

import numpy as np
import pandas as pd

"""
HyperDect data pipeline.

This script prepares regional non-communicable disease risk-factor data for a
prototype hypertension screening-support system. The current data is regional
aggregate data, not individual patient records, so this pipeline creates
syntheticized records for experimentation before the LLM and Random Forest
framework stages.
"""


INPUT_WORKBOOK = Path("NCD_2025_Risk_Factors_AD_SC.xlsx")
OUTPUT_DIR = Path("synthetic_dataset")
CLEANED_OUTPUT_DIR = OUTPUT_DIR / "01_cleaned"
SYNTHETICIZED_OUTPUT_DIR = OUTPUT_DIR / "02_syntheticized"
MODELING_OUTPUT_DIR = OUTPUT_DIR / "03_modeling"
OUTPUT_WORKBOOK = OUTPUT_DIR / "NCD_2025_Risk_Factors_AD_SC_synthetic.xlsx"
ROWS_PER_SHEET = 2000
RANDOM_SEED = 20250904


META_ROWS = 3
HEADER_ROW = 3
SOURCE_FOLDER_COL = "Source Folder"
SOURCE_FILE_COL = "Source File"
AREA_COL = "Area"
YEAR_COL = "Year (coverage)"
POPULATION_COL = "Risk-assessed Population"
SYNTHETIC_LABEL = "Synthetic"
PROJECT_NAME = "HyperDect"
SCREENING_NOTE = (
    "HyperDect is for hypertension screening support and health awareness only. "
    "It must not diagnose, treat, or replace advice from a licensed health professional."
)

CHECKLIST_FACTORS = {
    "smoking_history": [
        "With history of smoking (Female)",
        "With history of smoking (Male)",
    ],
    "binge_drinking": [
        "Binge Drinkers (Female)",
        "Binge Drinkers (Male)",
    ],
    "insufficient_physical_activity": [
        "With Insufficient Physical Activity (Female)",
        "With Insufficient Physical Activity (Male)",
    ],
    "unhealthy_diet": [
        "Consumed Unhealthy Diet (Female)",
        "Consumed Unhealthy Diet (Male)",
    ],
    "overweight": [
        "Overweight (Female)",
        "Overweight (Male)",
    ],
    "obesity": [
        "Obese (Female)",
        "Obese (Male)",
    ],
}


def read_sheet(sheet_name: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    raw = pd.read_excel(INPUT_WORKBOOK, sheet_name=sheet_name, header=None)
    metadata = raw.iloc[:META_ROWS].copy()
    data = pd.read_excel(INPUT_WORKBOOK, sheet_name=sheet_name, header=HEADER_ROW)
    data = data.dropna(how="all").reset_index(drop=True)
    return metadata, data


def numeric_columns(data: pd.DataFrame) -> list[str]:
    excluded = {YEAR_COL, SOURCE_FOLDER_COL, SOURCE_FILE_COL, AREA_COL}
    return [col for col in data.columns if col not in excluded]


def clean_dataset(data: pd.DataFrame) -> pd.DataFrame:
    """Prepare the original dataset before synthetic data generation."""
    cleaned = data.copy()
    cleaned = cleaned.dropna(how="all").reset_index(drop=True)

    for col in cleaned.columns:
        if cleaned[col].dtype == "object":
            cleaned[col] = cleaned[col].astype(str).str.strip()
            cleaned[col] = cleaned[col].replace({"": np.nan, "nan": np.nan, "None": np.nan})

    for col in numeric_columns(cleaned):
        cleaned[col] = pd.to_numeric(cleaned[col], errors="coerce")

    cleaned[POPULATION_COL] = cleaned[POPULATION_COL].fillna(cleaned[POPULATION_COL].median())
    cleaned[POPULATION_COL] = cleaned[POPULATION_COL].clip(lower=1).round().astype(int)

    risk_columns = [col for col in numeric_columns(cleaned) if col != POPULATION_COL]
    for col in risk_columns:
        cleaned[col] = cleaned[col].fillna(0).clip(lower=0)
        cleaned[col] = cleaned[[col, POPULATION_COL]].min(axis=1).round().astype(int)

    return cleaned


def choose_population(area_rows: pd.DataFrame, fallback_rows: pd.DataFrame, rng: np.random.Generator) -> int:
    source = area_rows if len(area_rows) >= 3 else fallback_rows
    populations = source[POPULATION_COL].dropna().astype(float)
    if populations.empty:
        return 1

    base = float(rng.choice(populations.to_numpy()))
    variation = float(rng.normal(loc=1.0, scale=0.12))
    population = round(base * np.clip(variation, 0.65, 1.45))
    return max(1, int(population))


def build_rate_lookup(data: pd.DataFrame, risk_columns: list[str]) -> dict[str, dict[str, np.ndarray]]:
    lookup: dict[str, dict[str, np.ndarray]] = {}
    fallback: dict[str, np.ndarray] = {}

    for column in risk_columns:
        valid = data[[column, POPULATION_COL]].dropna()
        valid = valid[valid[POPULATION_COL] > 0]
        fallback[column] = (
            (valid[column].astype(float) / valid[POPULATION_COL].astype(float)).clip(0, 1).to_numpy()
        )

    lookup["__fallback__"] = fallback
    for area, rows in data.groupby(AREA_COL):
        area_rates: dict[str, np.ndarray] = {}
        for column in risk_columns:
            valid = rows[[column, POPULATION_COL]].dropna()
            valid = valid[valid[POPULATION_COL] > 0]
            area_rates[column] = (
                (valid[column].astype(float) / valid[POPULATION_COL].astype(float)).clip(0, 1).to_numpy()
            )
        lookup[str(area)] = area_rates

    return lookup


def choose_count(column: str, area: str, rates: dict[str, dict[str, np.ndarray]], population: int, rng: np.random.Generator) -> int:
    area_rates = rates.get(area, {}).get(column, np.array([]))
    source_rates = area_rates if len(area_rates) >= 3 else rates["__fallback__"].get(column, np.array([]))
    if len(source_rates) == 0:
        return 0

    rate = float(rng.choice(source_rates))
    rate = float(np.clip(rng.normal(loc=rate, scale=max(0.01, rate * 0.15)), 0, 1))
    return int(rng.binomial(population, rate))


def generate_synthetic_dataset(sheet_name: str, data: pd.DataFrame, row_count: int, seed: int) -> pd.DataFrame:
    """Create new synthetic rows based on the cleaned dataset distribution."""
    rng = np.random.default_rng(seed)
    generated_rows = []
    areas = data[AREA_COL].dropna().astype(str).unique()
    years = data[YEAR_COL].dropna().astype(str).unique()
    risk_columns = [col for col in numeric_columns(data) if col != POPULATION_COL]
    area_groups = {str(area): rows for area, rows in data.groupby(AREA_COL)}
    rates = build_rate_lookup(data, risk_columns)

    for row_number in range(1, row_count + 1):
        area = str(rng.choice(areas))
        year = str(rng.choice(years))
        area_rows = area_groups.get(area, data.iloc[0:0])

        population = choose_population(area_rows, data, rng)
        row = {
            YEAR_COL: year,
            SOURCE_FOLDER_COL: SYNTHETIC_LABEL,
            SOURCE_FILE_COL: f"{sheet_name} synthetic row {row_number:04d}",
            AREA_COL: area,
            POPULATION_COL: population,
        }

        for column in risk_columns:
            row[column] = choose_count(column, area, rates, population, rng)

        generated_rows.append(row)

    return pd.DataFrame(generated_rows, columns=data.columns)


def syntheticize_dataset(original_data: pd.DataFrame, synthetic_data: pd.DataFrame) -> pd.DataFrame:
    """Combine cleaned real records with generated synthetic records."""
    return pd.concat([original_data, synthetic_data], ignore_index=True)


def factor_rate(data: pd.DataFrame, factor_columns: list[str]) -> pd.Series:
    available_columns = [col for col in factor_columns if col in data.columns]
    if not available_columns:
        return pd.Series(np.zeros(len(data)), index=data.index)

    counts = data[available_columns].sum(axis=1)
    denominator = data[POPULATION_COL].replace(0, np.nan) * len(available_columns)
    return (counts / denominator).fillna(0).clip(0, 1)


def add_framework_features(data: pd.DataFrame, population_group: str) -> pd.DataFrame:
    """Create encoded regional features for the LLM and Random Forest stages."""
    featured = data.copy()
    featured["population_group"] = population_group
    featured["is_synthetic"] = featured[SOURCE_FOLDER_COL].eq(SYNTHETIC_LABEL).astype(int)

    rate_columns = []
    for factor_name, columns in CHECKLIST_FACTORS.items():
        rate_col = f"regional_{factor_name}_rate"
        featured[rate_col] = factor_rate(featured, columns)
        rate_columns.append(rate_col)

    featured["regional_risk_score"] = featured[rate_columns].mean(axis=1).round(4)
    featured["screening_risk_category"] = pd.cut(
        featured["regional_risk_score"],
        bins=[-0.01, 0.20, 0.40, 1.00],
        labels=["Low", "Moderate", "High"],
    ).astype(str)
    return featured


def build_random_forest_frame(syntheticized_sheets: dict[str, pd.DataFrame]) -> pd.DataFrame:
    frames = []
    for sheet_name, data in syntheticized_sheets.items():
        population_group = "Adult" if sheet_name.endswith("AD") else "Senior Citizen"
        featured = add_framework_features(data, population_group)
        frames.append(
            featured[
                [
                    YEAR_COL,
                    AREA_COL,
                    "population_group",
                    "is_synthetic",
                    "regional_smoking_history_rate",
                    "regional_binge_drinking_rate",
                    "regional_insufficient_physical_activity_rate",
                    "regional_unhealthy_diet_rate",
                    "regional_overweight_rate",
                    "regional_obesity_rate",
                    "regional_risk_score",
                    "screening_risk_category",
                ]
            ]
        )

    return pd.concat(frames, ignore_index=True)


def run_llm_framework(syntheticized_sheets: dict[str, pd.DataFrame]) -> None:
    """Prepare files that the later LLM explanation step can use."""
    MODELING_OUTPUT_DIR.mkdir(exist_ok=True)
    summary_path = MODELING_OUTPUT_DIR / "llm_framework_prompt_template.txt"
    sheet_summaries = [
        f"{sheet_name}: {len(data)} rows, {len(data.columns)} columns"
        for sheet_name, data in syntheticized_sheets.items()
    ]
    summary_path.write_text(
        f"{PROJECT_NAME} LLM framework prompt template\n\n"
        f"{SCREENING_NOTE}\n\n"
        "Use the selected region's background risk-factor rates and the user's checklist answers.\n"
        "Explain the screening risk in plain English using careful, non-diagnostic language.\n"
        "Mention which checklist factors contributed most strongly to the risk explanation.\n"
        "Encourage consultation with a health worker or licensed clinician for medical decisions.\n\n"
        "Expected checklist fields:\n"
        "- smoking_history\n"
        "- binge_drinking\n"
        "- insufficient_physical_activity\n"
        "- unhealthy_diet\n"
        "- overweight\n"
        "- obesity\n\n"
        "Available syntheticized sheets:\n"
        + "\n".join(sheet_summaries)
        + "\n",
        encoding="utf-8",
    )


def run_random_forest_framework(syntheticized_sheets: dict[str, pd.DataFrame]) -> None:
    """Prepare encoded data for the later Random Forest framework step."""
    MODELING_OUTPUT_DIR.mkdir(exist_ok=True)
    model_frame = build_random_forest_frame(syntheticized_sheets)
    model_frame.to_csv(MODELING_OUTPUT_DIR / "random_forest_ready_dataset.csv", index=False)

    summary_path = MODELING_OUTPUT_DIR / "random_forest_framework_notes.txt"
    summary_path.write_text(
        f"{PROJECT_NAME} Random Forest framework notes\n\n"
        f"{SCREENING_NOTE}\n\n"
        "Created random_forest_ready_dataset.csv with encoded regional risk-factor rates.\n"
        "The current target column is screening_risk_category, derived from regional_risk_score.\n"
        "When real user checklist responses become available, append encoded checklist fields as features.\n"
        "Recommended next steps: train/test split, RandomForestClassifier training, evaluation, then comparison with LLM explanations.\n\n"
        f"Rows: {len(model_frame)}\n"
        f"Columns: {len(model_frame.columns)}\n"
        + "\n",
        encoding="utf-8",
    )


def sheet_with_metadata(metadata: pd.DataFrame, data: pd.DataFrame) -> pd.DataFrame:
    header = pd.DataFrame([list(data.columns)])
    body = pd.DataFrame(data.astype(object).where(pd.notna(data), None).to_numpy())
    return pd.concat([metadata, header, body], ignore_index=True)


def main() -> None:
    if not INPUT_WORKBOOK.exists():
        raise FileNotFoundError(f"Missing source workbook: {INPUT_WORKBOOK}")

    OUTPUT_DIR.mkdir(exist_ok=True)
    CLEANED_OUTPUT_DIR.mkdir(exist_ok=True)
    SYNTHETICIZED_OUTPUT_DIR.mkdir(exist_ok=True)
    sheet_names = pd.ExcelFile(INPUT_WORKBOOK).sheet_names

    sheets_to_write = []
    syntheticized_sheets: dict[str, pd.DataFrame] = {}
    for index, sheet_name in enumerate(sheet_names):
        print(f"Cleaning {sheet_name}...", flush=True)
        metadata, original_data = read_sheet(sheet_name)
        cleaned_data = clean_dataset(original_data)
        cleaned_data.to_csv(CLEANED_OUTPUT_DIR / f"{sheet_name.replace(' ', '_')}_cleaned.csv", index=False)

        print(f"Generating synthetic rows for {sheet_name}...", flush=True)
        synthetic_data = generate_synthetic_dataset(
            sheet_name=sheet_name,
            data=cleaned_data,
            row_count=ROWS_PER_SHEET,
            seed=RANDOM_SEED + index,
        )
        combined = syntheticize_dataset(cleaned_data, synthetic_data)
        combined.to_csv(SYNTHETICIZED_OUTPUT_DIR / f"{sheet_name.replace(' ', '_')}_syntheticized.csv", index=False)
        combined.to_csv(OUTPUT_DIR / f"{sheet_name.replace(' ', '_')}_synthetic.csv", index=False)
        sheets_to_write.append((sheet_name, metadata, combined))
        syntheticized_sheets[sheet_name] = combined

    with pd.ExcelWriter(OUTPUT_WORKBOOK, engine="openpyxl") as writer:
        for sheet_name, metadata, combined in sheets_to_write:
            print(f"Writing {sheet_name} to workbook...", flush=True)
            final_sheet = sheet_with_metadata(metadata, combined)
            final_sheet.to_excel(writer, sheet_name=sheet_name, index=False, header=False)

    print("Preparing LLM framework handoff...", flush=True)
    run_llm_framework(syntheticized_sheets)
    print("Preparing Random Forest framework handoff...", flush=True)
    run_random_forest_framework(syntheticized_sheets)

    print(f"Created {OUTPUT_WORKBOOK}")
    print(f"Rows per sheet: original + {ROWS_PER_SHEET} synthetic rows")


if __name__ == "__main__":
    main()
