import type { Metadata } from "next";
import { SavedList } from "@/components/commerce/SavedList";

export const metadata: Metadata = { title: "Saved compositions", robots: { index: false } };

export default function SavedPage() {
  return (
    <div className="mx-auto max-w-[1440px] px-5 pt-14 md:px-10 md:pt-20">
      <h1 className="display mb-10 text-[3rem]">Saved compositions</h1>
      <SavedList />
    </div>
  );
}
