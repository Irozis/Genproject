import type { ValidationIssueType } from './types'

export const ISSUE_PENALTIES: Record<ValidationIssueType, number> = {
  missing_required: 1000,
  out_of_bounds: 800,
  overlap: 600,
  text_too_small: 400,
  unsafe_zone: 300,
  excessive_crop: 150,
  empty_space: 100,
  hidden_optional: 50,
}