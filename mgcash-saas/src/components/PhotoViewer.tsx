import { useEffect, useState } from "react";
import { getPhoto } from "../services/shifts";
import { Spinner } from "./ui";

/** Lazy-loads a stored shift photo (kept in its own doc so lists stay light). */
export function PhotoViewer({ storeId, photoId, alt }: { storeId: string; photoId?: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!show || !photoId || url) return;
    setLoading(true);
    getPhoto(storeId, photoId)
      .then(setUrl)
      .catch(() => setUrl(null))
      .finally(() => setLoading(false));
  }, [show, photoId, storeId, url]);

  if (!photoId) return <span className="text-xs text-slate-400">Walang photo</span>;
  if (!show)
    return (
      <button className="text-sm font-semibold text-brand underline" onClick={() => setShow(true)}>
        📷 Tingnan ang {alt}
      </button>
    );
  if (loading) return <Spinner small />;
  return url ? <img src={url} alt={alt} className="max-h-60 rounded-lg border" /> : <span className="text-xs text-red-500">Hindi ma-load</span>;
}
