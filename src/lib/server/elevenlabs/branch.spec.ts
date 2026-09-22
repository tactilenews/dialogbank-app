import { describe, expect, it } from "vitest";
import { selectLatestCommittedVersionId } from "./branch";

describe("selectLatestCommittedVersionId", () => {
	it("returns the highest sequence number from the branch versions", () => {
		expect(
			selectLatestCommittedVersionId({
				mostRecentVersions: [
					{ id: "version_1", seqNoInBranch: 1, timeCommittedSecs: 100 },
					{ id: "version_3", seqNoInBranch: 3, timeCommittedSecs: 90 },
					{ id: "version_2", seqNoInBranch: 2, timeCommittedSecs: 110 },
				],
			}),
		).toBe("version_3");
	});

	it("breaks a tied sequence number using the most recently committed version", () => {
		expect(
			selectLatestCommittedVersionId({
				mostRecentVersions: [
					{ id: "version_a", seqNoInBranch: 3, timeCommittedSecs: 90 },
					{ id: "version_b", seqNoInBranch: 3, timeCommittedSecs: 110 },
				],
			}),
		).toBe("version_b");
	});

	it("throws when there are no committed versions", () => {
		expect(() => selectLatestCommittedVersionId({ mostRecentVersions: [] })).toThrow(
			"The configured ElevenLabs branch has no committed versions to branch from",
		);
	});
});
