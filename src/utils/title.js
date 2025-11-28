export function extractTitleFromPrompt(promptText) {
  if (!promptText) return '';
  const lines = promptText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return '';
  const heading = lines.find(l => /^#\s+/.test(l)) || lines[0];
  const title = heading.replace(/^#\s+/, '').trim();
  return title.length > 100 ? title.slice(0, 100).trim() : title;
}
