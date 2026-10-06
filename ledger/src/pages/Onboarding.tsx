import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PiggyIllustration } from "@/components/Illustrations";
import { CURRENCIES } from "@/lib/format";
import { loadSampleData } from "@/db/seed";
import { usePrefs } from "@/store/ui";

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 26 } },
};

export default function Onboarding() {
  const setPrefs = usePrefs((s) => s.setPrefs);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState(usePrefs.getState().currency);

  const finish = async (sample: boolean) => {
    if (sample) await loadSampleData();
    setPrefs({ name: name.trim(), currency, onboarded: true });
    toast.success(name.trim() ? `Lovely to meet you, ${name.trim()} 👋` : "You're all set 👋", {
      description: sample ? "Sample data is loaded — erase it anytime in Settings." : "Tap + to log your first transaction.",
    });
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+24px)]">
      <div className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-emerald/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-40 size-72 rounded-full bg-amber/20 blur-3xl" />

      <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.08 } } }} className="relative mx-auto flex w-full max-w-sm flex-1 flex-col">
        <motion.div variants={item} className="mx-auto mt-4 w-48">
          <PiggyIllustration />
        </motion.div>
        <motion.h1 variants={item} className="mt-6 text-[34px] font-bold leading-[1.1] tracking-tight">
          Hi, I'm <span className="bg-gradient-to-r from-emerald to-amber bg-clip-text text-transparent">Ledger</span>.
          <br />
          Let's make money feel lighter.
        </motion.h1>
        <motion.p variants={item} className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          Track spending, set friendly budgets, and spot little wins. Everything stays on this phone — no sign-up, ever.
        </motion.p>

        <motion.div variants={item} className="mt-7 space-y-3">
          <Input placeholder="What should I call you?" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} autoComplete="given-name" />
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="h-12 w-full rounded-2xl border border-input bg-card/60 px-4 text-base outline-none">
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.label}
              </option>
            ))}
          </select>
        </motion.div>

        <motion.div variants={item} className="mt-auto space-y-2 pt-8">
          <Button size="lg" className="w-full" onClick={() => finish(false)}>
            Start fresh <ArrowRight />
          </Button>
          <Button size="lg" variant="ghost" className="w-full" onClick={() => finish(true)}>
            <Sparkles /> Explore with sample data
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
