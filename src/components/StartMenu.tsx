"use client";

import Image from 'next/image';

export default function StartMenu({ onStart, muted, onToggleMute }: { onStart: () => void; muted: boolean; onToggleMute: () => void }) {
	return (
		<div className="mx-auto my-6 w-[420px] select-none">
			<div className="rounded border border-white/10 p-4">
				<div className="mb-4 grid place-items-center">
					<Image src="/logo.svg" alt="Kebab Tycoon" width={420} height={140} priority />
				</div>
				<div className="mb-6 text-center text-xs opacity-70">← → pour bouger • Entrée/Clic pour jouer • {muted ? 'Son coupé' : 'Son actif'}</div>
				<div className="flex items-center justify-center gap-3">
					<button onClick={onStart} className="rounded bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15">
						Start
					</button>
					<button onClick={onToggleMute} className="rounded bg-white/10 px-3 py-2 text-xs hover:bg-white/15">
						{muted ? '🔇' : '🔊'}
					</button>
				</div>
			</div>
			<div className="pointer-events-none -mt-[720px] h-[720px] w-[420px]">
				<Image src="/scanlines.svg" alt="scanlines" width={420} height={720} />
			</div>
		</div>
	);
}

