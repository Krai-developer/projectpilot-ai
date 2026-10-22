import { test, expect } from '@playwright/test';

test('Full ProjectPilot AI E2E Workflow: Register, Create Project, Requirements & Tasks, Assessment, Completion Gate, Confirmation, and Invalidation', async ({
  page,
}) => {
  const uniqueEmail = `e2e-${Date.now()}@example.com`;

  // 1. Register a new account
  await page.goto('/login');
  await page.getByRole('tab', { name: 'Create Account' }).click();
  await page.getByLabel('Full Name').fill('E2E Test Engineer');
  await page.getByLabel('Email Address').fill(uniqueEmail);
  await page.getByLabel(/Password/i).fill('StrongE2EPass123!');
  await page.getByRole('button', { name: 'Create Account' }).click();

  // Verify redirect to Dashboard
  await expect(page.getByRole('heading', { name: 'Project Completion Dashboard' })).toBeVisible();

  // 2. Create a new project
  await page.getByRole('link', { name: 'New Project' }).first().click();
  await page.getByLabel('Project Name *').fill('Autonomous Drone Telemetry');
  await page.getByLabel('Description').fill('Real-time flight telemetry and safety cutoff system');
  await page.getByLabel('Objectives').fill('Zero packet loss on safety channel');
  await page.getByLabel('Initial Status').selectOption('In Progress');
  await page.getByRole('dialog').getByRole('button', { name: 'Create Project' }).click();

  await expect(page.getByRole('heading', { name: 'Autonomous Drone Telemetry' })).toBeVisible();

  // 3. Add a mandatory requirement
  await page.getByRole('tab', { name: /Requirements/i }).click();
  await page.getByLabel('Requirement Title *').fill('Safety Cutoff Signal Verification');
  await page.getByLabel('Acceptance Criteria').fill('Hardware-in-loop test passes');
  await page.getByRole('button', { name: 'Add Requirement' }).click();

  await expect(page.getByText('Safety Cutoff Signal Verification')).toBeVisible();
  await expect(page.getByText('Unmapped Mandatory Requirement')).toBeVisible();

  // 4. Add a required task linked to the mandatory requirement
  await page.getByRole('tab', { name: /Tasks/i }).click();
  await page.getByRole('button', { name: 'Add Task' }).click();
  await page.getByLabel('Task Title *').fill('Implement emergency cutoff handler');
  await page.getByLabel('Weight (>0)').fill('5.0');
  await page.getByLabel(/Safety Cutoff Signal Verification/i).check();
  await page.getByRole('button', { name: 'Save Task' }).click();

  await expect(page.getByText('Implement emergency cutoff handler', { exact: true })).toBeVisible();

  // 5. Run an assessment while work is incomplete & inspect missing work
  await page.getByRole('button', { name: 'Assess Project Completion' }).click();
  await expect(page.getByText('Overall Summary')).toBeVisible();
  await expect(page.getByText(/Implement emergency cutoff handler/i).first()).toBeVisible();

  // 6. Update task status to Done
  await page.getByRole('tab', { name: /Tasks/i }).click();
  await page
    .getByLabel('Status for Implement emergency cutoff handler')
    .selectOption('Done');
  await expect(page.getByTestId('project-progress-value')).toHaveText('100%');

  // 7. Complete required verification checks (Evidence + Requirement Satisfied)
  await page.getByRole('tab', { name: /Evidence/i }).click();
  await page.getByLabel('Evidence Summary / Test Output *').fill('HIL test suite 15/15 passed');
  await page.getByLabel('Initial Verification Status').selectOption('verified');
  await page.getByRole('button', { name: 'Save Evidence' }).click();
  await expect(page.getByText('HIL test suite 15/15 passed')).toBeVisible();

  await page.getByRole('tab', { name: /Requirements/i }).click();
  await page.getByLabel('Requirement Status').selectOption('Satisfied');

  // 8. Confirm Project Completion via explicit confirmation modal
  const completeBtn = page.getByRole('button', { name: 'Complete Project' });
  await expect(completeBtn).toBeVisible();
  await completeBtn.click();

  await page
    .getByLabel(/I confirm that all mandatory acceptance criteria/i)
    .check();
  await page.getByRole('button', { name: 'Mark Project Completed' }).click();
  await expect(page.getByText('Project officially marked as Completed.')).toBeVisible();

  // 9. Reopen the required task and verify project completion & assessment invalidation
  await page.getByRole('tab', { name: /Tasks/i }).click();
  await page
    .getByLabel('Status for Implement emergency cutoff handler')
    .selectOption('In Progress');

  await expect(page.getByTestId('project-progress-value')).toHaveText('0%');
  await page.getByRole('tab', { name: /Assessment History/i }).click();
  await expect(page.getByText(/Stale \(Invalidated by Project Changes\)/i)).toBeVisible();
});
