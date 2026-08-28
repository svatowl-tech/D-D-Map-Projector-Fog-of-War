import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'D&D Map Projector & Fog of War',
  description: 'Ultra-lightweight live tabletop RPG map & video projector with real-time Fog of War synchronization, grid overlay, and dual-window DM/Player views.',
  openGraph: {
    title: 'D&D Map Projector & Fog of War',
    description: 'Ultra-lightweight live tabletop RPG map & video projector with real-time Fog of War synchronization, grid overlay, and dual-window DM/Player views.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'D&D Map Projector & Fog of War',
    description: 'Ultra-lightweight live tabletop RPG map & video projector with real-time Fog of War synchronization, grid overlay, and dual-window DM/Player views.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
