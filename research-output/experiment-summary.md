# Research Validation Summary

| Metric | Value |
| --- | ---: |
| Total formats | 126 |
| Total results | 1890 |
| Ready | 323 (17.1%) |
| NeedsFix | 1265 (66.9%) |
| Critical | 302 (16.0%) |

## Results By Method

| Method | Total | Ready | NeedsFix | Critical |
| --- | ---: | ---: | ---: | ---: |
| simpleScale | 630 | 0 (0.0%) | 445 (70.6%) | 185 (29.4%) |
| fixedTemplate | 630 | 110 (17.5%) | 435 (69.0%) | 85 (13.5%) |
| adaptiveLayout | 630 | 213 (33.8%) | 385 (61.1%) | 32 (5.1%) |

## Top 5 NeedsFix Reasons

- subtitle: 1028
- title: 854
- bodyOverflow: 724
- subtitleOverflow: 724
- text overflow: 484

## Top 5 Critical Reasons

- title: 134
- cta: 120
- title critically overlaps cta (100.0% of smaller block): 95
- title critically overlaps subtitle (100.0% of smaller block): 80
- subtitle critically overlaps cta (100.0% of smaller block): 70

## Methodology Warning Counts

- derivedRuleApplied: 1890
- heuristicRuleApplied: 1890
- layoutNotOfficiallySpecified: 1890
- percentageRegionsAreInternalModel: 1890
- needsManualReview: 1697
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
| fixedTemplate | 85 |
| adaptiveLayout | 32 |

AdaptiveLayout critical is below simpleScale critical.
AdaptiveLayout critical is not above fixedTemplate critical.

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
