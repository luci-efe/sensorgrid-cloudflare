import { fetchDevices, fetchLatest } from '$lib/api';
import type { Device, LatestReading } from '$lib/mock';

export type SensorGroup = {
	label: string;
	am307: Device | null;
	ct101: Device | null;
};

export const load = async () => {
	const [devices, latest] = await Promise.all([fetchDevices(), fetchLatest()]);

	// Build fridge groups
	const fridgeMap = new Map<string, { am307: Device | null; ct101: Device | null }>();
	const ungrouped: Device[] = [];

	for (const d of devices) {
		if (!d.fridge_label) {
			ungrouped.push(d);
			continue;
		}
		if (!fridgeMap.has(d.fridge_label)) {
			fridgeMap.set(d.fridge_label, { am307: null, ct101: null });
		}
		const group = fridgeMap.get(d.fridge_label)!;
		if (d.type === 'ambient') group.am307 = d;
		if (d.type === 'power')   group.ct101 = d;
	}

	const sensorGroups: SensorGroup[] = [...fridgeMap.entries()].map(([label, { am307, ct101 }]) => ({
		label, am307, ct101,
	}));

	return { sensorGroups, ungrouped, latest };
};
