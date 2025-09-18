"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

type ItemType = 'kebab' | 'bomb';

type FallingItem = {
	id: number;
	type: ItemType;
	x: number;
	y: number;
	vy: number;
	r: number;
};

type GameState = {
	score: number;
	lives: number;
	isRunning: boolean;
	isGameOver: boolean;
};

const CANVAS_WIDTH = 420;
const CANVAS_HEIGHT = 720;
const FLOOR_Y = CANVAS_HEIGHT - 40;
const PLAYER_WIDTH = 80;
const PLAYER_HEIGHT = 18;
const PLAYER_SPEED = 320; // px/s

export default function ArcadeGame() {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const [hud, setHud] = useState<GameState>({ score: 0, lives: 3, isRunning: false, isGameOver: false });

	// Mutable refs for game loop
	const playerX = useRef<number>(CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2);
	const keys = useRef<{ left: boolean; right: boolean }>({ left: false, right: false });
	const items = useRef<FallingItem[]>([]);
	const lastTs = useRef<number | null>(null);
	const idCounter = useRef<number>(1);
	const running = useRef<boolean>(false);
	const gameOver = useRef<boolean>(false);
	const score = useRef<number>(0);
	const lives = useRef<number>(3);
	const spawnTimer = useRef<number>(0);

	const resetGame = useCallback(() => {
		playerX.current = CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2;
		items.current = [];
		lastTs.current = null;
		idCounter.current = 1;
		running.current = true;
		gameOver.current = false;
		score.current = 0;
		lives.current = 3;
		spawnTimer.current = 0;
		setHud({ score: 0, lives: 3, isRunning: true, isGameOver: false });
	}, []);

	const endGame = useCallback(() => {
		running.current = false;
		gameOver.current = true;
		setHud({ score: score.current, lives: lives.current, isRunning: false, isGameOver: true });
	}, []);

	// Keyboard controls
	useEffect(() => {
		const onDown = (e: KeyboardEvent) => {
			if (e.key === 'ArrowLeft') keys.current.left = true;
			if (e.key === 'ArrowRight') keys.current.right = true;
			if ((e.key === 'Enter' || e.key === ' ') && !running.current) {
				resetGame();
			}
		};
		const onUp = (e: KeyboardEvent) => {
			if (e.key === 'ArrowLeft') keys.current.left = false;
			if (e.key === 'ArrowRight') keys.current.right = false;
		};
		window.addEventListener('keydown', onDown);
		window.addEventListener('keyup', onUp);
		return () => {
			window.removeEventListener('keydown', onDown);
			window.removeEventListener('keyup', onUp);
		};
	}, [resetGame]);

	// Resize for devicePixelRatio
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const dpr = Math.max(1, window.devicePixelRatio || 1);
		canvas.width = Math.floor(CANVAS_WIDTH * dpr);
		canvas.height = Math.floor(CANVAS_HEIGHT * dpr);
		canvas.style.width = `${CANVAS_WIDTH}px`;
		canvas.style.height = `${CANVAS_HEIGHT}px`;
		const ctx = canvas.getContext('2d');
		if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}, []);

	const spawnItem = useCallback(() => {
		const isBomb = Math.random() < 0.22; // ~22% bomb
		const speedBase = 140 + Math.min(score.current * 2, 260);
		const r = isBomb ? 14 : 12;
		const item: FallingItem = {
			id: idCounter.current++,
			type: isBomb ? 'bomb' : 'kebab',
			x: r + Math.random() * (CANVAS_WIDTH - r * 2),
			y: -r - 10,
			vy: speedBase + Math.random() * 120,
			r,
		};
		items.current.push(item);
	}, []);

	const step = useCallback(
		(ts: number) => {
			if (!running.current) {
				lastTs.current = ts;
				return;
			}
			const canvas = canvasRef.current;
			const ctx = canvas?.getContext('2d');
			if (!canvas || !ctx) return;

			const prev = lastTs.current ?? ts;
			const dt = Math.min(0.033, (ts - prev) / 1000);
			lastTs.current = ts;

			// Update player
			let x = playerX.current;
			if (keys.current.left) x -= PLAYER_SPEED * dt;
			if (keys.current.right) x += PLAYER_SPEED * dt;
			x = Math.max(0, Math.min(CANVAS_WIDTH - PLAYER_WIDTH, x));
			playerX.current = x;

			// Spawn items
			spawnTimer.current += dt;
			const spawnEvery = Math.max(0.25, 0.9 - Math.min(score.current, 150) * 0.0035);
			while (spawnTimer.current >= spawnEvery) {
				spawnTimer.current -= spawnEvery;
				spawnItem();
			}

			// Update items
			for (const it of items.current) {
				it.y += it.vy * dt;
			}
			// Collision + cleanup
			const playerRect = { x, y: FLOOR_Y - PLAYER_HEIGHT, w: PLAYER_WIDTH, h: PLAYER_HEIGHT };
			const kept: FallingItem[] = [];
			for (const it of items.current) {
				if (it.y + it.r >= playerRect.y && it.y - it.r <= playerRect.y + playerRect.h) {
					const withinX = it.x + it.r >= playerRect.x && it.x - it.r <= playerRect.x + playerRect.w;
					if (withinX) {
						if (it.type === 'bomb') {
							lives.current -= 1;
							if (lives.current <= 0) {
								endGame();
							}
						} else {
							score.current += 1;
						}
						continue; // consumed
					}
				}
				if (it.y - it.r <= CANVAS_HEIGHT) kept.push(it);
			}
			items.current = kept;

			// Draw
			ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
			// Background
			ctx.fillStyle = '#0b0b0c';
			ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
			// Floor
			ctx.fillStyle = '#1f2937';
			ctx.fillRect(0, FLOOR_Y, CANVAS_WIDTH, CANVAS_HEIGHT - FLOOR_Y);
			// Player (plate)
			ctx.fillStyle = '#f59e0b';
			ctx.fillRect(playerRect.x, playerRect.y, playerRect.w, playerRect.h);
			// Items
			for (const it of items.current) {
				ctx.beginPath();
				ctx.arc(it.x, it.y, it.r, 0, Math.PI * 2);
				if (it.type === 'bomb') {
					ctx.fillStyle = '#111827';
					ctx.fill();
					// fuse
					ctx.beginPath();
					ctx.moveTo(it.x, it.y - it.r);
					ctx.lineTo(it.x, it.y - it.r - 10);
					ctx.strokeStyle = '#ef4444';
					ctx.lineWidth = 2;
					ctx.stroke();
				} else {
					ctx.fillStyle = '#10b981';
					ctx.fill();
					ctx.strokeStyle = '#064e3b';
					ctx.stroke();
				}
			}

			// HUD (drawn by React as well, but keep a minimal overlay)
			setHud((prev) => ({ ...prev, score: score.current, lives: lives.current, isRunning: running.current, isGameOver: gameOver.current }));
		},
		[endGame, spawnItem]
	);

	useEffect(() => {
		let raf = 0;
		const loop = (t: number) => {
			step(t);
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	}, [step]);

	return (
		<div className="mx-auto my-6 w-[420px] select-none">
			<div className="mb-2 flex items-baseline justify-between">
				<div className="flex gap-6">
					<div className="text-sm">Score: <span className="font-semibold tabular-nums">{hud.score}</span></div>
					<div className="text-sm">Vies: <span className="font-semibold tabular-nums">{hud.lives}</span></div>
				</div>
				<div className="text-xs opacity-70">← → pour bouger • Entrée pour (re)jouer</div>
			</div>
			<div className="relative">
				<canvas ref={canvasRef} className="block rounded border border-white/10 shadow" />
				{!hud.isRunning && (
					<div className="pointer-events-none absolute inset-0 grid place-items-center">
						<div className="rounded bg-black/60 px-4 py-3 text-center">
							<div className="text-lg font-semibold">
								{hud.isGameOver ? 'Perdu !' : 'Kebab Tycoon – Arcade'}
							</div>
							<div className="text-sm opacity-80">Appuie sur Entrée pour {hud.isGameOver ? 'recommencer' : 'commencer'}</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

