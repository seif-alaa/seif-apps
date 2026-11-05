import { Monogram, Wordmark } from "@/components/brand/Brand";
import { AccessForm } from "@/components/gate/GateForms";

export default async function PasswordGate({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = "/" } = await searchParams;
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-10 px-6 text-center">
      <Wordmark className="h-16 w-auto" />
      <div className="flex flex-col items-center gap-5">
        <Monogram size={40} className="text-taupe" />
        <h1 className="display text-[2.4rem]">By invitation.</h1>
        <p className="max-w-sm text-[14.5px] text-taupe-ink">The atelier is open to guests with an access code. Enter yours to continue.</p>
        <AccessForm next={next} />
      </div>
    </div>
  );
}
