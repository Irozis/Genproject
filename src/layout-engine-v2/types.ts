export type LayoutElementRole =
  | 'background'
  | 'image'
  | 'headline'
  | 'subtitle'
  | 'cta'
  | 'logo'
  | 'badge'
  | 'decor'

export type LayoutElementPriority = 'required' | 'important' | 'optional'

export interface LayoutRect {
  x: number
  y: number
  width: number
  height: number
}

export interface LayoutElement {
  id: string
  role: LayoutElementRole
  priority: LayoutElementPriority
  rect: LayoutRect
  visible: boolean
  text?: string
  fontSize?: number
  minFontSize?: number
  minWidth?: number
  minHeight?: number
  canHide: boolean
  canScale: boolean
  canCrop: boolean
  metadata?: Record<string, unknown>
}

export type FormatGroup =
  | 'square'
  | 'horizontal'
  | 'vertical'
  | 'small'
  | 'wide'
  | 'narrow'
  | 'logo'

export interface SafeArea {
  top: number
  right: number
  bottom: number
  left: number
}

export interface FormatSpecV2 {
  id: string
  name: string
  width: number
  height: number
  aspectRatio: number
  group: FormatGroup
  safeArea: SafeArea
}

export type LayoutCandidateName =
  | 'split'
  | 'hero'
  | 'imageTop'
  | 'compact'
  | 'logoOnly'
  | 'textPriority'
  | 'imagePriority'
  | 'scaling'
  | 'fixedLayout'

export interface LayoutCandidate {
  id: string
  name: LayoutCandidateName
  formatId: string
  elements: LayoutElement[]
  metadata?: {
    fallbacksApplied?: string[]
    notes?: string[]
    [key: string]: unknown
  }
}

export type ValidationIssueType =
  | 'out_of_bounds'
  | 'overlap'
  | 'text_too_small'
  | 'missing_required'
  | 'unsafe_zone'
  | 'excessive_crop'
  | 'empty_space'
  | 'hidden_optional'

export type ValidationSeverity = 'critical' | 'warning'

export interface ValidationIssue {
  type: ValidationIssueType
  severity: ValidationSeverity
  elementId?: string
  relatedElementId?: string
  message: string
  penalty: number
}

export interface CandidateEvaluation {
  candidate: LayoutCandidate
  issues: ValidationIssue[]
  score: number
  criticalCount: number
  warningCount: number
  hiddenElements: string[]
}

export interface LayoutDecision {
  formatId: string
  selected: CandidateEvaluation
  rejected: CandidateEvaluation[]
  reason: string
  createdAt: string
}

export interface SourceMaterialV2 {
  id: string
  elements: LayoutElement[]
  brand?: {
    primaryColor?: string
    secondaryColor?: string
    fontFamily?: string
  }
  metadata?: Record<string, unknown>
}
