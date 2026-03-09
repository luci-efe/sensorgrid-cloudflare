import { fetchDevices } from '$lib/api';

export const load = async () => {
	// Alert rules are read-only in the mock; CRUD will call the Worker API directly.
	return { devices: await fetchDevices() };
};
