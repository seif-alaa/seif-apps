"use client";
import { useState, useTransition } from "react";
import { addCustomerNote } from "@/app/admin/actions";

export function CustomerNote({ id }: { id: string }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <textarea className="field text-sm" value={text} onChange={(e) => setText(e.target.value)} placeholder="Internal note" />
      <button className="btn btn-outline" disabled={pending || !text.trim()} onClick={() => start(async () => { await addCustomerNote(id, text); setText(""); })}>Add note</button>
    </div>
  );
}
