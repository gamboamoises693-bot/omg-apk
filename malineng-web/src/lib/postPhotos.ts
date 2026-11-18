import type { Post } from "./types";

/** A Board post can have up to this many photos. */
export const MAX_POST_PHOTOS = 4;

/** All photos of a post: the new list, or the single photo of an older post. */
export function postPhotos(post: Pick<Post, "photos" | "photoURL">): string[] {
  if (post.photos && post.photos.length > 0) return post.photos.slice(0, MAX_POST_PHOTOS);
  return post.photoURL ? [post.photoURL] : [];
}
