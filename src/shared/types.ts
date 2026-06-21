// Cross-process domain types for Writability.
// Kept dependency-free so both the Electron main process and the renderer can
// import them.

export type EssayType = 'argument' | 'research' | 'lab' | 'thesis' | 'reflection'

export const ESSAY_TYPE_LABELS: Record<EssayType, string> = {
  argument: 'Argument essay',
  research: 'Research paper',
  lab: 'Lab report',
  thesis: 'Thesis / long essay',
  reflection: 'Reflection'
}

/** A single scaffolding step in the outline (thesis → point → evidence → …). */
export type OutlineKind =
  | 'thesis'
  | 'point'
  | 'evidence'
  | 'analysis'
  | 'link'
  | 'section'
  | 'note'

export interface OutlineNode {
  id: string
  kind: OutlineKind
  /** Short, literal label shown to the student, e.g. "Point 1". */
  label: string
  /** A gentle, specific prompt that says *what to do and why*. */
  prompt: string
  /** The student's own writing for this step. */
  text: string
  /** Executive-function help: a checkable "done" flag. */
  done: boolean
  children: OutlineNode[]
}

export interface PaperMeta {
  id: string
  title: string
  essayType: EssayType
  createdAt: string
  updatedAt: string
  /** Optional target so progress can be shown gently. */
  wordGoal?: number
  /** Optional due date (YYYY-MM-DD) for the deadline back-planner. */
  dueDate?: string
}

/** One concrete, checkable requirement pulled from (or added to) the prompt. */
export interface RequirementItem {
  id: string
  text: string
  done: boolean
  /** 'auto' = produced by the decoder, 'manual' = added by the student. */
  source: 'auto' | 'manual'
}

/** The assignment prompt and the literal requirements decoded from it. */
export interface Assignment {
  /** The raw prompt / rubric the student pasted or typed. */
  prompt: string
  requirements: RequirementItem[]
}

export interface PaperContent {
  /** TipTap / ProseMirror JSON document for the main prose. */
  doc: unknown
  /** The scaffolded outline tree. */
  outline: OutlineNode[]
  /** Citation sources gathered for this paper. */
  sources: CitationSource[]
  /** The decoded assignment prompt + requirement checklist. */
  assignment: Assignment
  /** Free, judgement-free "brain dump" scratch space (no clarity checks, no word count). */
  scratch: string
}

export interface Paper {
  meta: PaperMeta
  content: PaperContent
}

/** Lightweight listing entry (read from the JSON sidecar, no DB open needed). */
export interface PaperSummary {
  id: string
  title: string
  essayType: EssayType
  updatedAt: string
  /** Folder that holds this paper's project.db + sidecars. */
  dir: string
}

// ---------------------------------------------------------------------------
// Settings — the calm, customizable interface
// ---------------------------------------------------------------------------

export type ThemeName = 'calm-light' | 'calm-dark' | 'sepia' | 'high-contrast'
export type FontChoice = 'system' | 'serif' | 'atkinson' | 'opendyslexic'
export type OverlayTint = 'none' | 'cream' | 'rose' | 'blue' | 'green'

export interface AppSettings {
  theme: ThemeName
  fontFamily: FontChoice
  /** Multiplier on the base reading size (0.8 – 1.8). */
  fontScale: number
  /** Line height (1.2 – 2.4). */
  lineSpacing: number
  /** Letter spacing in em (0 – 0.12). */
  letterSpacing: number
  /** Space between paragraphs in em (0 – 2). */
  paragraphSpacing: number
  /** Comfortable reading measure in ch (48 – 100). */
  maxLineWidth: number
  /** Distraction-reduced focus mode. */
  focusMode: boolean
  /** Preferred length of a focus-timer work session, in minutes. */
  focusTimerMinutes: number
  /** Respect/force reduced motion. */
  reduceMotion: boolean
  /** Tinted overlay for visual stress (Irlen-style). */
  overlayTint: OverlayTint
  /** Read-aloud speaking rate (0.6 – 1.4). */
  ttsRate: number
  /** Show the clarity panel results. */
  showClarity: boolean
  /** Id of the last paper opened, so we can restore it on launch. */
  lastPaperId?: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'calm-light',
  fontFamily: 'atkinson',
  fontScale: 1.1,
  lineSpacing: 1.7,
  letterSpacing: 0.01,
  paragraphSpacing: 0.8,
  maxLineWidth: 68,
  focusMode: false,
  focusTimerMinutes: 25,
  reduceMotion: false,
  overlayTint: 'none',
  ttsRate: 1,
  showClarity: true
}

// ---------------------------------------------------------------------------
// Citations
// ---------------------------------------------------------------------------

export type CitationStyle = 'mla' | 'apa' | 'chicago'
export type SourceType = 'book' | 'website' | 'journal'

export interface CitationSource {
  id: string
  type: SourceType
  /** Authors as "Last, First" strings. */
  authors: string[]
  title: string
  /** Container: journal name, website name, or book/anthology title. */
  containerTitle?: string
  publisher?: string
  year?: string
  url?: string
  /** Date the web source was accessed (YYYY-MM-DD). */
  accessed?: string
  volume?: string
  issue?: string
  pages?: string
}

export interface FormattedCitation {
  /** In-text marker, e.g. "(Smith 12)" or "(Smith, 2020, p. 12)". */
  inText: string
  /** Full reference-list entry. */
  reference: string
}

// ---------------------------------------------------------------------------
// Clarity report
// ---------------------------------------------------------------------------

export type ClarityIssueType =
  | 'long-sentence'
  | 'passive-voice'
  | 'ambiguous-pronoun'
  | 'repeated-word'
  | 'complex-word'
  | 'spacing'

export interface ClarityIssue {
  type: ClarityIssueType
  /** Gentle, literal explanation that says *why*. */
  message: string
  /** A concrete, optional thing to try. */
  suggestion?: string
  /** The text this issue refers to. */
  excerpt: string
}

export interface ClarityReport {
  wordCount: number
  sentenceCount: number
  avgSentenceLength: number
  /** Flesch Reading Ease (higher = easier). */
  readingEase: number
  /** Flesch–Kincaid grade level. */
  gradeLevel: number
  /** Plain-language summary of the reading level. */
  readingLabel: string
  issues: ClarityIssue[]
}

export type ExportFormat = 'docx' | 'pdf' | 'txt'
