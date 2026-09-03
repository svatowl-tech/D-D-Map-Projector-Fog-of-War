import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'D&D Map Projector & Fog of War',
  description: 'Ultra-lightweight live tabletop RPG map & video projector with Photoshop-like dynamic map drawing tools (fire, water, fog/gas, laser pointer, attention beacons), real-time Fog of War, and dual-window sync.',
  openGraph: {
    title: 'D&D Map Projector & Fog of War',
    description: 'Ultra-lightweight live tabletop RPG map & video projector with Photoshop-like dynamic map drawing tools (fire, water, fog/gas, laser pointer, attention beacons), real-time Fog of War, and dual-window sync.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'D&D Map Projector & Fog of War',
    description: 'Ultra-lightweight live tabletop RPG map & video projector with Photoshop-like dynamic map drawing tools (fire, water, fog/gas, laser pointer, attention beacons), real-time Fog of War, and dual-window sync.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
