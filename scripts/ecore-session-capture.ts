/**
 * Usage: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/ecore-session-capture.ts
 *
 * Signs in to eCore once and writes the authenticated storage state to
 * .auth/ecore-session.json so an exploration tool can resume the session
 * without ever handling the password.
 *
 * This exists for a security reason, not a convenience one. Contract discovery
 * through Playwright MCP needs an authenticated browser, but every value passed
 * to an MCP tool is recorded in the conversation transcript. Typing the
 * password through MCP would put a live credential there permanently. Reading
 * it from the environment inside this process keeps it out.
 *
 * The output file is a session credential: it grants access exactly as the
 * password does, for as long as the session lives. .auth/ is git-ignored.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { env } from '../src/utils/env.ts';

const AUTH_DIR = '.auth';
const STATE_PATH = `${AUTH_DIR}/ecore-session.json`;

async function main(): Promise<void> {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const login = env.requireEcoreLogin();

  const browser = await chromium.launch();
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  try {
    await page.goto(env.requireBaseUrl(), { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const form = page.locator('#eo_cc_login');
    await form.locator('#loginType').selectOption({ label: login.loginType });
    await form
      .getByRole('textbox', { name: 'Organization Name' })
      .waitFor({ state: 'visible', timeout: 15_000 });
    await form.getByRole('textbox', { name: 'Username' }).fill(login.username);
    await form.getByRole('textbox', { name: 'Organization Name' }).fill(login.organization);
    await form.getByPlaceholder('Password').fill(login.password);
    await form.getByRole('button', { name: 'Sign In' }).click();
    await page
      .getByRole('link', { name: 'Logout', exact: true })
      .waitFor({ state: 'visible', timeout: 60_000 });

    await context.storageState({ path: STATE_PATH });

    console.log(`Signed in. Landed on: ${new URL(page.url()).pathname}`);
    console.log(`Storage state written to: ${STATE_PATH} (git-ignored, treat as a credential)`);
  } finally {
    await browser.close();
  }
}

await main();
