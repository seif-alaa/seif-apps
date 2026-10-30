"use client";

import { useState } from "react";
import { ObjectEditor, type Json } from "./ObjectEditor";
import { SaveBar, useSave } from "./SaveBar";

/** Edits one or more top-level sections of an object with the ObjectEditor and saves via an action. */
export function JsonSectionForm<T extends Record<string, Json>>({ initial, action, sections, templates }: { initial: T; action: (v: T) => Promise<{ ok: boolean; error?: string }>; sections: { key: keyof T & string; title: string; help?: string }[]; templates?: Record<string, Json> }) {
  const [value, setValue] = useState<T>(initial);
  const { pending, msg, save } = useSave(action);
  return (
    <div className="space-y-10">
      {sections.map((s) => (
        <section key={s.key} className="border border-line p-5">
          <h2 className="display text-[1.5rem]">{s.title}</h2>
          {s.help && <p className="mb-4 mt-1 text-[12.5px] text-taupe-ink">{s.help}</p>}
          <div className="mt-4">
            <ObjectEditor value={value[s.key]} path={s.key} templates={templates} onChange={(v) => setValue({ ...value, [s.key]: v })} />
          </div>
        </section>
      ))}
      <SaveBar pending={pending} msg={msg} onSave={() => save(value)} />
    </div>
  );
}
