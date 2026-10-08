/** `ILIKE` pattern for "contains", with user input matched literally. */
export function containsPattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
