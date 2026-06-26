// Offline "assignment decoder".
//
// Academic prompts are full of instruction words ("analyse", "evaluate") whose
// real meaning is rarely spelled out — a classic piece of the "hidden
// curriculum" that trips up many autistic and otherwise neurodivergent
// students. This module turns a pasted prompt into:
//   1. literal, plain-language explanations of the command words it contains, and
//   2. a checklist of concrete requirements (word count, number of sources,
//      citation style, formatting, and any "must/should" instructions).
//
// Everything here is transparent rules the student can read — no AI, no network.

export interface CommandWord {
  /** The instruction word, lower-case. May be a short phrase. */
  term: string
  /** What the teacher is actually asking you to do, in plain words. */
  meaning: string
  /** A short, literal example of doing it. */
  example: string
}

export interface CommandWordHit extends CommandWord {
  /** Character offset where it was found in the prompt. */
  index: number
}

export interface DecodeResult {
  /** Command words found, in the order they appear. */
  commandWords: CommandWordHit[]
  /** Suggested, concrete requirement lines, de-duplicated. */
  requirements: string[]
}

// Longer phrases are listed before the single words they contain so the phrase
// "wins" and we don't show both "critically evaluate" and "evaluate".
export const COMMAND_WORDS: CommandWord[] = [
  {
    term: 'critically evaluate',
    meaning: 'Weigh the strengths and the weaknesses, then give your own judgement with reasons.',
    example: 'Say what the study did well, what it missed, and whether you trust it overall.'
  },
  {
    term: 'compare and contrast',
    meaning: 'Show how two or more things are alike AND how they are different.',
    example: 'List the ways two poems are similar, then the ways they differ.'
  },
  {
    term: 'analyse',
    meaning: 'Break the topic into parts and explain how each part works and why it matters.',
    example: 'Split the poem into its images, then explain what each one adds.'
  },
  {
    term: 'analyze',
    meaning: 'Break the topic into parts and explain how each part works and why it matters.',
    example: 'Split the poem into its images, then explain what each one adds.'
  },
  {
    term: 'evaluate',
    meaning: 'Weigh the strengths and weaknesses, then give your judgement with reasons.',
    example: 'Say what works, what does not, and what you conclude.'
  },
  {
    term: 'assess',
    meaning: 'Decide how good, true, or important something is, and explain why.',
    example: 'Judge how strong the evidence is and back up your view.'
  },
  {
    term: 'argue',
    meaning: 'Take one clear position and give reasons and evidence for it.',
    example: 'State your claim, then give three reasons that support it.'
  },
  {
    term: 'compare',
    meaning: 'Show how two or more things are alike (and usually how they differ too).',
    example: 'Point out what two theories have in common.'
  },
  {
    term: 'contrast',
    meaning: 'Show how two or more things are different.',
    example: 'Explain how the two characters react in opposite ways.'
  },
  {
    term: 'define',
    meaning: 'Say clearly and exactly what something means.',
    example: 'Give the precise meaning of the key term in your own words.'
  },
  {
    term: 'describe',
    meaning: 'Say what something is like, in clear and ordered detail.',
    example: 'Walk the reader through what happened, step by step.'
  },
  {
    term: 'discuss',
    meaning: 'Look at more than one side of the topic, then give a reasoned view.',
    example: 'Give the points for and against, then say what you think.'
  },
  {
    term: 'demonstrate',
    meaning: 'Show that something is true using clear evidence or examples.',
    example: 'Use quotes from the text to prove your point.'
  },
  {
    term: 'examine',
    meaning: 'Look closely at the topic and explain what you find.',
    example: 'Go through the data carefully and report the patterns.'
  },
  {
    term: 'explain',
    meaning: 'Make the topic clear and say how or why it happens.',
    example: 'Give the reasons behind the result, plainly.'
  },
  {
    term: 'explore',
    meaning: 'Look at the topic from several angles, without needing one final answer.',
    example: 'Consider a few possible causes and what each one suggests.'
  },
  {
    term: 'identify',
    meaning: 'Name or point out the key things being asked for.',
    example: 'List the main causes, clearly labelled.'
  },
  {
    term: 'illustrate',
    meaning: 'Make your point clear by giving examples.',
    example: 'Back up each idea with a real example.'
  },
  {
    term: 'interpret',
    meaning: 'Explain what something means or why it matters.',
    example: 'Say what the graph is telling us, not just what it shows.'
  },
  {
    term: 'justify',
    meaning: 'Give reasons and evidence that show why your view is right.',
    example: 'Explain why your choice is the best one, with proof.'
  },
  {
    term: 'outline',
    meaning: 'Give the main points only, without lots of detail.',
    example: 'List the key stages in order, briefly.'
  },
  {
    term: 'reflect',
    meaning: 'Think about your own experience and what you learned from it.',
    example: 'Describe what happened and how it changed your thinking.'
  },
  {
    term: 'summarise',
    meaning: 'Give the main points briefly, in your own words.',
    example: 'Sum up the article in three or four sentences.'
  },
  {
    term: 'summarize',
    meaning: 'Give the main points briefly, in your own words.',
    example: 'Sum up the article in three or four sentences.'
  },
  {
    term: 'synthesise',
    meaning: 'Combine ideas from several sources into one clear picture.',
    example: 'Pull together what three authors say into a single argument.'
  },
  {
    term: 'synthesize',
    meaning: 'Combine ideas from several sources into one clear picture.',
    example: 'Pull together what three authors say into a single argument.'
  },
  {
    term: 'state',
    meaning: 'Say something clearly and directly, with no extra detail needed.',
    example: 'Write your answer in one plain sentence.'
  }
]

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, a: 1, an: 1
}

