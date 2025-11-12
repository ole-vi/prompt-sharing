// ===== Slug Generation =====

export function slugify(filePath) {
  const base = filePath.replace(/\.md$/i, '').toLowerCase().replace(/\s+/g, '-');
  return encodeURIComponent(base);
}

export function unslugify(slug) {
  return decodeURIComponent(slug);
}
