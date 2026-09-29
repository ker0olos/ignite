/** "1 skill", "3 skills". */
export const countOf = (n: number, noun: string) =>
  `${n} ${noun}${n === 1 ? "" : "s"}`;

/** A description's first sentence, so long ones don't flood the list. */
export const firstSentence = (text: string) =>
  text.match(/^.*?[.!?](?=\s|$)/s)?.[0] ?? text;
