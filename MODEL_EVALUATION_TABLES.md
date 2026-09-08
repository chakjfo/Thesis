# HyperDect Random Forest Model Evaluation Tables

## Dataset Split

| Item | Value |
|---|---:|
| Total records | 5,128 |
| Training records | 4,102 |
| Testing records | 1,026 |
| Split ratio | 80% training / 20% testing |

## Summary Metrics

| Metric | Formula | Result |
|---|---|---:|
| Accuracy | Correct predictions / Total predictions | 0.9864 |
| Weighted Precision | sum(Precision_i x Support_i) / Total support | 0.9886 |
| Weighted Recall | sum(Recall_i x Support_i) / Total support | 0.9864 |
| Weighted F1 Score | sum(F1_i x Support_i) / Total support | 0.9872 |
| Weighted ROC-AUC OvR | Weighted average of one-vs-rest AUC scores | 0.9977 |
| Training Time | End time - Start time | 1.0631 seconds |

## Classification Report

|  | precision | recall | f1-score | support |
| --- | --- | --- | --- | --- |
| High | 1.0 | 0.8571 | 0.9231 | 7.0 |
| Low | 0.996 | 0.991 | 0.9935 | 999.0 |
| Moderate | 0.6154 | 0.8 | 0.6957 | 20.0 |
| accuracy | 0.9864 | 0.9864 | 0.9864 | 0.9864 |
| macro avg | 0.8705 | 0.8827 | 0.8707 | 1026.0 |
| weighted avg | 0.9886 | 0.9864 | 0.9872 | 1026.0 |

## Confusion Matrix

|  | Predicted High | Predicted Low | Predicted Moderate |
| --- | --- | --- | --- |
| Actual High | 6 | 0 | 1 |
| Actual Low | 0 | 990 | 9 |
| Actual Moderate | 0 | 4 | 16 |

## Top Feature Importances

| feature | importance |
| --- | --- |
| regional_smoking_history_rate | 0.2215 |
| regional_overweight_rate | 0.1919 |
| regional_binge_drinking_rate | 0.1757 |
| regional_obesity_rate | 0.1346 |
| regional_insufficient_physical_activity_rate | 0.1157 |
| regional_unhealthy_diet_rate | 0.0903 |
| is_synthetic | 0.0557 |
| population_group_Adult | 0.0076 |
| population_group_Senior Citizen | 0.007 |

## Notes

The confusion matrix is based only on the 20% test set. In this run, the test
set contains 1,026 records. The model was trained on the
remaining 4,102 records.

These results are based on syntheticized regional risk-factor data and a derived
screening risk category. They are useful for prototype evaluation, but they are
not clinical validation using real individual patient diagnosis outcomes.
