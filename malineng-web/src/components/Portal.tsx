"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renders its children directly under <body>.
 * Needed for full-screen overlays (menus, modals): inside a glass card (backdrop-filter) a `fixed` element
 * is positioned against the card, not the screen, and would be cut off.
 */
export function Portal({ children }: { children: ReactNode }) {
  const [root, setRoot] = useState<HTMLElement | null>(null);
  useEffect(() => setRoot(document.body), []);
  return root ? createPortal(children, root) : null;
}
