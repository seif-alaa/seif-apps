import { InquiryActions } from "@/components/admin/InquiryActions";
import { Card, Empty, PageHeader, Pill, fmtDate } from "@/components/admin/ui";
import { repos } from "@/data/repositories";

export default async function InquiriesPage() {
  const [inquiries, waitlist] = await Promise.all([repos().misc.inquiries(), repos().misc.waitlist()]);
  return (
    <>
      <PageHeader title="Inquiries & commissions">Messages from the contact and bespoke forms. No email is sent automatically until a provider is connected; reply from your own mailbox.</PageHeader>
      <div className="space-y-4">
        {inquiries.length === 0 && <Empty>No messages yet.</Empty>}
        {inquiries.map((i) => (
          <Card key={i.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[15px]">{i.name} <Pill tone={i.kind === "commission" ? "ink" : "muted"}>{i.kind === "commission" ? "Bespoke commission" : "Contact"}</Pill></p>
                <p className="text-[12.5px] text-taupe-ink"><a className="underline" href={`mailto:${i.email}`}>{i.email}</a>{i.phone && ` · ${i.phone}`} · {fmtDate(i.createdAt)}</p>
              </div>
              <InquiryActions id={i.id} status={i.status} />
            </div>
            <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed">{i.message}</p>
            {Object.keys(i.details).length > 0 && <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[12.5px] text-taupe-ink">{Object.entries(i.details).map(([k, v]) => <div key={k}><dt className="inline capitalize">{k}: </dt><dd className="inline">{v}</dd></div>)}</dl>}
          </Card>
        ))}
      </div>
      <Card title={`Launch list · ${waitlist.length}`} className="mt-10">
        {waitlist.length ? <p className="text-[13px] leading-relaxed">{waitlist.map((w) => w.email).join(", ")}</p> : <p className="text-[13px] text-taupe-ink">Empty.</p>}
      </Card>
    </>
  );
}
