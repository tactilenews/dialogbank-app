type NavigationState = {
	to: unknown | null;
};

export function hasPendingNavigation(navigation: NavigationState) {
	return navigation.to !== null;
}
