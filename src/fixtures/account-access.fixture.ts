import type { Page } from '@playwright/test';
import { EcoreLoginPage, type FailureSignal } from '../pages/ecore-login.page.ts';
import { OrganizationLoginService } from '../services/organization-login.service.ts';

/**
 * Scenario-scoped scratch space.
 *
 * `AC-ETA-351-008` asserts a relationship between two separate sign-in
 * responses, which no single attempt can demonstrate. The scenario needs
 * somewhere to hold the first response while it produces the second, and a
 * fixture keeps that state out of module scope where it would leak between
 * scenarios.
 */
export interface SignInResponseMemory {
  remembered?: FailureSignal;
}

export interface AccountAccessFixtures {
  loginPage: EcoreLoginPage;
  organizationLogin: OrganizationLoginService;
  signInResponseMemory: SignInResponseMemory;
}

export const accountAccessFixture = {
  loginPage: async ({ page }: { page: Page }, use: (p: EcoreLoginPage) => Promise<void>) => {
    await use(new EcoreLoginPage(page));
  },
  // eslint-disable-next-line no-empty-pattern
  organizationLogin: async ({}, use: (s: OrganizationLoginService) => Promise<void>) => {
    await use(new OrganizationLoginService());
  },
  // eslint-disable-next-line no-empty-pattern
  signInResponseMemory: async ({}, use: (m: SignInResponseMemory) => Promise<void>) => {
    await use({});
  },
};
