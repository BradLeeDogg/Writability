// Linking words ("signposting"), grouped by what they do. Joining ideas with
// the right connector is a common sticking point; offering a small, labelled
// bank — rather than expecting the student to recall them — turns it into a
// pick-from-a-list task. Plain and offline.

export interface TransitionGroup {
  /** What this kind of linking word does, in plain terms. */
  label: string
  phrases: string[]
}

export const TRANSITIONS: TransitionGroup[] = [
  {
    label: 'Add another idea',
    phrases: ['In addition,', 'Furthermore,', 'Moreover,', 'Also,', 'As well as this,']
  },
  {
    label: 'Show a contrast',
    phrases: ['However,', 'On the other hand,', 'In contrast,', 'Even so,', 'Although']
  },
  {
    label: 'Show cause and effect',
    phrases: ['As a result,', 'Therefore,', 'Because of this,', 'Consequently,', 'For this reason,']
  },
  {
    label: 'Give an example',
    phrases: ['For example,', 'For instance,', 'To illustrate,', 'In particular,']
  },
  {
    label: 'Put things in order',
    phrases: ['First,', 'Next,', 'Then,', 'After that,', 'Finally,']
  },
  {
    label: 'Sum up or conclude',
    phrases: ['In conclusion,', 'To sum up,', 'Overall,', 'In short,']
  }
]
