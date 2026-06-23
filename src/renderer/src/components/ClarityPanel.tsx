import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import { analyzeClarity } from '@shared/clarity'
import { docToPlainText } from '@shared/doc'
import type { ClarityIssueType } from '@shared/types'

const GROUP_TITLES: Record<ClarityIssueType, string> = {
  'long-sentence': 'Long sentences',
  'passive-voice': 'Passive voice',
  'ambiguous-pronoun': "Unclear “this” or “it”",
  'repeated-word': 'Repeated words',
  'complex-word': 'Long words',
  spacing: 'Spacing'
}

const GROUP_ORDER: ClarityIssueType[] = [
  'long-sentence',
  'passive-voice',
  'ambiguous-pronoun',
  'repeated-word',
  'complex-word',
  'spacing'
]

export function ClarityPanel(): JSX.Element {
  const current = useStore((s) => s.current)!
  const report = useMemo(
    () => analyzeClarity(docToPlainText(current.content.doc)),
    [current.content.doc]
  )

  const grouped = useMemo(() => {
    const map = new Map<ClarityIssueType, typeof report.issues>()
    for (const issue of report.issues) {
      const list = map.get(issue.type) ?? []
      list.push(issue)
      map.set(issue.type, list)
    }
    return map
  }, [report])

  return (
    <div className="clarity" data-testid="clarity-panel">
      <p className="panel-intro">
        Gentle checks to help your writing read clearly. These are suggestions, not rules — you
        decide what to change.
      </p>

      <div className="stat-grid" aria-label="Reading statistics">
        <Stat label="Words" value={String(report.wordCount)} />
        <Stat label="Sentences" value={String(report.sentenceCount)} />
        <Stat label="Avg. sentence" value={`${report.avgSentenceLength} words`} />
        <Stat label="Reading ease" value={`${report.readingEase}/100`} />
      </div>

      <p className="reading-label">{report.readingLabel}</p>

      {report.wordCount === 0 ? (
        <p className="muted">Write a little and clarity tips will appear here.</p>
      ) : report.issues.length === 0 ? (
        <p className="all-clear">No clarity flags right now. Nicely done.</p>
      ) : (
        GROUP_ORDER.filter((g) => grouped.has(g)).map((g) => {
          const issues = grouped.get(g)!
          return (
            <section key={g} className="issue-group">
              <h3>
                {GROUP_TITLES[g]} <span className="count">{issues.length}</span>
              </h3>
              <ul>
                {issues.map((issue, i) => (
                  <li key={i} className="issue">
                    <p className="issue-msg">{issue.message}</p>
                    {issue.suggestion && <p className="issue-fix">{issue.suggestion}</p>}
                    {issue.rewrite && <p className="issue-rewrite">{issue.rewrite}</p>}
                    {issue.excerpt && <p className="issue-excerpt">“{issue.excerpt}”</p>}
                  </li>
                ))}
              </ul>
            </section>
          )
        })
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}
