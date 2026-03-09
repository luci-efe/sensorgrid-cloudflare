import { fetchDevices } from '$lib/api';

export const load = async () => {
	return { devices: await fetchDevices() };
};
