import Link from 'next/link';
import { Header } from '@/components/Header';
import { InlineJoin } from '@/components/InlineJoin';
// MemeMachine removed

export default async function LandingPage() {
  return (
    <div>
      <Header />
      <main className="max-w-6xl mx-auto px-6 py-12 space-y-14">
        <section className="grid lg:grid-cols-[1.2fr_0.8fr] gap-10 items-start">
          <div className="space-y-6">
            <p className="pill inline-block">For watch parties, album drops, and remote hangs</p>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              Host a theater party in minutes.
              <br />
              Friends pick seats, you run the show.
            </h1>
            <p className="text-white/70 max-w-xl">
              ILLUVRSE is built for groups that want synced playback with voice, reactions, and a seat map
              that feels like a real room.
            </p>
            <div className="flex gap-4 flex-wrap">
              <Link href="/host" className="button-primary text-base shadow-gold">
                Host a Party
              </Link>
              <Link href="/join" className="button-ghost text-base border-brand-primary/40">
                Join with Code
              </Link>
            </div>
            <div className="flex gap-2 text-xs text-white/60 flex-wrap uppercase tracking-wide">
              <span className="pill">No sign-up</span>
              <span className="pill">Seat-based layout</span>
              <span className="pill">Host moderation</span>
            </div>
          </div>
          <div className="glass p-6 border-white/10 space-y-4 orbital">
            <div className="text-white/80 text-sm font-semibold uppercase tracking-wide">Join fast</div>
            <div className="space-y-3">
              <label className="text-sm text-white/70">Enter a party code</label>
              <InlineJoin />
              <div className="text-xs text-white/60">
                No account needed. Pick a seat and you’re in.
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-2xl font-semibold">Party Tools</h2>
            <p className="text-white/60 text-sm">Host, seat, sync playback, talk and react. That’s the core experience.</p>
          </div>
        </section>
      </main>
    </div>
  );
}

function Step({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="border border-brand-primary/30 rounded-2xl p-4 bg-black/30 shadow-glow text-center">
      <div className="font-semibold text-white">{title}</div>
      <p className="text-sm text-white/70">{desc}</p>
    </div>
  );
}
