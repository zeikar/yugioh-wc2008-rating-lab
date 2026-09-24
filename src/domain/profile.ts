/**
 * The save name the Firestore rules require (MVP §4): trimmed, 1–40
 * characters. `null` marks a parse failure; a valid name may itself be any
 * string, including the word "invalid", so that word can't be the sentinel.
 */
export function parseSaveName(text: string): string | null {
  const name = text.trim()
  return name.length >= 1 && name.length <= 40 ? name : null
}
