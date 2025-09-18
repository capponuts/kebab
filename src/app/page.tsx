"use client";

import { useState } from 'react';
import ArcadeGame from '@/components/ArcadeGame';
import StartMenu from '@/components/StartMenu';

export default function HomePage() {
    const [muted, setMuted] = useState(false);
    const [mode, setMode] = useState<'menu' | 'game'>('menu');
    return (
        <main className="min-h-screen">
            <header className="p-4 text-center text-xs opacity-70">Kebab Tycoon</header>
            {mode === 'menu' ? (
                <StartMenu onStart={() => setMode('game')} muted={muted} onToggleMute={() => setMuted((m) => !m)} />
            ) : (
                <ArcadeGame />
            )}
        </main>
    );
}

