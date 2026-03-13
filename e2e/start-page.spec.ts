import { schema } from "./lib/db";
import { expect, test } from "./lib/fixtures";

test.describe("Start Page E2E", () => {
	test("displays featured answers when published answers exist", async ({ page, db }) => {
		// Seed the database with a conversation and answers
		await db.insert(schema.conversations).values({
			conversationId: "e2e-conv-test",
			agentId: "e2e-agent-test",
			firstName: "John",
			lastName: "Doe",
			age: 30,
			publicationAllowed: true,
			callSuccessful: "success",
			summary: "Test summary",
		});

		await db.insert(schema.answers).values({
			conversationId: "e2e-conv-test",
			dataCollectionId: "favorite_color",
			value: "Blue",
			rationale: "Said blue is favorite",
		});

		await page.goto("/");

		// Check for featured answer section
		await expect(page.locator("text=Featured Answer")).toBeVisible();

		// Check that the answer value is displayed
		await expect(page.getByText("Blue", { exact: true })).toBeVisible();

		// Check pagination indicator
		await expect(page.locator("text=1 / 1")).toBeVisible();
	});

	test("rotates through multiple featured answers", async ({ page, db }) => {
		// Seed the database with multiple answers
		await db.insert(schema.conversations).values({
			conversationId: "e2e-conv-multiple",
			agentId: "e2e-agent-multiple",
			firstName: "Jane",
			lastName: "Smith",
			age: 25,
			publicationAllowed: true,
			callSuccessful: "success",
			summary: "Test summary",
		});

		await db.insert(schema.answers).values([
			{
				conversationId: "e2e-conv-multiple",
				dataCollectionId: "favorite_color",
				value: "Red",
				rationale: "Prefers red",
			},
			{
				conversationId: "e2e-conv-multiple",
				dataCollectionId: "favorite_food",
				value: "Pizza",
				rationale: "Loves pizza",
			},
		]);

		await page.goto("/");

		// Wait for the featured answer section to be visible
		await expect(page.locator("text=Featured Answer")).toBeVisible();

		// Check initial answer using getByText for specificity
		await expect(page.getByText("Red", { exact: true })).toBeVisible();
		await expect(page.locator("text=1 / 2")).toBeVisible();

		// Wait for rotation (5 seconds)
		await page.waitForTimeout(5500);

		// Check pagination changed to indicate rotation happened
		await expect(page.locator("text=2 / 2")).toBeVisible();
	});

	test("hides featured answer section when no answers exist", async ({ page }) => {
		await page.goto("/", { waitUntil: "networkidle" });

		// Featured Answer container should not be visible (it's wrapped in an if statement)
		const featuredContainer = page.locator("div.rounded-lg.border.border-gray-200");
		await expect(featuredContainer).not.toBeVisible();
	});

	test("only shows answers from conversations with publicationAllowed true", async ({
		page,
		db,
	}) => {
		// Create a conversation with publication allowed
		await db.insert(schema.conversations).values({
			conversationId: "e2e-conv-public",
			agentId: "e2e-agent-public",
			firstName: "Alice",
			lastName: "Public",
			age: 35,
			publicationAllowed: true,
			callSuccessful: "success",
			summary: "Public summary",
		});

		await db.insert(schema.answers).values({
			conversationId: "e2e-conv-public",
			dataCollectionId: "favorite_sport",
			value: "Soccer",
			rationale: "Loves soccer",
		});

		// Create a conversation with publication NOT allowed
		await db.insert(schema.conversations).values({
			conversationId: "e2e-conv-private",
			agentId: "e2e-agent-private",
			firstName: "Bob",
			lastName: "Private",
			age: 40,
			publicationAllowed: false,
			callSuccessful: "success",
			summary: "Private summary",
		});

		await db.insert(schema.answers).values({
			conversationId: "e2e-conv-private",
			dataCollectionId: "favorite_hobby",
			value: "Reading",
			rationale: "Likes reading",
		});

		await page.goto("/");

		// Should show "Soccer" (allowed)
		await expect(page.getByText("Soccer", { exact: true })).toBeVisible();

		// Should NOT show "Reading" (not allowed)
		await expect(page.getByText("Reading", { exact: true })).not.toBeVisible();
	});
});
