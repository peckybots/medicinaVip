export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s-]/g, '')    // remove special chars (commas, parentheses, etc)
    .trim()
    .replace(/\s+/g, '-')             // spaces to hyphens
    .replace(/-+/g, '-');             // deduplicate hyphens
}
