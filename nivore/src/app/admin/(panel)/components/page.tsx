import Link from "next/link";
import { PageHeader, Pill, Table } from "@/components/admin/ui";
import { repos } from "@/data/repositories";
import { COMPONENT_TYPE_LABEL, COMPONENT_TYPES, effectivePrice } from "@/domain/catalog";
import { formatEGP } from "@/domain/money";
import { cn } from "@/lib/cn";

export default async function ComponentsPage({ searchParams }: { searchParams: Promise<{ type?: string; q?: string; stock?: string }> }) {
  const { type = "all", q = "", stock } = await searchParams;
  const catalog = await repos().catalog.get();
  const list = catalog.components
    .filter((c) => type === "all" || c.type === type)
    .filter((c) => !q || `${c.name} ${c.sku} ${c.code} ${c.supplier ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    .filter((c) => stock !== "alert" || c.stock.status === "low" || c.stock.status === "out_of_stock")
    .sort((a, b) => a.type.localeCompare(b.type) || a.sortOrder - b.sortOrder);
  return (
    <>
      <PageHeader title="Component library" actions={<Link href="/admin/components/new" className="btn btn-primary">New component</Link>}>
        Every option in the builder is a component here. Add a dial, case or strap without touching code; its measurements decide what it fits.
      </PageHeader>
      <nav className="mb-4 flex flex-wrap gap-1.5" aria-label="Component types">
        {["all", ...COMPONENT_TYPES].map((t) => (
          <Link key={t} href={`/admin/components?type=${t}`} className={cn("chip", type === t && "!border-espresso !bg-espresso !text-ivory")}>
            {t === "all" ? "All" : COMPONENT_TYPE_LABEL[t as keyof typeof COMPONENT_TYPE_LABEL]} <span className="tabular opacity-70">{t === "all" ? catalog.components.length : catalog.components.filter((c) => c.type === t).length}</span>
          </Link>
        ))}
      </nav>
      <form className="mb-5 flex gap-3"><input type="hidden" name="type" value={type} /><input name="q" defaultValue={q} placeholder="Name, SKU, code or supplier" className="field !min-h-10 max-w-sm text-sm" /><button className="btn btn-primary !min-h-10">Search</button></form>
      <Table head={["Component", "Type", "Code", "Price", "Cost", "Stock", "Status"]}>
        {list.map((c) => (
          <tr key={c.id} className={cn(!c.active && "opacity-55")}>
            <td className="px-4 py-2.5"><Link className="hover:underline" href={`/admin/components/${c.id}`}>{c.name}</Link><span className="block font-mono text-[11px] text-taupe-ink">{c.sku}</span></td>
            <td className="px-4 py-2.5">{COMPONENT_TYPE_LABEL[c.type]}</td>
            <td className="px-4 py-2.5 font-mono text-[12px]">{c.code}</td>
            <td className="tabular px-4 py-2.5">{formatEGP(effectivePrice(c))}{c.priceAdjustmentMinor !== 0 && <span className="block text-[11px] text-warn">adj. {formatEGP(c.priceAdjustmentMinor, { sign: true })}</span>}</td>
            <td className="tabular px-4 py-2.5 text-taupe-ink">{c.costMinor == null ? "—" : formatEGP(c.costMinor)}</td>
            <td className="px-4 py-2.5"><Pill tone={c.stock.status === "out_of_stock" ? "err" : c.stock.status === "low" ? "warn" : "muted"}>{c.stock.status.replace(/_/g, " ")}{c.stock.quantity != null && ` · ${c.stock.quantity}`}</Pill></td>
            <td className="px-4 py-2.5">{c.active ? <Pill tone="ok">Active</Pill> : <Pill>Inactive</Pill>}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
