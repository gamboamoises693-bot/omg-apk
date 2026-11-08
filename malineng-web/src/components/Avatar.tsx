/** Round profile picture, or initials on a colored circle when there is no photo. */
export function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

export function Avatar({
  name,
  photo,
  size = "h-10 w-10",
  fallbackClass = "bg-gold text-brand-deep",
  textClass = "text-sm",
  ring = "",
}: {
  name: string;
  photo?: string;
  size?: string;
  fallbackClass?: string;
  textClass?: string;
  ring?: string;
}) {
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt={name} className={`${size} shrink-0 rounded-full object-cover ${ring}`} />;
  }
  return <span className={`flex ${size} shrink-0 items-center justify-center rounded-full font-black ${fallbackClass} ${textClass} ${ring}`}>{initialsOf(name)}</span>;
}
