import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { db, uid, type Account, type AccountType } from "@/db/db";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const EMOJIS = ["💳", "🏦", "🌧️", "👛", "💰", "🐷", "📈", "✈️", "🏠", "🎓"];

export function AccountSheet({ open, onOpenChange, account }: { open: boolean; onOpenChange: (o: boolean) => void; account?: Account | null }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [type, setType] = useState<AccountType>("checking");
  const [balance, setBalance] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(account?.name ?? "");
    setEmoji(account?.emoji ?? EMOJIS[0]);
    setType(account?.type ?? "checking");
    setBalance(account ? String(account.startingBalance / 100) : "");
  }, [open, account]);

  async function save() {
    if (!name.trim()) {
      haptic("warning");
      return toast.error("Give it a name first 🙂");
    }
    const startingBalance = Math.round((parseFloat(balance.replace(",", ".")) || 0) * 100);
    if (account) await db.accounts.update(account.id, { name: name.trim(), emoji, type, startingBalance });
    else await db.accounts.add({ id: uid(), name: name.trim(), emoji, type, startingBalance, createdAt: Date.now() });
    haptic("success");
    toast.success(account ? "Account updated" : `${emoji} ${name.trim()} added`);
    onOpenChange(false);
  }

  async function remove() {
    if (!account) return;
    const used = await db.transactions.where("accountId").equals(account.id).count();
    if (used) return toast.error("This account has transactions", { description: "Delete or move them first — I don't want you losing history." });
    if ((await db.accounts.count()) <= 1) return toast.error("You need at least one account.");
    await db.accounts.delete(account.id);
    toast("Account removed");
    onOpenChange(false);
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent>
        <div className="space-y-4 px-5 pb-5 pt-3">
          <div>
            <DrawerTitle>{account ? "Edit account" : "New account"}</DrawerTitle>
            <DrawerDescription>Checking, savings, cash under the mattress — whatever you track.</DrawerDescription>
          </div>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 no-scrollbar">
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl border text-2xl transition-all", e === emoji ? "scale-105 border-primary bg-primary/10" : "border-border bg-card/50")}
              >
                {e}
              </button>
            ))}
          </div>
          <Input placeholder="Account name" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} />
          <Segmented
            value={type}
            onChange={setType}
            options={[
              { value: "checking", label: "Checking" },
              { value: "savings", label: "Savings" },
              { value: "credit", label: "Credit" },
              { value: "cash", label: "Cash" },
            ]}
          />
          <div>
            <label className="mb-1.5 block text-sm text-muted-foreground">{type === "credit" ? "Current balance (negative if you owe)" : "Starting balance"}</label>
            <Input inputMode="decimal" placeholder="0.00" value={balance} onChange={(e) => setBalance(e.target.value)} className="num" />
          </div>
          <div className="flex gap-2">
            {account && (
              <Button variant="secondary" className="text-coral" onClick={remove}>
                Remove
              </Button>
            )}
            <Button className="flex-1" onClick={save}>
              {account ? "Save" : "Add account"}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
