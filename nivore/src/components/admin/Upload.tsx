"use client";

import { useState } from "react";

export interface Uploaded {
  src: string;
  width: number;
  height: number;
}

export function UploadButton({ onUploaded, label = "Upload image", accept = "image/png,image/webp,image/jpeg" }: { onUploaded: (u: Uploaded) => void; label?: string; accept?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col gap-1">
      <label className="btn btn-outline cursor-pointer !min-h-10">
        {busy ? "Uploading…" : label}
        <input
          type="file"
          accept={accept}
          className="sr-only"
          disabled={busy}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setBusy(true);
            setError(null);
            const fd = new FormData();
            fd.set("file", f);
            const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
            const data = await res.json().catch(() => ({}));
            setBusy(false);
            if (!res.ok) setError(data.error ?? "Upload failed.");
            else onUploaded(data);
          }}
        />
      </label>
      {error && <span className="field-error">{error}</span>}
    </span>
  );
}
