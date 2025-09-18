"use client";

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type UpgradeId = 'grill' | 'chef' | 'franchise';

export type Upgrade = {
	id: UpgradeId;
	name: string;
	description: string;
	baseCost: number;
	costMultiplier: number;
	addsKebabsPerSecond?: number;
	addsKebabsPerClick?: number;
};

export const UPGRADES_CATALOG: Record<UpgradeId, Upgrade> = {
	grill: {
		id: 'grill',
		name: 'Grill',
		description: 'Un petit grill qui cuisine des kebabs automatiquement.',
		baseCost: 10,
		costMultiplier: 1.15,
		addsKebabsPerSecond: 0.5,
	},
	chef: {
		id: 'chef',
		name: 'Chef',
		description: 'Un chef augmente les kebabs par clic.',
		baseCost: 20,
		costMultiplier: 1.25,
		addsKebabsPerClick: 1,
	},
	franchise: {
		id: 'franchise',
		name: 'Franchise',
		description: 'Ouvre une boutique — gros revenu passif.',
		baseCost: 100,
		costMultiplier: 1.3,
		addsKebabsPerSecond: 5,
	},
};

export type GameState = {
	kebabs: number;
	kebabsPerClick: number;
	kebabsPerSecond: number;
	owned: Record<UpgradeId, number>;
	getUpgradeCost: (id: UpgradeId) => number;
	canBuy: (id: UpgradeId) => boolean;
	buy: (id: UpgradeId) => boolean;
	cook: () => void;
	tick: (deltaSeconds: number) => void;
	reset: () => void;
};

const initialOwned: Record<UpgradeId, number> = {
	chef: 0,
	grill: 0,
	franchise: 0,
};

export const useGameStore = create<GameState>()(
	persist(
		(set, get) => ({
			kebabs: 0,
			kebabsPerClick: 1,
			kebabsPerSecond: 0,
			owned: { ...initialOwned },

			getUpgradeCost: (id) => {
				const upgrade = UPGRADES_CATALOG[id];
				const count = get().owned[id] ?? 0;
				const cost = Math.floor(upgrade.baseCost * Math.pow(upgrade.costMultiplier, count));
				return Math.max(cost, 1);
			},

			canBuy: (id) => get().kebabs >= get().getUpgradeCost(id),

			buy: (id) => {
				const cost = get().getUpgradeCost(id);
				if (get().kebabs < cost) return false;
				const nextOwned = { ...get().owned, [id]: (get().owned[id] ?? 0) + 1 } as Record<UpgradeId, number>;
				const upgrade = UPGRADES_CATALOG[id];
				set((state) => ({
					kebabs: state.kebabs - cost,
					owned: nextOwned,
					kebabsPerClick: state.kebabsPerClick + (upgrade.addsKebabsPerClick ?? 0),
					kebabsPerSecond: state.kebabsPerSecond + (upgrade.addsKebabsPerSecond ?? 0),
				}));
				return true;
			},

			cook: () => set((s) => ({ kebabs: s.kebabs + s.kebabsPerClick })),

			tick: (deltaSeconds) => {
				if (deltaSeconds <= 0) return;
				set((s) => ({ kebabs: s.kebabs + s.kebabsPerSecond * deltaSeconds }));
			},

			reset: () =>
				set({ kebabs: 0, kebabsPerClick: 1, kebabsPerSecond: 0, owned: { ...initialOwned } }),
		}),
		{
			name: 'kebab-tycoon-v1',
			storage: createJSONStorage(() => localStorage),
			version: 1,
		}
	)
);

