'use client';

/**
 * Главная страница приложения D&D Map Projector & Fog of War.
 * Автоматически определяет режим (Мастер / Игроки) по параметру ?mode=player
 * или предоставляет переключатель режимов с безопасным открытием второго окна.
 */

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DMView } from '@/components/DMView';
import { PlayerView } from '@/components/PlayerView';
import { ExternalLink, AlertTriangle, Monitor, Shield, X } from 'lucide-react';
import { initLegacyPolyfills } from '@/lib/legacyPolyfills';

function AppContent() {
  const searchParams = useSearchParams();
  const isPlayer = searchParams?.get('mode') === 'player';
  const [overrideMode, setOverrideMode] = useState<'dm' | 'player' | null>(null);
  const [popupBlockedModal, setPopupBlockedModal] = useState<boolean>(false);

  useEffect(() => {
    initLegacyPolyfills();
  }, []);

  const currentMode = overrideMode ?? (isPlayer ? 'player' : 'dm');

  // Безопасное открытие окна проектора с защитой от блокировщиков всплывающих окон
  const handleOpenPlayerWindow = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('mode', 'player');

      // Открываем отдельное окно для проектора
      const playerWin = window.open(
        url.toString(),
        'DND_PROJECTOR_PLAYER_VIEW',
        'width=1280,height=800,menubar=no,toolbar=no,location=no,status=no'
      );

      // Проверка на блокировку popup в Safari / Chrome
      if (!playerWin || playerWin.closed || typeof playerWin.closed === 'undefined') {
        setPopupBlockedModal(true);
      } else {
        try {
          (window as any).__dnd_player_win = playerWin;
        } catch {
          // ignore
        }
        playerWin.focus();
      }
    } catch (err) {
      console.warn('[Window Manager] Ошибка открытия окна:', err);
      setPopupBlockedModal(true);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950">
      {/* Рендеринг нужного представления */}
      {currentMode === 'player' ? (
        <PlayerView />
      ) : (
        <DMView onOpenPlayerWindow={handleOpenPlayerWindow} />
      )}

      {/* Быстрый плавающий переключатель режима (Variation 5) */}
      <div id="mode-quick-toggle" className="quick-toggle-bar">
        <button
          id="btn-mode-dm"
          onClick={() => setOverrideMode('dm')}
          className={`btn ${
            currentMode === 'dm'
              ? 'btn-accent'
              : 'border-transparent bg-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]'
          }`}
          style={{ height: '28px' }}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Мастер (DM)</span>
        </button>

        <button
          id="btn-mode-player"
          onClick={() => setOverrideMode('player')}
          className={`btn ${
            currentMode === 'player'
              ? 'btn-accent'
              : 'border-transparent bg-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]'
          }`}
          style={{ height: '28px' }}
        >
          <Monitor className="w-3.5 h-3.5" />
          <span>Игроки (Проектор)</span>
        </button>
      </div>

      {/* Модальное окно при блокировке Pop-up браузером */}
      {popupBlockedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 text-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400">
                <AlertTriangle className="w-6 h-6" />
                <h3 className="text-base font-bold">Всплывающее окно заблокировано</h3>
              </div>
              <button
                onClick={() => setPopupBlockedModal(false)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Браузер заблокировал автоматическое открытие окна игроков. Вы можете разрешить всплывающие окна для этого
              сайта в адресной строке или открыть его напрямую по ссылке ниже:
            </p>

            <div className="flex flex-col gap-2 pt-2">
              <a
                href="?mode=player"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setPopupBlockedModal(false)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold text-xs rounded-lg transition"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Открыть экран игроков в новой вкладке</span>
              </a>

              <button
                onClick={() => {
                  setOverrideMode('player');
                  setPopupBlockedModal(false);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition cursor-pointer"
              >
                Переключить текущую вкладку в режим игроков
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="w-screen h-screen bg-slate-950 text-slate-400 flex items-center justify-center">Загрузка проектора...</div>}>
      <AppContent />
    </Suspense>
  );
}
