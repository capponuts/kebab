"use client";

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useRef, useState } from 'react';
import type { Mesh } from 'three';

function SpinningCube() {
	const meshRef = useRef<Mesh>(null);
	const [hovered, setHovered] = useState(false);
	const [active, setActive] = useState(false);

	return (
		<mesh
			ref={meshRef}
			onClick={() => setActive((a) => !a)}
			onPointerOver={() => setHovered(true)}
			onPointerOut={() => setHovered(false)}
			scale={active ? 1.3 : 1}
			rotation={[0.5, 0.8, 0]}
		>
			<boxGeometry args={[1, 1, 1]} />
			<meshStandardMaterial color={hovered ? '#10b981' : '#60a5fa'} />
		</mesh>
	);
}

export default function HomePage() {
	return (
		<main className="min-h-screen grid grid-rows-[auto_1fr]">
			<header className="p-4 text-center text-sm opacity-80">Kebab – minimal R3F scene</header>
			<section className="relative">
				<Canvas camera={{ position: [2.5, 2.5, 2.5], fov: 60 }}>
					<ambientLight intensity={0.6} />
					<directionalLight position={[5, 5, 5]} intensity={1} />
					<SpinningCube />
					<OrbitControls enableDamping />
				</Canvas>
				<div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded bg-white/10 px-3 py-1 text-xs">
					Click cube to scale • Drag to orbit
				</div>
			</section>
		</main>
	);
}

