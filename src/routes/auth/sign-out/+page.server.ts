import { redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
	const auth = event.locals.auth;
	await auth.api.signOut({
		headers: event.request.headers,
	});
	return redirect(302, "/");
};

export const actions: Actions = {
	default: async (event) => {
		const auth = event.locals.auth;
		await auth.api.signOut({
			headers: event.request.headers,
		});
		return redirect(302, "/");
	},
};
