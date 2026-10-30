import { saveSettings } from "@/app/admin/actions";
import { JsonSectionForm } from "@/components/admin/JsonSectionForm";
import type { Json } from "@/components/admin/ObjectEditor";
import { PageHeader } from "@/components/admin/ui";
import { repos } from "@/data/repositories";

export default async function SettingsPage() {
  const s = await repos().settings.get();
  return (
    <>
      <PageHeader title="Settings">Contact details, payment methods, notifications, SEO and policy texts. Leave a policy body empty until the business has approved real terms; the site then shows a &ldquo;being finalised&rdquo; notice instead of invented wording.</PageHeader>
      <JsonSectionForm
        initial={{ business: s.business, payments: s.payments, notifications: s.notifications, seo: s.seo, policies: s.policies, previewNotice: s.previewNotice, allowInternationalPhones: s.allowInternationalPhones } as unknown as Record<string, Json>}
        action={async (v) => {
          "use server";
          return saveSettings(v);
        }}
        sections={[
          { key: "business", title: "Business & contact", help: "WhatsApp in international format, e.g. +20 10 1234 5678. Reply time and assembly lead time are shown to customers only when set." },
          { key: "payments", title: "Payment methods", help: "Cash on delivery and cash on pickup are controlled separately. InstaPay orders are always confirmed by hand." },
          { key: "notifications", title: "Notifications", help: "No email provider is connected yet (see docs/PRODUCTION.md). The site never claims a message was sent." },
          { key: "seo", title: "Search & sharing" },
          { key: "policies", title: "Policy pages" },
          { key: "previewNotice", title: "Show the preview ribbon" },
          { key: "allowInternationalPhones", title: "Accept international phone numbers at checkout" },
        ]}
      />
    </>
  );
}
