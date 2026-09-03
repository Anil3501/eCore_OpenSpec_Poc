import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { env } from '../utils/env.ts';

/**
 * Which channel the application used to report a refused sign-in.
 *
 * `AC-ETA-351-008` requires the two failure responses to be distinguishable,
 * but the exact wording of either message is out of scope for ETA-351. The
 * observed application distinguishes them *structurally* - missing details are
 * reported per field in one container, wrong details produce a single general
 * refusal in a different container - so the comparison is made on the channel
 * rather than on text. See reports/validation/ETA-351-playwright-validation.md.
 */
export type FailureChannel = 'PER_FIELD_VALIDATION' | 'GENERAL_REFUSAL' | 'NONE';

export interface FailureSignal {
  readonly channel: FailureChannel;
  readonly messageCount: number;
}

/** The details the organization sign-in form asks for. */
export interface OrganizationDetails {
  readonly username?: string;
  readonly organization?: string;
  readonly password?: string;
}

export const ORGANIZATION_SIGN_IN = 'Organization Login';
export const BUSINESS_ENTITY_SIGN_IN = 'Business Entity Login';

/**
 * The eCore Command Center login page.
 *
 * Owns every locator and every page-scoped assertion for sign-in. Holds no
 * business data and no credential - those arrive as arguments from the
 * organization-login service.
 *
 * All locators were confirmed against the real application on 2026-08-31 and
 * are recorded in reports/validation/ETA-351-playwright-validation.md.
 */
