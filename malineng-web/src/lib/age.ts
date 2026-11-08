/** Age in full years from YYYY-MM-DD, or null if unknown. */
export function ageFrom(birthday: string, now = new Date()): number | null {
  if (!birthday) return null;
  const b = new Date(`${birthday}T00:00:00`);
  if (Number.isNaN(b.getTime())) return null;
  let a = now.getFullYear() - b.getFullYear();
  if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) a -= 1;
  return a;
}
