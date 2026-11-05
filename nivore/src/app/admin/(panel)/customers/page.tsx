import Link from "next/link";
import { PageHeader, Table, fmtDate } from "@/components/admin/ui";
import { repos } from "@/data/repositories";
import { formatPhone } from "@/domain/egypt";
import { formatEGP } from "@/domain/money";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const [customers, orders] = await Promise.all([repos().customers.list(), repos().orders.list()]);
  const list = customers.filter((c) => !q || `${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader title="Customers">Personal data. Visible to authorised administrators only; do not export or share without reason.</PageHeader>
      <form className="mb-5 flex gap-3"><input name="q" defaultValue={q} placeholder="Name, phone or email" className="field !min-h-10 max-w-sm text-sm" /><button className="btn btn-primary !min-h-10">Search</button></form>
      <Table head={["Customer", "Contact", "Orders", "Total placed", "Last order"]}>
        {list.map((c) => {
          const theirs = orders.filter((o) => c.orderRefs.includes(o.ref) && o.status !== "cancelled");
          return (
            <tr key={c.id}>
              <td className="px-4 py-3"><Link className="hover:underline" href={`/admin/customers/${c.id}`}>{c.name}</Link></td>
              <td className="px-4 py-3">{formatPhone(c.phone)}<span className="block text-[11.5px] text-taupe-ink">{c.email}</span></td>
              <td className="tabular px-4 py-3">{c.orderRefs.length}</td>
              <td className="tabular px-4 py-3">{formatEGP(theirs.reduce((s, o) => s + o.totals.totalMinor, 0))}</td>
              <td className="px-4 py-3 text-taupe-ink">{fmtDate(c.lastOrderAt)}</td>
            </tr>
          );
        })}
      </Table>
      {!list.length && <p className="p-8 text-center text-[13px] text-taupe-ink">No customers yet. They are created automatically from orders.</p>}
    </>
  );
}
