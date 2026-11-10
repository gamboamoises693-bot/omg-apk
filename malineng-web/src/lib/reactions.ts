export type ReactionKey = "like" | "love" | "haha" | "wow" | "sad" | "pray";

export const REACTIONS: { key: ReactionKey; emoji: string; label: string; color: string }[] = [
  { key: "like", emoji: "👍", label: "Like", color: "text-brand" },
  { key: "love", emoji: "❤️", label: "Love", color: "text-red-600" },
  { key: "haha", emoji: "😂", label: "Haha", color: "text-amber-600" },
  { key: "wow", emoji: "😮", label: "Wow", color: "text-amber-600" },
  { key: "sad", emoji: "😢", label: "Malungkot", color: "text-amber-600" },
  { key: "pray", emoji: "🙏", label: "Pagdarasal", color: "text-purple-700" },
];

export const REACTION_BY_KEY = Object.fromEntries(REACTIONS.map((r) => [r.key, r])) as Record<ReactionKey, (typeof REACTIONS)[number]>;

/** A few friendly emojis to tap into a post or comment. */
export const QUICK_EMOJIS = ["😀", "😂", "😍", "🥰", "👍", "👏", "🙏", "❤️", "🎉", "🔥", "😢", "😮"];

export function isReactionKey(v: unknown): v is ReactionKey {
  return typeof v === "string" && v in REACTION_BY_KEY;
}
