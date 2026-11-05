import { PageHeader, Table, fmtDate } from "@/components/admin/ui";
import { repos } from "@/data/repositories";

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ entity?: string }> }) {
  const { entity } = await searchParams;
  const entries = await repos().misc.audit({ entity: entity || undefined, limit: 300 });
  return (
    <>
      <PageHeader title="Audit log">Every administrative change, price change, sign-in and order event, newest first.</PageHeader>
      <form className="mb-5 flex gap-3">
        <select name="entity" defaultValue={entity ?? ""} className="field !min-h-10 !w-auto text-sm">
          <option value="">Everything</option>
          {["order", "component", "product", "settings", "auction", "compat", "asset", "admin", "customer", "content"].map((e) => <option key={e}>{e}</option>)}
        </select>
        <button className="btn btn-primary !min-h-10">Filter</button>
      </form>
      <Table head={["When", "Who", "Action", "Summary"]}>
        {entries.map((e) => (
          <tr key={e.id}>
            <td className="whitespace-nowrap px-4 py-2.5 text-taupe-ink">{fmtDate(e.at)}</td>
            <td className="px-4 py-2.5">{e.actor}</td>
            <td className="px-4 py-2.5 font-mono text-[11.5px]">{e.action}</td>
            <td className="px-4 py-2.5">{e.summary}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