function escapeRe(s: string): string {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
}

/** Find the command words present in the prompt, longest phrases winning. */
export function findCommandWords(prompt: string): CommandWordHit[] {
  const text = prompt || ''
  const hits: CommandWordHit[] = []
  for (const cw of COMMAND_WORDS) {
    const re = new RegExp(`\\b${escapeRe(cw.term)}\\b`, 'i')
    const m = re.exec(text)
    if (m) hits.push({ ...cw, index: m.index })
  }
  // Drop a hit if a longer hit's span fully contains it (e.g. drop "evaluate"
  // when "critically evaluate" matched), and de-duplicate identical meanings.
  const kept = hits.filter(
    (h) =>
      !hits.some(
        (o) =>
          o !== h &&
          o.term.length > h.term.length &&
          o.index <= h.index &&
          h.index < o.index + o.term.length
      )
  )
  const seen = new Set<string>()
  const unique = kept.filter((h) => {
    if (seen.has(h.meaning)) return false
    seen.add(h.meaning)
    return true
  })
  return unique.sort((a, b) => a.index - b.index)
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

const MAX_REQUIREMENTS = 20

// Phrases that mark an instruction worth pulling out of plain prose.
const REQUIRE_RE =
  /\b(must|should|need to|needs? to|be sure to|make sure|required to|ensure that|do not|don't|avoid|remember to)\b/i
// A bullet / numbered / lettered list marker at the start of a line.
const BULLET_RE = /^\s*(?:[-*•▪◦·–—]+|\(?\d{1,2}[.)]|[A-Za-z][.)])\s+/
// A points / marks / percentage weight, the tell-tale sign of a rubric row.
const POINTS_RE = /(\d{1,3})\s*(?:points?|pts?|marks?)\b|\b(\d{1,3})\s*%/i
// Imperative verbs that commonly open a requirement line.
const VERB_START_RE =
  /^(include|use|write|cite|add|provide|discuss|analy[sz]e|explain|describe|argue|compare|contrast|address|submit|ensure|incorporate|support|develop|organi[sz]e|format|proofread|reference|quote|summari[sz]e|evaluate|identify|state|define|create|choose|select|introduce|present|demonstrate|answer|complete|follow)\b/i

function ensureEnd(s: string): string {
  return /[.!?)]$/.test(s) ? s : s + '.'
}
function capitalizeFirst(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s
}
/** A short heading that introduces a grading rubric / criteria section. */
function isRubricHeading(line: string): boolean {
  const head =
    /^(rubric|grading(?:\s+criteria)?|criteria|assessment(?:\s+criteria)?|marking(?:\s+(?:criteria|scheme))?|scoring|points?\s+breakdown|grade\s+breakdown|you(?:'|’)?ll\s+be\s+(?:graded|assessed|marked)|how\s+you(?:'|’)?ll\s+be\s+(?:graded|assessed)|what\s+(?:i(?:'|’)?m|we(?:'|’)?re)\s+looking\s+for)\b/i
  if (!head.test(line.trim())) return false
  return line.trim().length <= 48 || /:\s*$/.test(line)
}
/** A flattened blob of bullet rows (so the prose pass can skip it). */
function looksLikeListBlob(sentence: string): boolean {
  if (/[•▪◦·]|(?:^|\s)[-–—]\s/.test(sentence)) return true
  return (sentence.match(/\b(points?|pts?|marks?)\b/gi) ?? []).length >= 2
}

