# Research Validation Summary

| Metric | Value |
| --- | ---: |
| Total formats | 126 |
| Total results | 1890 |
| Ready | 81 (4.3%) |
| NeedsFix | 1591 (84.2%) |
| Critical | 218 (11.5%) |

## Results By Method

| Method | Total | Ready | NeedsFix | Critical |
| --- | ---: | ---: | ---: | ---: |
| simpleScale | 630 | 0 (0.0%) | 445 (70.6%) | 185 (29.4%) |
| fixedTemplate | 630 | 40 (6.3%) | 560 (88.9%) | 30 (4.8%) |
| adaptiveLayout | 630 | 41 (6.5%) | 586 (93.0%) | 3 (0.5%) |

## Top 5 NeedsFix Reasons

- textTooSmall: 1442
- ctaDetachedFromText: 1348
- subtitle: 918
- title: 904
- bodyOverflow: 634

## Top 5 Critical Reasons

- cta: 105
- title critically overlaps cta (100.0% of smaller block): 80
- title critically overlaps subtitle (100.0% of smaller block): 80
- title: 75
- subtitle critically overlaps cta (100.0% of smaller block): 70

## Methodology Warning Counts

- derivedRuleApplied: 1890
- heuristicRuleApplied: 1890
- layoutNotOfficiallySpecified: 1890
- percentageRegionsAreInternalModel: 1890
- needsManualReview: 1734
- unknownRuleSource: 1545

## Diploma Conclusion

The audit produced reproducible technical validation records for the generated advertising materials. Ready results satisfy export, required element, boundary, text readability, and overlap checks. NeedsFix results are technically generated but require layout correction. Critical results contain blocking technical violations and should not be treated as production-ready without correction. Methodology warnings describe rule provenance and review confidence; by themselves they do not change the technical classification.

## Audit Matrix

| Metric | Value |
| --- | ---: |
| Brand scenarios | 5 |
| Target formats | 126 |
| Methods | 3 |
| Expected validation cases | 1890 |
| Reproduced validation cases | 1890 |

## Method Counts

- simpleScale: 630
- fixedTemplate: 630
- adaptiveLayout: 630

## Critical Comparison

| Method | Critical cases |
| --- | ---: |
| simpleScale | 185 |
| fixedTemplate | 30 |
| adaptiveLayout | 3 |

AdaptiveLayout critical is below simpleScale critical.

## Adaptive PNG / ZIP Export

| Metric | Value |
| --- | ---: |
| Requested adaptive PNG artifacts | 630 |
| Created adaptive PNG artifacts | 605 |
| Created adaptive ZIP archives | 5 |
| Unavailable PNG artifacts | 25 |

PNG unavailable means the format does not declare PNG support or the browser export path could not create a PNG. Unavailable artifacts are recorded in validation-report.json and are not replaced with invented results.

## Source Scenario Files

- scenario-01: novyy-proekt (1).json
- scenario-02: novyy-proekt (2).json
- scenario-03: novyy-proekt (3).json
- scenario-04: novyy-proekt (4).json
- scenario-05: novyy-proekt.json

## Reproducibility Note

The full 5 x 126 x 3 validation matrix was reproduced: 1890 technical validation cases.

## Brief Diploma Conclusion

The experiment checks technical suitability of generated advertising layouts without changing the generation algorithm or manually correcting outputs. The adaptive complex can be compared against simple scaling and fixed templates using the same validator fields and the same target format catalog. Critical cases indicate blocking technical defects; needsFix cases indicate generated materials that exist but require local review; ready cases pass the automatic technical checks.
