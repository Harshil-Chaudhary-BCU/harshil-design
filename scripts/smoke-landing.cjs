const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.SMOKE_BASE || 'http://127.0.0.1:4174';
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    for (const scenario of [
      { name: 'desktop', width: 1440, height: 900 },
      { name: 'phone', width: 390, height: 844, touch: true },
      { name: 'reduced-motion', width: 1440, height: 900, reduced: true },
      { name: 'no-javascript', width: 390, height: 844, noJS: true },
      { name: 'delayed-scripts', width: 390, height: 844, delayed: true },
    ]) {
      const context = await browser.newContext({ viewport: { width: scenario.width, height: scenario.height }, hasTouch: !!scenario.touch, isMobile: !!scenario.touch, javaScriptEnabled: !scenario.noJS, reducedMotion: scenario.reduced ? 'reduce' : 'no-preference' });
      const page = await context.newPage();
      const errors = [], failed = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(base)) failed.push(`${r.status()} ${r.url()}`); });
      if (scenario.delayed) await page.route('**/*.js*', async route => { await new Promise(r => setTimeout(r, 2500)); await route.continue(); });
      await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(scenario.delayed ? 7000 : 3500);
      assert.equal(await page.title(), 'Harshil.design');
      assert.equal(await page.locator('html').getAttribute('lang'), 'en');
      assert.equal(await page.locator('img:not([alt])').count(), 0);
      for (const id of ['about', 'work', 'resume', 'contact']) {
        await page.locator(`#${id}`).evaluate(el => el.scrollIntoView());
        await page.waitForTimeout(1000);
        assert(await page.locator(`#${id}`).isVisible(), `${id} missing`);
        await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 2, { timeout: 5000 });
      }
      assert(await page.locator('#contact a[href^="mailto:"]').count() > 0);
      assert.equal(await page.locator('.resume-actions button:disabled').count(), 2);
      const badAnchors = await page.locator('a[href^="#"]').evaluateAll(links => links.map(a => a.getAttribute('href')).filter(href => href.length > 1 && !document.getElementById(href.slice(1))));
      assert.deepEqual(badAnchors, []);
      if (!scenario.noJS) {
        await page.locator('#work').evaluate(el => el.scrollIntoView({block:'start'}));
        await page.waitForTimeout(800);
        await page.locator('[data-work-project="1"]').click();
        await page.waitForTimeout(550);
        assert.match(await page.locator('.work-carousel-status').innerText(), /OTVerse/);
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(550);
        assert.match(await page.locator('.work-carousel-status').innerText(), /OffRoad/);
        await page.locator('[data-work-project="0"]').click();
        await page.waitForTimeout(550);
        await page.locator('a[href="./liftlab.html"]').click();
        await page.waitForURL('**/liftlab.html');
        assert(await page.locator('h1').isVisible());
        await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3500);
        if (await page.locator('.compact-menu-toggle').isVisible()) {
          await page.locator('.compact-menu-toggle').click();
          assert.equal(await page.locator('.compact-menu-toggle').getAttribute('aria-expanded'), 'true');
          await page.locator('.compact-menu-panel a[href="#about"]').click();
        } else if (await page.locator('.index-nav a[href="#about"]').isVisible()) await page.locator('.index-nav a[href="#about"]').click();
        else await page.locator('.hero-scroll').click();
        await page.waitForTimeout(7600);
        assert.equal(new URL(page.url()).hash, '#about');
        const top = await page.locator('.about-introduction h2').evaluate(el => el.getBoundingClientRect().top);
        assert(top >= 0 && top < scenario.height * .6, `About framing ${top}`);
        if (scenario.width < 1100) {
          await page.locator('.compact-menu-toggle').click();
          assert.equal(await page.locator('.compact-menu-toggle').getAttribute('aria-expanded'), 'true');
          await page.keyboard.press('Escape');
          assert.equal(await page.locator('.compact-menu-toggle').getAttribute('aria-expanded'), 'false');
        }
      }
      await page.screenshot({ path: `/tmp/landing-smoke-${scenario.name}.png` });
      assert.deepEqual(errors, [], `${scenario.name} script errors`);
      assert.deepEqual(failed, [], `${scenario.name} missing resources`);
      console.log(`PASS ${scenario.name}: sections, navigation, links, layout, accessibility basics, resources`);
      await context.close();
    }
    const page = await browser.newPage();
    await page.goto(`${base}/404.html`);
    assert(await page.getByRole('heading', {name: /This page took/}).isVisible());
    await page.getByRole('link', {name: 'Back to home'}).click();
    await page.waitForURL('**/index.html');
    console.log('PASS 404 recovery');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
