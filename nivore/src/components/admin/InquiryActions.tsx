"use client";
import { useTransition } from "react";
import { setInquiryStatus } from "@/app/admin/actions";

export function InquiryActions({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  return (
    <select className="field !min-h-9 !w-auto text-[12px]" disabled={pending} defaultValue={status} onChange={(e) => start(async () => { await setInquiryStatus(id, e.target.value as "new"); })}>
      <option value="new">New</option><option value="replied">Replied</option><option value="closed">Closed</option>
    </select>
  );
}
