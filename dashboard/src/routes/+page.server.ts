import { fetchDevices, fetchLatest } from '$lib/api';

export const load = async () => {
	const [devices, latest] = await Promise.all([fetchDevices(), fetchLatest()]);
	return { devices, latest };
};
