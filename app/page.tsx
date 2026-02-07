import Link from 'next/link';
import { Header } from '@/components/Header';
import { InlineJoin } from '@/components/InlineJoin';
import { MemeMachinePanel } from '@/components/mememachine/MemeMachinePanel';

export default async function LandingPage() {
  return (
    <div>
      <Header />
      <main className="max-w-6xl mx-auto px-6 py-12 space-y-14">
        <section className="grid md:grid-cols-2 gap-10 items-start">
          <div className="space-y-6">
            <p className="pill inline-block">Host or join with a code</p>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              Theater parties on demand.
              <br />
              Seats make it social.
            </h1>
            <div className="glass p-4 border-brand-primary/30 shadow-glow space-y-3">
              <label className="text-sm text-white/70">Join with code</label>
              <InlineJoin />
            </div>
            <div className="flex gap-4 flex-wrap">
              <Link href="/host" className="button-primary text-base shadow-gold">
                Host a Party
              </Link>
              <Link href="/join" className="button-ghost text-base border-brand-primary/40">
                Join with Code
              </Link>
            </div>
            <div className="flex gap-2 text-xs text-white/60 flex-wrap uppercase tracking-wide">
              <span className="pill">Seats = identity</span>
              <span className="pill">Host controls</span>
              <span className="pill">Chat & reactions</span>
            </div>
          </div>
          <div className="glass p-6 border-white/10 space-y-4 orbital">
            <div className="text-white/80 text-sm font-semibold uppercase tracking-wide">Flow</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Step title="Host" desc="Create room" />
              <Step title="Share" desc="Drop the code" />
              <Step title="Seat" desc="Pick your row" />
              <Step title="Party" desc="Sync + chat" />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-2xl font-semibold">MemeMachine</h2>
            <p className="text-white/60 text-sm">Turn any idea into a meme. Make it chaotic.</p>
          </div>
          <MemeMachinePanel compact />
          <div className="flex justify-end">
            <Link href="/mememachine" className="button-ghost border-brand-primary/40">Open full MemeMachine</Link>
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
