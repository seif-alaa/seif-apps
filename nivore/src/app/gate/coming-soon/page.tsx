import Image from "next/image";
import { MinuteTrack, Wordmark } from "@/components/brand/Brand";
import { Countdown } from "@/components/auction/Countdown";
import { WaitlistForm } from "@/components/gate/GateForms";
import { repos } from "@/data/repositories";
import { resolveStorefront } from "@/domain/storefront";

export const dynamic = "force-dynamic";

export default async function ComingSoon() {
  const s = (await repos().settings.get()).storefront;
  const now = new Date();
  const r = resolveStorefront(s, now);
  const launch = s.launchAt ? new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Cairo" }).format(new Date(s.launchAt)) : null;
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-between overflow-hidden px-6 py-10 text-center">
      {s.backgroundImage && <Image src={s.backgroundImage} alt="" fill priority className="object-cover opacity-40" sizes="100vw" />}
      <Wordmark className="relative h-16 w-auto md:h-20" />
      <div className="relative flex flex-col items-center gap-8">
        <h1 className="display max-w-3xl text-[2.6rem] md:text-[4.4rem]">{s.headline}</h1>
        {s.subheadline && <p className="max-w-lg text-[15.5px] leading-relaxed text-taupe-ink">{s.subheadline}</p>}
        {r.countdownTo && (
          <div className="flex flex-col items-center gap-3">
            <Countdown to={r.countdownTo} serverTime={now.toISOString()} label="Time until the atelier opens" />
            {launch && <p className="text-[12px] text-taupe-ink">Opening {launch}, Cairo time</p>}
          </div>
        )}
        {s.announcement && <p className="serif max-w-md text-lg italic">{s.announcement}</p>}
        {s.waitlistEnabled && <WaitlistForm />}
      </div>
      <div className="relative w-full max-w-xl">
        <MinuteTrack className="h-3 w-full text-taupe/60" />
        <p className="serif mt-4 italic">Defined by Detail.</p>
      </div>
    </div>
  );
}
