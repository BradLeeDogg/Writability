// A small, plain-language dictionary of the academic words that show up in
// assignments and feedback. Surfaced as hover-to-define underlines in the
// editor so an unfamiliar term is one glance away, not a context-switch to a
// search engine. Shared so it can be unit-tested without a browser.

export interface GlossaryEntry {
  term: string
  definition: string
}

export const GLOSSARY: GlossaryEntry[] = [
  { term: 'thesis', definition: 'The one main point your whole paper argues, usually in a single sentence.' },
  { term: 'claim', definition: 'A statement you are trying to prove is true.' },
  { term: 'evidence', definition: 'Facts, quotes, or examples that back up a claim.' },
  { term: 'analysis', definition: 'Explaining how your evidence proves your point and why it matters.' },
  { term: 'citation', definition: 'A note that shows where a fact or quote came from.' },
  { term: 'cite', definition: 'To show where a fact or quote came from.' },
  { term: 'paraphrase', definition: 'Putting someone else’s idea into your own words.' },
  { term: 'summarise', definition: 'Giving the main points briefly, in your own words.' },
  { term: 'summarize', definition: 'Giving the main points briefly, in your own words.' },
  { term: 'synthesise', definition: 'Combining ideas from several sources into one clear point.' },
  { term: 'synthesize', definition: 'Combining ideas from several sources into one clear point.' },
  { term: 'counterargument', definition: 'A point someone who disagrees with you might make.' },
  { term: 'rebuttal', definition: 'Your answer to a counterargument.' },
  { term: 'bibliography', definition: 'A list of all the sources you used, at the end of the paper.' },
  { term: 'plagiarism', definition: 'Using someone else’s words or ideas without saying where they came from.' },
  { term: 'introduction', definition: 'The opening part that sets up your topic and states your thesis.' },
  { term: 'conclusion', definition: 'The final part that restates your thesis and sums things up.' },
  { term: 'rhetoric', definition: 'The art of using language to persuade or influence people.' },
  { term: 'objective', definition: 'Based on facts, not on personal feelings.' },
  { term: 'subjective', definition: 'Based on personal feelings or opinions.' },
  { term: 'context', definition: 'The background that helps the reader make sense of something.' },
  { term: 'credible', definition: 'Trustworthy and believable — a source you can rely on.' }
]

/** Lower-cased term → definition, for quick lookup. */
export function glossaryMap(): Map<string, string> {
  return new Map(GLOSSARY.map((g) => [g.term.toLowerCase(), g.definition]))
}
