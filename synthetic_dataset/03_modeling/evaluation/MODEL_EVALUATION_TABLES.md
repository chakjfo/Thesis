# HyperDect Random Forest Model Evaluation Tables

## Dataset Split

| Item | Value |
|---|---:|
| Total records used for evaluation | 5,005 |
| Training records | 3,957 |
| Testing records | 1,048 |
| Split method | Group split by region and population group |

## Summary Metrics

| Metric | Formula | Result |
|---|---|---:|
| Accuracy | Correct predictions / Total predictions | 0.9895 |
| Weighted Precision | sum(Precision_i x Support_i) / Total support | 0.9910 |
| Weighted Recall | sum(Recall_i x Support_i) / Total support | 0.9895 |
| Weighted F1 Score | sum(F1_i x Support_i) / Total support | 0.9901 |
| Weighted ROC-AUC OvR | Weighted average of one-vs-rest AUC scores | 0.9977 |
| Training Time | End time - Start time | 1.1442 seconds |

## Leakage And Validity Audit

| Check | Result |
| --- | --- |
| full_dataset_rows | 5128 |
| full_exact_duplicate_rows | 103 |
| evaluation_rows_after_duplicate_removal | 5005 |
| duplicates_removed_before_split | 123 |
| split_method | GroupShuffleSplit by Area and population_group |
| train_rows | 3957 |
| test_rows | 1048 |
| overlapping_area_population_groups | 0 |
| exact_row_overlap_between_train_and_test | 0 |
| feature_target_pattern_overlap_between_train_and_test | 16 |
| uses_training_data_as_testing_data | False |
| uses_is_synthetic_as_model_feature | False |
| target_derivation_warning | screening_risk_category is derived from regional_risk_score, which is derived from the regional risk-factor rates used as model features. High scores show that the model learned the prototype screening rule; they do not prove clinical prediction accuracy. |

## Classification Report

|  | precision | recall | f1-score | support |
| --- | --- | --- | --- | --- |
| High | 1.0 | 1.0 | 1.0 | 5.0 |
| Low | 0.9971 | 0.9922 | 0.9946 | 1023.0 |
| Moderate | 0.68 | 0.85 | 0.7556 | 20.0 |
| accuracy | 0.9895 | 0.9895 | 0.9895 | 0.9895 |
| macro avg | 0.8924 | 0.9474 | 0.9167 | 1048.0 |
| weighted avg | 0.991 | 0.9895 | 0.9901 | 1048.0 |

## Confusion Matrix

|  | Predicted High | Predicted Low | Predicted Moderate |
| --- | --- | --- | --- |
| Actual High | 5 | 0 | 0 |
| Actual Low | 0 | 1015 | 8 |
| Actual Moderate | 0 | 3 | 17 |

## Top Feature Importances

| feature | importance |
| --- | --- |
| regional_smoking_history_rate | 0.2349 |
| regional_overweight_rate | 0.2024 |
| regional_binge_drinking_rate | 0.1797 |
| regional_obesity_rate | 0.1345 |
| regional_insufficient_physical_activity_rate | 0.134 |
| regional_unhealthy_diet_rate | 0.0985 |
| population_group_Adult | 0.0085 |
| population_group_Senior Citizen | 0.0075 |

## Notes

The confusion matrix is based only on the test set. In this run, the test set
contains 1,048 records. The model was trained on the remaining
3,957 records.

These results are based on syntheticized regional risk-factor data and a derived
screening risk category. Because the target category is created from the same
regional risk-factor rates used as model inputs, high accuracy means the Random
Forest learned the prototype screening rule. It should not be described as
clinical validation using real individual patient diagnosis outcomes.
