"use client";

import { useEffect } from "react";

/**
 * Shown instead of a blank "Application error" screen when a page crashes.
 * A very common cause on phones is the browser's own page translation (Chrome "Translate"), which rewrites
 * the page text and confuses the app; the site has its own TL / EN switch instead.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[page error]", error);
  }, [error]);

  return (
    <div className="space-y-3 py-12 text-center" translate="no">
      <p className="text-5xl" aria-hidden>⚠️</p>
      <h1 className="text-xl font-extrabold text-brand-deep">May nagkamali sa page</h1>
      <p className="mx-auto max-w-sm text-sm text-gray-600">
        Subukan ulit. Kung ginagamit mo ang <b>Translate</b> ng Chrome, i-off muna ito at gamitin ang <b>TL | EN</b> sa itaas ng site.
      </p>
      <div className="mx-auto grid max-w-xs grid-cols-2 gap-2">
        <button onClick={reset} className="rounded-xl bg-brand py-2.5 text-sm font-bold text-white">Subukan ulit</button>
        <button onClick={() => window.location.reload()} className="rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-bold text-brand">I-reload</button>
      </div>
      <details className="mx-auto max-w-sm text-left text-xs text-gray-500">
        <summary className="cursor-pointer text-center">Detalye para sa developer</summary>
        <p className="mt-2 break-words rounded-lg bg-gray-50 p-2 font-mono">{error.message || "Walang mensahe"}</p>
      </details>
    </div>
  );
}
