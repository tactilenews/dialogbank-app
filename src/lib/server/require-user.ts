import type { RequestEvent } from "@sveltejs/kit";
import { redirect } from "@sveltejs/kit";

export function requireUser(event: RequestEvent) {
	const user = event.locals.user;

	if (!user) {
		throw redirect(event.request.method === "GET" ? 302 : 303, "/auth/sign-in");
	}

	return user;
}

type MaybePromise<T> = T | Promise<T>;

export function withAuthenticatedLoad<Event extends RequestEvent, Result>(
	handler: (event: Event) => MaybePromise<Result>,
) {
	return (event: Event) => {
		requireUser(event);
		return handler(event);
	};
}

export function withAuthenticatedActions<
	Event extends RequestEvent,
	Actions extends Record<string, (event: Event) => MaybePromise<unknown>>,
>(actions: Actions): Actions {
	return Object.fromEntries(
		Object.entries(actions).map(([key, action]) => [
			key,
			(event: Event) => {
				requireUser(event);
				return action(event);
			},
		]),
	) as Actions;
}