export class EcoreLoginPage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * The page hosts two forms - the sign-in form and a hidden forgot-password
   * form - and they duplicate the Username, Organization Name and Business
   * Entity field identifiers. Every field locator is therefore scoped to the
   * sign-in form; an unscoped one is a strict-mode violation.
   */
  // VALIDATED - the sign-in form exposes no accessible name or landmark role,
  // so `#eo_cc_login` is the most stable handle available. Confirmed present
  // on 2026-08-31. This is an application accessibility gap, not a shortcut.
  private get form(): Locator {
    return this.page.locator('#eo_cc_login');
  }

  // VALIDATED - the sign-in kind control has no accessible name; `#loginType`
  // is the only stable handle. Confirmed on 2026-08-31.
  private get signInKindChoice(): Locator {
    return this.form.locator('#loginType');
  }

  private get usernameField(): Locator {
    return this.form.getByRole('textbox', { name: 'Username' });
  }

  private get organizationNameField(): Locator {
    return this.form.getByRole('textbox', { name: 'Organization Name' });
  }

  private get businessEntityField(): Locator {
    return this.form.getByRole('textbox', { name: 'Business Entity' });
  }

  /**
   * A password input exposes no implicit ARIA role, so `getByRole` cannot
   * reach it. `getByPlaceholder` is the next option in the preferred order and
   * needs no waiver.
   */
  private get passwordField(): Locator {
    return this.form.getByPlaceholder('Password');
  }

  private get signInButton(): Locator {
    return this.form.getByRole('button', { name: 'Sign In' });
  }

  // VALIDATED - the per-field validation summary carries no ARIA role or
  // accessible name; `#validateTips` is the only stable handle. Confirmed on
  // 2026-08-31.
  private get perFieldValidationSummary(): Locator {
    return this.page.locator('#validateTips');
  }

  // VALIDATED - the general refusal message carries no ARIA role or accessible
  // name; `.errorMessage` is the only stable handle. Confirmed on 2026-08-31.
  private get generalRefusalMessage(): Locator {
    return this.page.locator('.errorMessage');
  }

  /**
   * Opens the login page.
   *
   * The configured base URL serves a browser-capability interstitial that
   * redirects to the login page on its own, so this waits for the sign-in
   * control rather than for a URL. The interstitial carries an 8-second
   * scripted fallback redirect, which is longer than the default assertion
   * timeout, so arrival is given an explicit budget. This is a wait for an
   * observable state, not a fixed sleep.
   */
  async open(): Promise<void> {
    await this.page.goto(env.requireBaseUrl(), { waitUntil: 'domcontentloaded' });
    await expect(this.signInButton).toBeVisible({ timeout: 30_000 });
  }

  async signInKindsOffered(): Promise<string[]> {
    const labels = await this.signInKindChoice.getByRole('option').allInnerTexts();
    return labels.map((label) => label.trim()).filter((label) => label.length > 0);
  }

  async chooseOrganizationSignIn(): Promise<void> {
    await this.signInKindChoice.selectOption({ label: ORGANIZATION_SIGN_IN });
    await expect(this.organizationNameField).toBeVisible();
  }

  /** Types a secret without submitting it. Used to check concealment only. */
  async typeSecret(secret: string): Promise<void> {
    await this.passwordField.fill(secret);
  }

  /**
   * Fills only the details supplied. Omitting a detail is how a
   * "required details left out" scenario is expressed.
   */
  async enterOrganizationDetails(details: OrganizationDetails): Promise<void> {
    if (details.username !== undefined) await this.usernameField.fill(details.username);
    if (details.organization !== undefined) await this.organizationNameField.fill(details.organization);
    if (details.password !== undefined) await this.passwordField.fill(details.password);
  }

  async submit(): Promise<void> {
    await this.signInButton.click();
  }

  // --- page-scoped assertions -------------------------------------------------

  async expectSignInKindChoiceOffered(): Promise<void> {
    await expect(this.signInKindChoice).toBeVisible();
  }

  async expectSignInKindsDistinguishable(): Promise<void> {
    const offered = await this.signInKindsOffered();
    expect(new Set(offered).size).toBe(offered.length);
  }

  async expectOrganizationDetailsRequested(): Promise<void> {
    await expect(this.usernameField).toBeVisible();
    await expect(this.organizationNameField).toBeVisible();
    await expect(this.passwordField).toBeVisible();
  }

  /**
   * The page must ask for the details that belong to the chosen kind and not
   * for every field it supports - the Business Entity field belongs to the
   * other kind and must not be presented at the same time.
   */
  async expectDetailsOfTheOtherKindNotPresented(): Promise<void> {
    await expect(this.businessEntityField).toBeHidden();
  }

  async expectSecretNotReadable(): Promise<void> {
    await expect(this.passwordField).toHaveAttribute('type', 'password');
  }

  async expectStillOnLoginPage(): Promise<void> {
    await expect(this.signInButton).toBeVisible();
  }

  /**
   * Both failure containers are always present in the DOM and the unused one
   * is merely hidden, so they cannot be combined with `Locator.or()` - that
   * matches two elements and trips strict mode. Each is therefore polled for
   * visibility independently.
   */
  async expectSignInFailureReported(): Promise<void> {
    await expect
      .poll(
        async () =>
          (await this.perFieldValidationSummary.isVisible()) ||
          (await this.generalRefusalMessage.isVisible()),
        { message: 'Expected the application to report that the sign-in attempt failed.' },
      )
      .toBe(true);
  }

  /**
   * Records how the application reported a refusal, so two refusals can be
   * compared without depending on message wording.
   */
  async captureFailureSignal(): Promise<FailureSignal> {
    await this.expectSignInFailureReported();

    if (await this.perFieldValidationSummary.isVisible()) {
      // Each missing detail is reported on its own line, so counting lines
      // counts messages without reaching for a structural child selector.
      const text = await this.perFieldValidationSummary.innerText();
      const messages = text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      return { channel: 'PER_FIELD_VALIDATION', messageCount: messages.length };
    }
    if (await this.generalRefusalMessage.isVisible()) {
      const messages = await this.generalRefusalMessage.getByRole('listitem').allInnerTexts();
      return { channel: 'GENERAL_REFUSAL', messageCount: messages.length };
    }
    return { channel: 'NONE', messageCount: 0 };
  }
}
