import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ILLUVRSE — Theater Party Venue',
  description: 'Host or join a code-based theater party with seats, voice, reactions, and synced playback.',
  icons: {
    icon: '/favicon.ico'
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
