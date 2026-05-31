/**
 * Pure helper for ToolShell's accented <h1>.
 *
 * Locates the accent word within the title case-INSENSITIVELY and returns the
 * real matched substring (preserving the title's own casing) so it can be
 * highlighted. If the accent is not a substring of the title, returns the plain
 * title with an empty match, so the caller renders the title verbatim and never
 * appends a stray word.
 *
 * This closes the v2.7 "Structured-output attackstructured" class of bug, where
 * `title.split(accent)` was case-sensitive and rendered the raw accent prop:
 * a case-mismatched accent (e.g. accent="structured" on "Structured-output
 * attack") fell through and got concatenated to the end of the title.
 */
export interface AccentParts {
  before: string;
  match: string;
  after: string;
}

export function splitAccent(title: string, accent?: string): AccentParts {
  if (!accent) return { before: title, match: '', after: '' };
  const i = title.toLowerCase().indexOf(accent.toLowerCase());
  if (i < 0) return { before: title, match: '', after: '' };
  return {
    before: title.slice(0, i),
    match: title.slice(i, i + accent.length),
    after: title.slice(i + accent.length)
  };
}
