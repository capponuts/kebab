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

export default function ArcadeGame({ muted, onToggleMute, onExit }: { muted: boolean; onToggleMute: () => void; onExit: () => void }) {
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

	// Assets
	const imgPlayer = useRef<HTMLImageElement | null>(null);
	const imgKebab = useRef<HTMLImageElement | null>(null);
	const imgBomb = useRef<HTMLImageElement | null>(null);
	const bg1 = useRef<HTMLImageElement | null>(null);
	const bg2 = useRef<HTMLImageElement | null>(null);
	const assetsLoaded = useRef<boolean>(false);
	const bgOffset1 = useRef<number>(0);
	const bgOffset2 = useRef<number>(0);

	// Audio
	const audioCtx = useRef<AudioContext | null>(null);
	const musicGain = useRef<GainNode | null>(null);
	const sfxGain = useRef<GainNode | null>(null);

    // Best score
    const bestScore = useRef<number>(0);

    // VFX
    type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };
    const particles = useRef<Particle[]>([]);
    const shakeT = useRef<number>(0);

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
        particles.current = [];
        shakeT.current = 0;
		setHud({ score: 0, lives: 3, isRunning: true, isGameOver: false });
	}, []);

    const endGame = useCallback(() => {
		running.current = false;
		gameOver.current = true;
        try {
            const prev = Number(localStorage.getItem('bestScore') || 0);
            bestScore.current = Math.max(prev, Math.floor(score.current));
            localStorage.setItem('bestScore', String(bestScore.current));
        } catch {}
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

	// Load images once
	useEffect(() => {
		const load = (src: string) =>
			new Promise<HTMLImageElement>((resolve) => {
				const img = new Image();
				img.onload = () => resolve(img);
				img.src = src;
			});
		let mounted = true;
		Promise.all([
			load('/sprites/player.svg'),
			load('/sprites/kebab.svg'),
			load('/sprites/bomb.svg'),
			load('/background/layer1.svg'),
			load('/background/layer2.svg'),
		]).then(([p, k, b, l1, l2]) => {
			if (!mounted) return;
			imgPlayer.current = p;
			imgKebab.current = k;
			imgBomb.current = b;
			bg1.current = l1;
			bg2.current = l2;
			assetsLoaded.current = true;
		});
		return () => {
			mounted = false;
		};
	}, []);

    // Setup audio graph lazily
	const ensureAudio = useCallback(async () => {
		if (audioCtx.current) return;
		const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
		audioCtx.current = ctx;
		const mg = ctx.createGain();
		const sg = ctx.createGain();
		mg.gain.value = muted ? 0 : 0.15;
		sg.gain.value = muted ? 0 : 0.4;
		mg.connect(ctx.destination);
		sg.connect(ctx.destination);
		musicGain.current = mg;
		sfxGain.current = sg;
		// start simple music loop
		const playLoop = () => {
			if (!audioCtx.current || !musicGain.current) return;
			const now = audioCtx.current.currentTime;
			const bpm = 110;
			const beat = 60 / bpm;
			const notes = [0, 2, 4, 7, 4, 2, 0, -3]; // minor-ish motif
			for (let i = 0; i < notes.length; i++) {
				const t = now + i * beat * 0.5;
				const osc = audioCtx.current.createOscillator();
				const gain = audioCtx.current.createGain();
				const freq = 220 * Math.pow(2, notes[i] / 12);
				osc.type = 'triangle';
				osc.frequency.setValueAtTime(freq, t);
				gain.gain.setValueAtTime(0.0001, t);
				gain.gain.exponentialRampToValueAtTime(0.15, t + 0.01);
				gain.gain.exponentialRampToValueAtTime(0.0001, t + beat * 0.45);
				osc.connect(gain).connect(musicGain.current);
				osc.start(t);
				osc.stop(t + beat * 0.5);
			}
			setTimeout(playLoop, beat * 1000 * notes.length * 0.5);
		};
		playLoop();
    }, [muted]);

    const playSfx = useCallback((type: 'eat' | 'hit') => {
		if (!audioCtx.current || !sfxGain.current || muted) return;
		const t = audioCtx.current.currentTime;
		const osc = audioCtx.current.createOscillator();
		const gain = audioCtx.current.createGain();
		osc.type = type === 'eat' ? 'sine' : 'square';
		osc.frequency.setValueAtTime(type === 'eat' ? 660 : 180, t);
		gain.gain.setValueAtTime(0.0001, t);
		gain.gain.exponentialRampToValueAtTime(type === 'eat' ? 0.5 : 0.6, t + 0.01);
		gain.gain.exponentialRampToValueAtTime(0.0001, t + (type === 'eat' ? 0.12 : 0.2));
		osc.connect(gain).connect(sfxGain.current);
		osc.start(t);
		osc.stop(t + 0.25);
    }, [muted]);

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
							playSfx('hit');
                            shakeT.current = 0.25;
                            // red burst
                            for (let i = 0; i < 18; i++) {
                                particles.current.push({
                                    x: it.x,
                                    y: playerRect.y,
                                    vx: (Math.random() - 0.5) * 260,
                                    vy: -Math.random() * 220,
                                    life: 0.4 + Math.random() * 0.3,
                                    color: 'rgba(239,68,68,0.9)',
                                    size: 2 + Math.random() * 2,
                                });
                            }
							if (lives.current <= 0) {
								endGame();
							}
						} else {
							score.current += 1;
							playSfx('eat');
                            // green confetti
                            for (let i = 0; i < 12; i++) {
                                particles.current.push({
                                    x: it.x,
                                    y: playerRect.y,
                                    vx: (Math.random() - 0.5) * 180,
                                    vy: -Math.random() * 160,
                                    life: 0.5 + Math.random() * 0.4,
                                    color: 'rgba(16,185,129,0.9)',
                                    size: 2 + Math.random() * 2,
                                });
                            }
						}
						continue; // consumed
					}
				}
				if (it.y - it.r <= CANVAS_HEIGHT) kept.push(it);
			}
			items.current = kept;

            // Update VFX
            if (shakeT.current > 0) shakeT.current = Math.max(0, shakeT.current - dt);
            const nextParticles: Particle[] = [];
            for (const p of particles.current) {
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.vy += 600 * dt;
                p.life -= dt;
                if (p.life > 0) nextParticles.push(p);
            }
            particles.current = nextParticles;

			// Draw
			ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
			// Background with parallax
			if (assetsLoaded.current && bg1.current && bg2.current) {
				bgOffset1.current = (bgOffset1.current + 20 * dt) % CANVAS_HEIGHT;
				bgOffset2.current = (bgOffset2.current + 40 * dt) % CANVAS_HEIGHT;
				for (const [img, off] of [
					[bg1.current, bgOffset1.current] as const,
					[bg2.current, bgOffset2.current] as const,
				]) {
					ctx.drawImage(img, 0, -off, CANVAS_WIDTH, CANVAS_HEIGHT);
					ctx.drawImage(img, 0, CANVAS_HEIGHT - off, CANVAS_WIDTH, CANVAS_HEIGHT);
				}
			} else {
				ctx.fillStyle = '#0b0b0c';
				ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
			}
            // Skyline silhouettes
            const grd = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
            grd.addColorStop(0, 'rgba(14,165,233,0.05)');
            grd.addColorStop(1, 'rgba(14,165,233,0)');
            ctx.fillStyle = grd;
            for (let i = 0; i < 10; i++) {
                const w = 20 + Math.random() * 40;
                const h = 80 + Math.random() * 160;
                const xPos = (i * 44 + (ts % 400)) % (CANVAS_WIDTH + 80) - 80;
                ctx.fillRect(xPos, FLOOR_Y - h, w, h);
            }
			// Floor line
			ctx.fillStyle = '#1f2937';
			ctx.fillRect(0, FLOOR_Y, CANVAS_WIDTH, CANVAS_HEIGHT - FLOOR_Y);
            // Screen shake offset
            const sx = shakeT.current > 0 ? (Math.random() - 0.5) * 8 * shakeT.current : 0;
            const sy = shakeT.current > 0 ? (Math.random() - 0.5) * 6 * shakeT.current : 0;
            ctx.save();
            ctx.translate(sx, sy);
            // Player sprite
			if (assetsLoaded.current && imgPlayer.current) {
				const pw = 96;
				const ph = 64;
				ctx.drawImage(imgPlayer.current, playerRect.x - (pw - playerRect.w) / 2, playerRect.y - (ph - playerRect.h), pw, ph);
			} else {
				ctx.fillStyle = '#f59e0b';
				ctx.fillRect(playerRect.x, playerRect.y, playerRect.w, playerRect.h);
			}
			// Items
			for (const it of items.current) {
				if (assetsLoaded.current && imgKebab.current && imgBomb.current) {
					if (it.type === 'bomb') {
						ctx.drawImage(imgBomb.current, it.x - 16, it.y - 16, 32, 32);
					} else {
						ctx.drawImage(imgKebab.current, it.x - 14, it.y - 14, 28, 28);
					}
				} else {
					ctx.beginPath();
					ctx.arc(it.x, it.y, it.r, 0, Math.PI * 2);
					if (it.type === 'bomb') {
						ctx.fillStyle = '#111827';
						ctx.fill();
					} else {
						ctx.fillStyle = '#10b981';
						ctx.fill();
					}
				}
			}
            // Particles (additive)
            ctx.globalCompositeOperation = 'lighter';
            for (const p of particles.current) {
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalCompositeOperation = 'source-over';
            ctx.restore();

			// HUD (drawn by React as well, but keep a minimal overlay)
			setHud((prev) => ({ ...prev, score: score.current, lives: lives.current, isRunning: running.current, isGameOver: gameOver.current }));
        },
        [endGame, spawnItem, playSfx]
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
            <div className="mb-2 flex items-center justify-between">
                <div className="flex gap-4">
                    <div className="text-sm">Score: <span className="font-semibold tabular-nums">{hud.score}</span></div>
                    <div className="text-sm">Vies: <span className="font-semibold tabular-nums">{hud.lives}</span></div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => { onToggleMute(); ensureAudio(); if (musicGain.current) musicGain.current.gain.value = muted ? 0.15 : 0; if (sfxGain.current) sfxGain.current.gain.value = muted ? 0.4 : 0; }}
                        className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/15"
                    >
                        {muted ? '🔇' : '🔊'}
                    </button>
                    <button onClick={onExit} className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/15">Menu</button>
                </div>
            </div>
            <div className="relative">
                <canvas
                    ref={canvasRef}
                    onClick={() => { if (!running.current) resetGame(); ensureAudio(); }}
                    className="block rounded border border-white/10 shadow"
                />
                {!hud.isRunning && (
                    <div className="pointer-events-none absolute inset-0 grid place-items-center">
                        <div className="rounded bg-black/60 px-4 py-3 text-center">
                            <div className="text-lg font-semibold">
                                {hud.isGameOver ? 'Perdu !' : 'Kebab Tycoon – Arcade'}
                            </div>
                            <div className="text-sm opacity-80">Entrée ou clic pour {hud.isGameOver ? 'recommencer' : 'commencer'}</div>
                            <div className="mt-2 text-xs opacity-70">Meilleur score: {bestScore.current || 0}</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

