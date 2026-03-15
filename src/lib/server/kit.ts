import type { RequestEvent, RequestHandler } from "@sveltejs/kit";

export type LocalsSubset<Keys extends keyof App.Locals> = Pick<App.Locals, Keys> &
	Partial<App.Locals>;

export type RequestEventWithLocals<
	Locals extends Partial<App.Locals>,
	RouteId extends RequestEvent["route"]["id"] = RequestEvent["route"]["id"],
	Params extends Record<string, never> = Record<string, never>,
> = Omit<RequestEvent<Params, RouteId>, "locals"> & { locals: Locals };

export type RequestHandlerWithLocals<
	Locals extends Partial<App.Locals>,
	RouteId extends RequestEvent["route"]["id"] = RequestEvent["route"]["id"],
	Params extends Record<string, never> = Record<string, never>,
> = (event: RequestEventWithLocals<Locals, RouteId, Params>) => ReturnType<RequestHandler>;
