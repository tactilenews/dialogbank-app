import { expect, test as base } from '@playwright/test';
import { db as dbInstance, schema } from './lib/db';
import * as seed from 'drizzle-seed';

// Extend base test to include a database reset fixture
const test = base.extend<{ db: typeof dbInstance }>({
	// eslint-disable-next-line no-empty-pattern
	db: async ({}, use) => {
		await seed.reset(dbInstance, schema);
		await use(dbInstance);
	}
});

test.describe('Start Page E2E', () => {
	test('displays the page header and navigation', async ({ page }) => {
		await page.goto('/');

		// Check for main heading
		await expect(page.locator('h1')).toContainText('DialogBank');

		// Check for description
		await expect(page.locator('text=This is a public page for DialogBank')).toBeVisible();

		// Check for Agent Explorer button
		await expect(page.locator('a', { hasText: 'Go to Agent Explorer' })).toBeVisible();
	});

	test('displays sign in button when not authenticated', async ({ page }) => {
		await page.goto('/');

		// Should show Sign in button
		const signInButton = page.locator('a', { hasText: 'Sign in' });
		await expect(signInButton).toBeVisible();

		// Should not show Sign out button
		const signOutButton = page.locator('button', { hasText: 'Sign out' });
		await expect(signOutButton).not.toBeVisible();
	});

	test('displays featured answers when published answers exist', async ({ page, db }) => {
		// Seed the database with a conversation and answers
		await db.insert(schema.conversations).values({
			conversationId: 'e2e-conv-test',
			agentId: 'e2e-agent-test',
			firstName: 'John',
			lastName: 'Doe',
			age: 30,
			publicationAllowed: true,
			callSuccessful: 'success',
			summary: 'Test summary'
		});

		await db.insert(schema.answers).values({
			conversationId: 'e2e-conv-test',
			dataCollectionId: 'favorite_color',
			value: 'Blue',
			rationale: 'Said blue is favorite'
		});

		await page.goto('/');

		// Check for featured answer section
		await expect(page.locator('text=Featured Answer')).toBeVisible();

		// Check that the answer value is displayed
		await expect(page.locator('text=Blue')).toBeVisible();

		// Check pagination indicator
		await expect(page.locator('text=1 / 1')).toBeVisible();
	});

	test('rotates through multiple featured answers', async ({ page, db }) => {
		// Seed the database with multiple answers
		await db.insert(schema.conversations).values({
			conversationId: 'e2e-conv-multiple',
			agentId: 'e2e-agent-multiple',
			firstName: 'Jane',
			lastName: 'Smith',
			age: 25,
			publicationAllowed: true,
			callSuccessful: 'success',
			summary: 'Test summary'
		});

		await db.insert(schema.answers).values([
			{
				conversationId: 'e2e-conv-multiple',
				dataCollectionId: 'favorite_color',
				value: 'Red',
				rationale: 'Prefers red'
			},
			{
				conversationId: 'e2e-conv-multiple',
				dataCollectionId: 'favorite_food',
				value: 'Pizza',
				rationale: 'Loves pizza'
			}
		]);

		await page.goto('/');

		// Wait for the featured answer section to be visible
		await expect(page.locator('text=Featured Answer')).toBeVisible();

		// Check initial answer using getByText for specificity
		await expect(page.getByText('Red', { exact: true })).toBeVisible();
		await expect(page.locator('text=1 / 2')).toBeVisible();

		// Wait for rotation (5 seconds)
		await page.waitForTimeout(5500);

		// Check pagination changed to indicate rotation happened
		await expect(page.locator('text=2 / 2')).toBeVisible();
	});

	// this test needs to reset the database first
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	test('hides featured answer section when no answers exist', async ({ page, db }) => {
		await page.goto('/', { waitUntil: 'networkidle' });

		// Featured Answer container should not be visible (it's wrapped in an if statement)
		const featuredContainer = page.locator('div.rounded-lg.border.border-gray-200');
		await expect(featuredContainer).not.toBeVisible();
	});

	test('only shows answers from conversations with publicationAllowed true', async ({
		page,
		db
	}) => {
		// Create a conversation with publication allowed
		await db.insert(schema.conversations).values({
			conversationId: 'e2e-conv-public',
			agentId: 'e2e-agent-public',
			firstName: 'Alice',
			lastName: 'Public',
			age: 35,
			publicationAllowed: true,
			callSuccessful: 'success',
			summary: 'Public summary'
		});

		await db.insert(schema.answers).values({
			conversationId: 'e2e-conv-public',
			dataCollectionId: 'favorite_sport',
			value: 'Soccer',
			rationale: 'Loves soccer'
		});

		// Create a conversation with publication NOT allowed
		await db.insert(schema.conversations).values({
			conversationId: 'e2e-conv-private',
			agentId: 'e2e-agent-private',
			firstName: 'Bob',
			lastName: 'Private',
			age: 40,
			publicationAllowed: false,
			callSuccessful: 'success',
			summary: 'Private summary'
		});

		await db.insert(schema.answers).values({
			conversationId: 'e2e-conv-private',
			dataCollectionId: 'favorite_hobby',
			value: 'Reading',
			rationale: 'Likes reading'
		});

		await page.goto('/');

		// Should show the public answer
		await expect(page.locator('text=Soccer')).toBeVisible();

		// Should not show the private answer
		await expect(page.locator('text=Reading')).not.toBeVisible();
	});

	test('agent explorer link is clickable', async ({ page }) => {
		await page.goto('/');

		const agentExplorerLink = page.locator('a', { hasText: 'Go to Agent Explorer' });
		await expect(agentExplorerLink).toBeVisible();
		await expect(agentExplorerLink).toHaveAttribute('href', '/dialogbank');
	});
});
