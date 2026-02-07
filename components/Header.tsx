import Link from 'next/link';

export function Header() {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between bg-black/50 px-6 py-4 backdrop-blur-lg border-b border-white/10">
      <Link href="/" className="flex items-center gap-3 font-bold tracking-[0.22em] uppercase text-sm text-white">
        <span className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-primary to-brand-primaryLight text-brand-bg grid place-items-center font-mono shadow-glow">
          IV
        </span>
        <span>Illuvrse</span>
      </Link>
      <div className="flex items-center gap-3">
        <Link href="/host" className="button-primary text-sm shadow-gold">
          Host a Party
        </Link>
        <Link href="/join" className="button-ghost text-sm border-brand-primary/40">
          Join with Code
        </Link>
      </div>
    </header>
  );
}
