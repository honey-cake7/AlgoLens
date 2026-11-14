// AlgoLens never opens links (no scraping, by design). A pasted problem URL
// would be analyzed as the words in the URL, so every link gives near-identical
// results. Detect input that is little more than a link and ask for the text.
const URL_PATTERN = /\b(?:https?:\/\/|www\.)\S+/gi

export function isLinkOnly(statement: string): boolean {
  const text = statement.trim()
  if (!text.match(URL_PATTERN)) return false
  const rest = text.replace(URL_PATTERN, ' ').replace(/\s+/g, ' ').trim()
  // A real statement has a story plus input/output; 60 characters is far below that.
  return rest.length < 60
}

export const LINK_ONLY_MESSAGE = 'AlgoLens can’t open links. Open the problem page, copy the problem text (story, input, output and constraints) and paste that here.'
