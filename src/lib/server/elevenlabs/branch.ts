export type AgentBranchVersion = {
	id: string;
	seqNoInBranch: number;
	timeCommittedSecs: number;
};

export function selectLatestCommittedVersionId(branch: {
	mostRecentVersions?: AgentBranchVersion[];
}): string {
	const latestVersion = [...(branch.mostRecentVersions ?? [])].sort((left, right) => {
		if (left.seqNoInBranch !== right.seqNoInBranch) {
			return right.seqNoInBranch - left.seqNoInBranch;
		}

		return right.timeCommittedSecs - left.timeCommittedSecs;
	})[0];

	if (!latestVersion) {
		throw new Error("The configured ElevenLabs branch has no committed versions to branch from");
	}

	return latestVersion.id;
}
