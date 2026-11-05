import { MinuteTrack, Wordmark } from "@/components/brand/Brand";
import { repos } from "@/data/repositories";

export const dynamic = "force-dynamic";

export default async function Maintenance() {
  const s = await repos().settings.get();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-10 px-6 text-center">
      <Wordmark className="h-16 w-auto" />
      <h1 className="display max-w-xl text-[2.4rem]">{s.storefront.maintenanceMessage}</h1>
      <MinuteTrack className="h-3 w-64 text-taupe/60" />
      {s.business.email && <p className="text-[13px] text-taupe-ink">{s.business.email}</p>}
    </div>
  );
}
