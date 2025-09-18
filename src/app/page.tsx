"use client";

import ArcadeGame from '@/components/ArcadeGame';

export default function HomePage() {
	return (
		<main className="min-h-screen">
			<header className="p-4 text-center text-sm opacity-80">Kebab Tycoon – Arcade</header>
			<ArcadeGame />
		</main>
	);
}