/** Pull concrete, checkable requirements out of the prompt text. */
export function extractRequirements(prompt: string): string[] {
  const text = prompt || ''
  const out: string[] = []
  const push = (line: string): void => {
    const t = line.trim().replace(/\s+/g, ' ')
    if (t && !out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t)
  }

  // Word count — ranges, minimums, then a plain count.
  const range = text.match(/(\d{2,5})\s*(?:to|through|[-–—])\s*(\d{2,5})\s*words?/i)
  const minWords = text.match(/(?:at least|minimum of|no fewer than|at minimum)\s*(\d{2,5})\s*words?/i)
  const plainWords = text.match(/(\d{2,5})[-\s]*words?\b/i)
  if (range) push(`Write between ${range[1]} and ${range[2]} words.`)
  else if (minWords) push(`Write at least ${minWords[1]} words.`)
  else if (plainWords) push(`Write about ${plainWords[1]} words.`)

  // Page count.
  const pages = text.match(/(\d{1,3})\s*(?:to|[-–—])?\s*(\d{0,3})\s*pages?\b/i)
  if (pages) {
    push(pages[2] ? `Write ${pages[1]}–${pages[2]} pages.` : `Write about ${pages[1]} page${pages[1] === '1' ? '' : 's'}.`)
  }

  // Number of sources / references / citations.
  const src = text.match(
    /(?:at least\s*)?(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:(?:scholarly|peer[-\s]?reviewed|academic|credible|reliable|reputable|primary|secondary|outside|external|published)\s+)*(sources?|references?|citations?)\b/i
  )
  if (src) {
    const n = NUMBER_WORDS[src[1].toLowerCase()] ?? Number(src[1])
    if (n > 0) push(`Use at least ${n} ${n === 1 ? 'source' : 'sources'}.`)
  }

  // Citation style.
  const styles: Array<[RegExp, string]> = [
    [/\bMLA\b/i, 'MLA'],
    [/\bAPA\b/i, 'APA'],
    [/\bchicago\b/i, 'Chicago'],
    [/\bturabian\b/i, 'Chicago/Turabian'],
    [/\bharvard\b/i, 'Harvard']
  ]
  for (const [re, name] of styles) {
    if (re.test(text)) {
      push(`Format your citations in ${name} style.`)
      break
    }
  }

  // Common formatting and structure requirements.
  const flags: Array<[RegExp, string]> = [
    [/double[-\s]?spac/i, 'Double-space the whole paper.'],
    [/\b12[-\s]?(?:point|pt)\b/i, 'Use 12-point font.'],
    [/times new roman/i, 'Use Times New Roman font.'],
    [/\b(title|cover)\s+page\b/i, 'Include a title page.'],
    [/\bworks cited\b/i, 'Include a Works Cited page.'],
    [/\b(bibliography|reference (?:list|page|s))\b/i, 'Include a references / bibliography page.'],
    [/\bthesis statement\b/i, 'Include a clear thesis statement.'],
    [/\bin[-\s]?text citation/i, 'Add in-text citations where you use a source.'],
    [/\bcounter[-\s]?argument\b/i, 'Include a counterargument and respond to it.'],
    [/\bheadings?\b/i, 'Use section headings.']
  ]
  for (const [re, line] of flags) if (re.test(text)) push(line)

  // Plain-prose "must / should / be sure to" instructions, kept as written.
  // Skip flattened bullet blobs — those are handled line-by-line below.
  for (const sentence of splitSentences(text)) {
    if (out.length >= MAX_REQUIREMENTS) break
    if (sentence.length > 180 || looksLikeListBlob(sentence)) continue
    if (REQUIRE_RE.test(sentence)) push(ensureEnd(sentence))
  }

  // Bullet points, rubric rows, and imperative lines. These are the heart of a
  // rubric and used to be lost when they weren't full "must/should" sentences.
  const lines = text.split(/\r?\n/)
  let inRubric = false
  for (const raw of lines) {
    if (out.length >= MAX_REQUIREMENTS) break
    const line = raw.trim()
    if (!line) continue
    if (isRubricHeading(line)) {
      inRubric = true
      continue
    }
    const isBullet = BULLET_RE.test(raw)
    const body = line.replace(BULLET_RE, '').trim()
    if (body.length < 3 || body.length > 180) continue
    const hasPoints = POINTS_RE.test(body)
    // Only act on list-like lines; plain prose lines were handled above.
    if (!isBullet && !hasPoints && !inRubric) continue
    if (!(isBullet || hasPoints || VERB_START_RE.test(body) || REQUIRE_RE.test(body))) continue
    if (inRubric || hasPoints) push('Graded on: ' + capitalizeFirst(body))
    else push(ensureEnd(capitalizeFirst(body)))
  }

  return out.slice(0, MAX_REQUIREMENTS)
}

export function decodeAssignment(prompt: string): DecodeResult {
  return {
    commandWords: findCommandWords(prompt),
    requirements: extractRequirements(prompt)
  }
}
