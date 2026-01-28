
// Unicode control characters (U+0000-U+001F, U+007F-U+009F)
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g;

// Bi-directional text override characters (U+202A-U+202E)
const BIDI_CHARS = /[\u202A-\u202E]/g;

// Zero-width characters (U+200B-U+200D, U+FEFF)
const ZERO_WIDTH_CHARS = /[\u200B-\u200D\uFEFF]/g;

// Homograph map for visually similar characters (Cyrillic/Greek to Latin)
const HOMOGRAPH_MAP = {
  // Cyrillic
  'а': 'a', 'А': 'A',
  'с': 'c', 'С': 'C',
  'е': 'e', 'Е': 'E',
  'о': 'o', 'О': 'O',
  'р': 'p', 'Р': 'P',
  'х': 'x', 'Х': 'X',
  'у': 'y', 'У': 'Y',
  'і': 'i', 'І': 'I',
  'к': 'k', 'К': 'K',
  'м': 'm', 'М': 'M',
  'н': 'H', 'Н': 'H', // Cyrillic en is H
  'т': 'T', 'Т': 'T',

  // Greek
  'ο': 'o', 'Ο': 'O',
  'α': 'a', 'Α': 'A',
  'ν': 'v', 'Ν': 'N',
  'ρ': 'p', 'Ρ': 'P',
  'χ': 'x', 'Χ': 'X'
};

export function sanitizeTitle(title) {
  if (!title) return '';

  // Remove invisible and dangerous characters
  let clean = title
    .replace(CONTROL_CHARS, '')
    .replace(BIDI_CHARS, '')
    .replace(ZERO_WIDTH_CHARS, '');

  // Homograph normalization
  let normalized = '';
  for (const char of clean) {
    normalized += HOMOGRAPH_MAP[char] || char;
  }

  return normalized;
}

export function extractTitleFromPrompt(promptText) {
  if (!promptText) return '';
  const lines = promptText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return '';
  const heading = lines.find(l => /^#\s+/.test(l)) || lines[0];
  let title = heading.replace(/^#\s+/, '').trim();

  title = sanitizeTitle(title);

  return title.length > 100 ? title.slice(0, 100).trim() : title;
}
