'use client';

import React from 'react';
import { CampaignCard } from '../../lib/dnd-engine/types';
import { CampaignCardView } from './CampaignCardView';
import { Sparkles, Eye, X } from 'lucide-react';

interface PlayerCardOverlayProps {
  card: CampaignCard | null;
  onDismiss?: () => void;
}

export function PlayerCardOverlay({ card, onDismiss }: PlayerCardOverlayProps) {
  if (!card) return null;

  return (
    <div
      id="player-projected-card-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md transition-all duration-300 animate-in fade-in zoom-in-95"
    >
      <div className="relative max-w-2xl w-full flex flex-col items-center">
        {/* Subtle decorative glow & banner */}
        <div className="mb-2 flex items-center gap-2 px-3 py-1 bg-amber-950/80 border border-amber-600/60 rounded-full text-xs font-semibold text-amber-300 shadow-lg">
          <Eye className="w-3.5 h-3.5 text-amber-400" />
          <span>Материал от Мастера подземелий</span>
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
        </div>

        {/* The Card View rendered in Player Mode */}
        <div className="w-full">
          <CampaignCardView card={card} isPlayerView={true} />
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="mt-3 px-4 py-1.5 bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-neutral-200 rounded-full text-xs font-medium transition-colors shadow-lg flex items-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" /> Закрыть карточку
          </button>
        )}
      </div>
    </div>
  );
}
