# HyperDect Pipeline Notes

HyperDect is a prototype hypertension screening-support system. It combines
regional non-communicable disease risk-factor data, user checklist answers, a
Large Language Model explanation component, and a Random Forest screening
framework.

HyperDect is intended for screening support and health awareness only. It is
not intended to diagnose hypertension, treat medical conditions, or replace
medical advice from a licensed health professional.

## Data Flow

1. Clean the regional NCD risk-factor dataset.
2. Generate additional synthetic records because the available data is limited.
3. Syntheticize the dataset by combining cleaned records and generated records.
4. Prepare the syntheticized data for the LLM framework.
5. Prepare encoded regional risk-factor features for the Random Forest framework.
6. Later, combine regional background features with user checklist answers.

## Checklist Factors

The user checklist should cover these hypertension-related risk factors:

- Smoking history
- Binge drinking
- Insufficient physical activity
- Unhealthy diet
- Overweight
- Obesity

## Modeling Direction

The LLM component should read the user checklist answers and regional background
data, then generate a plain-English explanation of possible hypertension risk.

The Random Forest component should use encoded regional data and encoded
checklist answers to produce a screening risk category or risk score.

Because the current dataset contains regional counts instead of individual
patient records, any risk category generated at this stage is for prototype
screening-support experimentation only.
