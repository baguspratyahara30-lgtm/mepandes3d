import { MetatahInvitation } from "@/components/metatah-invitation";
import { getCurrentRsvpResponse } from "@/lib/rsvp-service";

export const dynamic = "force-dynamic";

export default async function Home() {
  const initialRsvp = await getCurrentRsvpResponse().catch(() => null);

  return (
    <div className="min-h-[100svh] bg-[#d9bea3] px-0 py-0 sm:px-4 sm:py-6">
      <div className="portrait-shell mx-auto h-[100svh] w-full max-w-[430px] overflow-hidden bg-[#e8d2bb] sm:h-[calc(100svh-3rem)] sm:rounded-[2rem] sm:shadow-[0_32px_80px_rgba(80,46,20,0.28)]">
        <MetatahInvitation initialRsvp={initialRsvp} />
      </div>
    </div>
  );
}
