/**
 * Usage: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/eta-411-home-icons-probe.ts
 *
 * ETA-411 asks for tests that "use Home screen icons", but neither the Jira
 * story nor any other governed artifact enumerates those icons. Rather than
 * let requirement analysis invent an icon set, this probe records the one that
 * the application actually renders, so acceptance criteria can cite observed
 * evidence.
 *
 * Scope limit, and it matters: this observes STRUCTURE, not INTENT. It can
 * report that an icon exists, what it is labelled and where it points. It
 * cannot report what the icon is supposed to do, who is allowed to use it, or
 * which of them ETA-411 actually cares about. Those stay ambiguities for a
 * human to answer at Gate 1.
 *
 * Reuses the ETA-351 sign-in sequence. Exactly one attempt with correct
 * details, so the failed-attempt lockout counter is untouched. No credential
 * value is printed or written.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../src/utils/env.ts';

const REPORT_DIR = 'reports/validation';

interface IconCandidate {
  label: string | null;
  accessibleName: string | null;
  href: string | null;
  imageAlt: string | null;
  imageSource: string | null;
  markerClass: string | null;
  tag: string;
  elementId: string | null;
  visible: boolean;
}

async function main(): Promise<void> {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const login = env.requireEcoreLogin();

  const findings: Record<string, unknown> = {
    probe: 'ETA-411-home-icons',
    story: 'ETA-411',
    startedAt: new Date().toISOString(),
    note:
      'Structural observation of the Home page only. Presence of an icon is not a statement ' +
      'of its intended behaviour. No credential value is recorded in this file.',
    configuredLoginType: login.loginType,
  };

  const browser = await chromium.launch();
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  try {
    await page.goto(env.requireBaseUrl(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => undefined);

    // Same scoping as src/pages/ecore-login.page.ts: the page hosts a second,
    // hidden forgot-password form that duplicates these placeholders.
    const form = page.locator('#eo_cc_login');
    await form.locator('#loginType').selectOption({ label: 'Organization Login' });
    await form
      .getByRole('textbox', { name: 'Organization Name' })
      .waitFor({ state: 'visible', timeout: 15_000 });

    await form.getByRole('textbox', { name: 'Username' }).fill(login.username);
    await form.getByRole('textbox', { name: 'Organization Name' }).fill(login.organization);
    await form.getByPlaceholder('Password').fill(login.password);
    await form.getByRole('button', { name: 'Sign In' }).click();

    // Arrival evidence, mirroring EcoreHomePage.expectArrived().
    await page
      .getByRole('link', { name: 'Logout', exact: true })
      .waitFor({ state: 'visible', timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => undefined);

    findings.landedUrl = page.url();
    findings.title = await page.title();

    // Icon candidates: anything actionable that carries an image, an icon-ish
    // class, or an icon-ish accessible name. Deliberately broad - a human
    // narrows it at Gate 1, an agent must not narrow it by guessing.
    findings.iconCandidates = await page.evaluate((): IconCandidate[] => {
      const iconClass = /(icon|fa-|glyph|sprite|btn-img|toolbar)/i;
      const seen = new Set<Element>();
      const out: IconCandidate[] = [];

      const actionable = Array.from(
        document.querySelectorAll('a, button, [role="button"], [role="link"], input[type="image"]'),
      );

      for (const el of actionable) {
        if (seen.has(el)) continue;
        seen.add(el);

        const image = el.querySelector('img, svg, i');
        const classes = el.className && typeof el.className === 'string' ? el.className : '';
        const hasIconClass = iconClass.test(classes);
        const innerIconClass =
          image instanceof Element && typeof image.className === 'string'
            ? iconClass.test(image.className)
            : false;

        if (!image && !hasIconClass && !innerIconClass) continue;

        const img = el.querySelector('img');
        const rect = el.getBoundingClientRect();

        out.push({
          label: (el.textContent || '').replace(/\s+/g, ' ').trim() || null,
          accessibleName:
            el.getAttribute('aria-label') || el.getAttribute('title') || null,
          href: el.getAttribute('href'),
          imageAlt: img?.getAttribute('alt') ?? null,
          imageSource: img?.getAttribute('src') ?? null,
          markerClass: hasIconClass ? classes.trim() : innerIconClass ? String((image as Element).className).trim() : null,
          tag: el.tagName.toLowerCase(),
          elementId: el.id || null,
          visible: rect.width > 0 && rect.height > 0,
        });
      }

      return out.slice(0, 120);
    });

    // Every named link, so an icon that carries no image still shows up.
    findings.allNamedLinks = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a'))
        .map((el) => ({
          text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
          href: el.getAttribute('href'),
          title: el.getAttribute('title'),
        }))
        .filter((l) => l.text.length > 0 || l.title)
        .slice(0, 80),
    );

    // The story says the user returns Home by clicking "Command Center in the
    // upper left corner". That control has no link text, so the named-link
    // sweep above misses it entirely. Capture every actionable element in the
    // top band of the page - including text-less ones - with geometry and any
    // CSS background image, so the return-to-Home control can be identified
    // from evidence instead of assumed.
    findings.topLeftControls = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a, button, [role="button"]'))
        .map((el) => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return {
            tag: el.tagName.toLowerCase(),
            text: (el.textContent || '').replace(/\s+/g, ' ').trim() || null,
            href: el.getAttribute('href'),
            title: el.getAttribute('title'),
            ariaLabel: el.getAttribute('aria-label'),
            className: typeof el.className === 'string' ? el.className.trim() || null : null,
            elementId: el.id || null,
            backgroundImage: style.backgroundImage === 'none' ? null : style.backgroundImage,
            top: Math.round(rect.top),
            left: Math.round(rect.left),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        })
        .filter((c) => c.top < 160 && c.width > 0 && c.height > 0)
        .sort((a, b) => a.top - b.top || a.left - b.left)
        .slice(0, 40),
    );

    // Anything in the masthead that is not a link but might carry the branding.
    findings.brandingElements = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[class*="logo" i], [id*="logo" i], [class*="brand" i], [class*="header" i], [class*="banner" i]'))
        .map((el) => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return {
            tag: el.tagName.toLowerCase(),
            elementId: el.id || null,
            className: typeof el.className === 'string' ? el.className.trim() || null : null,
            text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) || null,
            backgroundImage: style.backgroundImage === 'none' ? null : style.backgroundImage,
            insideLinkHref: el.closest('a')?.getAttribute('href') ?? null,
            top: Math.round(rect.top),
            left: Math.round(rect.left),
          };
        })
        .slice(0, 30),
    );

    // Exhaustive sweep of the upper-left region, every tag, so a branding
    // control implemented as a styled div with a click handler is still found.
    findings.upperLeftRegion = await page.evaluate(() =>
      Array.from(document.querySelectorAll('*'))
        .map((el) => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return {
            tag: el.tagName.toLowerCase(),
            elementId: el.id || null,
            className: typeof el.className === 'string' ? el.className.trim() || null : null,
            ownText: Array.from(el.childNodes)
              .filter((n) => n.nodeType === 3)
              .map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim())
              .join(' ')
              .trim() || null,
            backgroundImage: style.backgroundImage === 'none' ? null : style.backgroundImage,
            cursor: style.cursor,
            hasInlineClick: el.hasAttribute('onclick'),
            insideLinkHref: el.closest('a')?.getAttribute('href') ?? null,
            top: Math.round(rect.top),
            left: Math.round(rect.left),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        })
        .filter(
          (c) =>
            c.top >= 0 &&
            c.top < 130 &&
            c.left < 460 &&
            c.width > 0 &&
            c.height > 0 &&
            (c.backgroundImage !== null ||
              c.hasInlineClick ||
              c.cursor === 'pointer' ||
              c.ownText !== null ||
              c.insideLinkHref !== null),
        )
        .slice(0, 60),
    );

    findings.headings = await page.evaluate(() =>
      Array.from(document.querySelectorAll('h1, h2, h3'))
        .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
        .filter((t) => t.length > 0)
        .slice(0, 25),
    );

    findings.images = await page.evaluate(() =>
      Array.from(document.querySelectorAll('img'))
        .map((el) => ({
          alt: el.getAttribute('alt'),
          title: el.getAttribute('title'),
          src: el.getAttribute('src'),
          insideLink: Boolean(el.closest('a')),
          linkHref: el.closest('a')?.getAttribute('href') ?? null,
        }))
        .slice(0, 80),
    );

    await page.screenshot({
      path: path.join(REPORT_DIR, 'ETA-411-home-icons.png'),
      fullPage: true,
    });

    // Behavioural walk. An href is not proof of where a click lands: a
    // redirect, an interstitial or a permission check can intervene. The story
    // requires that each icon takes the user "to the correct page" and that
    // the Command Center control returns them Home, so both legs are observed
    // rather than inferred.
    const homeUrl = page.url();
    const walk: Array<Record<string, unknown>> = [];

    for (const iconName of ['New Transaction', 'Workspace', 'Preferences']) {
      const leg: Record<string, unknown> = { icon: iconName };
      try {
        await page.goto(homeUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        // Scope to #icon-buttons: the header navigation bar repeats all three
        // names, so an unscoped accessible-name lookup is ambiguous.
        await page.locator('#icon-buttons').getByRole('link', { name: iconName, exact: true }).click();
        await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => undefined);

        leg.landedUrl = page.url();
        leg.landedTitle = await page.title();
        leg.landedHeadings = await page.evaluate(() =>
          Array.from(document.querySelectorAll('h1, h2, h3'))
            .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
            .filter((t) => t.length > 0)
            .slice(0, 6),
        );

        // Return leg: the upper-left Command Center branding control.
        const banner = page.locator('#bannerBackground');
        leg.commandCenterPresent = (await banner.count()) > 0;
        if (leg.commandCenterPresent) {
          await banner.click();
          await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => undefined);
          leg.afterCommandCenterUrl = page.url();
          leg.returnedHome = page.url() === homeUrl;
        }
        leg.status = 'OBSERVED';
      } catch (error) {
        leg.status = 'FAILED';
        leg.error = error instanceof Error ? error.message : String(error);
      }
      walk.push(leg);
    }

    findings.navigationWalk = walk;
    findings.homeUrl = homeUrl;
    findings.status = 'OBSERVED';
  } catch (error) {
    findings.status = 'FAILED';
    findings.error = error instanceof Error ? error.message : String(error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }

  const out = path.join(REPORT_DIR, 'ETA-411-home-icons-probe.json');
  fs.writeFileSync(out, JSON.stringify(findings, null, 2) + '\n', 'utf8');

  console.log('status : ' + findings.status);
  if (findings.error) console.log('error  : ' + findings.error);
  console.log('url    : ' + findings.landedUrl);
  console.log('title  : ' + findings.title);
  console.log('\nheadings:\n' + JSON.stringify(findings.headings ?? null, null, 2));
  console.log('\nicon candidates:\n' + JSON.stringify(findings.iconCandidates ?? null, null, 2));
  console.log('\ntop-left controls:\n' + JSON.stringify(findings.topLeftControls ?? null, null, 2));
  console.log('\nbranding elements:\n' + JSON.stringify(findings.brandingElements ?? null, null, 2));
  console.log('\nreport -> ' + out);
}

await main();
