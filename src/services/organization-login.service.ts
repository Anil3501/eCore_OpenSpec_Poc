import fs from 'node:fs';
import path from 'node:path';
import { env } from '../utils/env.ts';
import type { OrganizationDetails } from '../pages/ecore-login.page.ts';

interface AccountAccessSampleData {
  dataClassification: string;
  organizationSignIn: {
    wrongDetails: { username: string; organization: string; password: string };
    incompleteDetails: { username: string; organization: string };
    secretForConcealmentCheck: string;
  };
}

const SAMPLE_DATA_PATH = path.join(process.cwd(), 'test-data', 'account-access.sample.json');

function loadSampleData(): AccountAccessSampleData {
  const raw = fs.readFileSync(SAMPLE_DATA_PATH, 'utf8');
  return JSON.parse(raw) as AccountAccessSampleData;
}

/**
 * Decides which set of organization details a scenario signs in with.
 *
 * This is the only place that knows the difference between the real account
 * and fabricated values, which is what keeps that decision out of the step
 * definitions and out of the feature file.
 *
 * Safety rule, and it is not a formality: the login page warns that an account
 * may lock out after a configured number of incorrect attempts. Only
 * `correctDetails()` touches the real account. Every failing path draws from
 * test-data/account-access.sample.json, so a repeated failure lands on values
 * that belong to nobody.
 */
export class OrganizationLoginService {
  private readonly sample: AccountAccessSampleData;

  constructor() {
    this.sample = loadSampleData();
  }

  /**
   * The real account, read from the environment at call time so that
   * scaffolding and validation still work with an empty .env.
   *
   * `EcoreLogin` also carries an `organizationId`, but the observed
   * organization sign-in form never asks for one. It is deliberately not
   * returned here - see discrepancy D-1 in
   * reports/validation/ETA-351-playwright-validation.md. Environment
   * configuration is not a business rule.
   */
  correctDetails(): OrganizationDetails {
    const login = env.requireEcoreLogin();
    return {
      username: login.username,
      organization: login.organization,
      password: login.password,
    };
  }

  /** Complete but fabricated details. Cannot match any real account. */
  wrongDetails(): OrganizationDetails {
    return { ...this.sample.organizationSignIn.wrongDetails };
  }

  /**
   * Fabricated details with the password deliberately omitted, so the
   * application is asked to react to a missing required detail rather than to
   * an incorrect one.
   */
  incompleteDetails(): OrganizationDetails {
    return { ...this.sample.organizationSignIn.incompleteDetails };
  }

  /** A fabricated secret that is typed to check concealment and never submitted. */
  secretForConcealmentCheck(): string {
    return this.sample.organizationSignIn.secretForConcealmentCheck;
  }
}
