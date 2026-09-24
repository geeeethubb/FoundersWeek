const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/**
 * A count written as a word, the site's style for small data-derived counts: "six" (or "Six" to
 * start a sentence). Counts above ten stay numerals.
 */
export function numberWord(n: number, options: { capitalize?: boolean } = {}): string {
  const word = NUMBER_WORDS[n] ?? String(n);
  return options.capitalize ? word[0].toUpperCase() + word.slice(1) : word;
}

/** Count words the way a person would: runs of non-whitespace. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/u).length;
}
