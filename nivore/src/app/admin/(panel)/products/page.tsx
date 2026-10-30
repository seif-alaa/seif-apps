import Link from "next/link";
import { PageHeader, Pill, Table, fmtDate } from "@/components/admin/ui";
import { repos } from "@/data/repositories";
import { formatEGP } from "@/domain/money";

export default async function ProductsPage() {
  const products = await repos().products.list();
  return (
    <>
      <PageHeader title="Products" actions={<Link href="/admin/products/new" className="btn btn-primary">New product</Link>}>Finished NIVORÉ compositions sold as they are.</PageHeader>
      <Table head={["Product", "Status", "Price", "Stock", "Featured", "Updated"]}>
        {products.map((p) => (
          <tr key={p.id}>
            <td className="px-4 py-2.5"><Link className="hover:underline" href={`/admin/products/${p.id}`}>{p.name} · {p.dialLabel}</Link><span className="block text-[11.5px] text-taupe-ink">/{p.slug}</span></td>
            <td className="px-4 py-2.5"><Pill tone={p.status === "active" ? "ok" : p.status === "scheduled" ? "warn" : "muted"}>{p.status}{p.status === "scheduled" && p.releaseAt ? ` · ${fmtDate(p.releaseAt)}` : ""}</Pill>{p.soldOut && <> <Pill tone="err">sold out</Pill></>}</td>
            <td className="tabular px-4 py-2.5">{formatEGP(p.priceMinor)}</td>
            <td className="tabular px-4 py-2.5">{p.stockQuantity}</td>
            <td className="px-4 py-2.5">{p.featured ? "Yes" : ""}</td>
            <td className="px-4 py-2.5 text-taupe-ink">{fmtDate(p.updatedAt)}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
