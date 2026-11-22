// The question id rides in the poll text as zero-width characters: polls have no hidden field, and
// the chat history is the quiz memory. Each id character is 3 base-4 digits, after an invisible marker.
const TAG_MARKER = '⁣'
const ZERO_WIDTH = ['​', '‌', '‍', '⁠']
const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789_'
const DIGITS_PER_CHAR = 3
const TAG_PATTERN = new RegExp(`${TAG_MARKER}((?:${ZERO_WIDTH.join('|')})+)`)
const CHAR_PATTERN = new RegExp(`.{${DIGITS_PER_CHAR}}`, 'gu')

const encodeChar = (char: string, id: string): string => {
  const index = ID_ALPHABET.indexOf(char)
  if (index < 0) throw new Error(`Quiz id ${id} has a character outside [a-z0-9_]`)
  return [...index.toString(4).padStart(DIGITS_PER_CHAR, '0')].map(digit => ZERO_WIDTH[Number(digit)]).join('')
}

const decodeChar = (group: string): string =>
  ID_ALPHABET[parseInt([...group].map(char => ZERO_WIDTH.indexOf(char)).join(''), 4)]

export const quizTag = (id: string): string =>
  TAG_MARKER + [...id].map(char => encodeChar(char, id)).join('')

export function parseQuizTag(text: string): string | undefined {
  const digits = TAG_PATTERN.exec(text)?.[1]
  if (!digits || digits.length % DIGITS_PER_CHAR !== 0) return undefined
  return (digits.match(CHAR_PATTERN) ?? []).map(decodeChar).join('')
}
