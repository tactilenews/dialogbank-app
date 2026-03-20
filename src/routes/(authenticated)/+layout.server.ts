import { withAuthenticatedLoad } from "$lib/server/require-user";
import type { LayoutServerLoad } from "./$types";

export const load = withAuthenticatedLoad<
	Parameters<LayoutServerLoad>[0],
	ReturnType<LayoutServerLoad>
>(async (event) => {
	return { user: event.locals.user };
});
