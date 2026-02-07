import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-brand-bg text-white flex flex-col items-center justify-center gap-4 px-6">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="text-white/70">The page you’re looking for does not exist.</p>
      <Link href="/" className="button-primary shadow-gold">Back home</Link>
    </main>
  );
}
