"use client";

import { useEffect, useRef } from 'react';
import { useGameStore, UPGRADES_CATALOG, type UpgradeId } from '@/store/game';

function useGameLoop() {
	const tick = useGameStore((s) => s.tick);
	const last = useRef<number | null>(null);
	useEffect(() => {
		let raf = 0;
		const loop = (t: number) => {
			if (last.current != null) {
				const delta = (t - last.current) / 1000;
				tick(delta);
			}
			last.current = t;
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	}, [tick]);
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-baseline gap-2">
			<span className="text-xs opacity-70">{label}</span>
			<span className="text-lg font-semibold tabular-nums">{value}</span>
		</div>
	);
}

function ShopItem({ id }: { id: UpgradeId }) {
	const u = UPGRADES_CATALOG[id];
	const cost = useGameStore((s) => s.getUpgradeCost(id));
	const canBuy = useGameStore((s) => s.canBuy(id));
	const owned = useGameStore((s) => s.owned[id] ?? 0);
	const buy = useGameStore((s) => s.buy);
	return (
		<button
			onClick={() => buy(id)}
			disabled={!canBuy}
			className="w-full rounded border border-white/10 px-3 py-2 text-left hover:bg-white/5 disabled:opacity-50"
		>
			<div className="flex items-center justify-between">
				<div>
					<div className="font-medium">{u.name}</div>
					<div className="text-xs opacity-70">{u.description}</div>
				</div>
				<div className="text-right">
					<div className="text-sm tabular-nums">{Math.ceil(cost)} kebabs</div>
					<div className="text-xs opacity-70">Owned: {owned}</div>
				</div>
			</div>
		</button>
	);
}

export default function HomePage() {
	useGameLoop();
	const kebabs = useGameStore((s) => s.kebabs);
	const kps = useGameStore((s) => s.kebabsPerSecond);
	const kpc = useGameStore((s) => s.kebabsPerClick);
	const cook = useGameStore((s) => s.cook);
	const reset = useGameStore((s) => s.reset);

	return (
		<main className="min-h-screen grid grid-rows-[auto_auto_1fr]">
			<header className="p-4 text-center text-sm opacity-80">Kebab Tycoon</header>
			<section className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-4">
				<Stat label="Kebabs" value={Math.floor(kebabs).toLocaleString()} />
				<Stat label="/sec" value={kps.toFixed(1)} />
				<Stat label="/click" value={kpc.toFixed(0)} />
				<button onClick={reset} className="rounded bg-red-600/80 px-3 py-1 text-xs hover:bg-red-600">Reset</button>
			</section>
			<section className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-4 px-4 py-6 md:grid-cols-3">
				<div className="md:col-span-2 rounded border border-white/10 p-6">
					<h2 className="mb-4 text-lg font-semibold">Cuisine</h2>
					<button
						onClick={cook}
						className="h-40 w-full rounded bg-white/10 text-2xl font-bold hover:bg-white/15"
					>
						Cuisiner un kebab
					</button>
				</div>
				<div className="rounded border border-white/10 p-6">
					<h2 className="mb-4 text-lg font-semibold">Boutique</h2>
					<div className="space-y-2">
						<ShopItem id="grill" />
						<ShopItem id="chef" />
						<ShopItem id="franchise" />
					</div>
				</div>
			</section>
		</main>
	);
}

