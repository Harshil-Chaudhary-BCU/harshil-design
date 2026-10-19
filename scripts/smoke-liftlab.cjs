const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '..');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const results = [];
  try {
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport, isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
      const errors = [];
      const failures = [];
      const requests = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('requestfailed', r => failures.push({ url: r.url(), failure: r.failure() }));
      page.on('request', r => requests.push(r.url()));
      await page.goto(`file://${root}/liftlab.html`);
      const structure = await page.evaluate(() => ({
        missingTargets: [...document.querySelectorAll('a[href^="#"]')].filter(a => !document.getElementById(a.hash.slice(1))).map(a => a.hash),
        duplicateIds: [...document.querySelectorAll('[id]')].map(e => e.id).filter((id, i, all) => all.indexOf(id) !== i),
        images: [...document.querySelectorAll('main img')].map(i => ({ src: i.getAttribute('src'), full: i.dataset.fullSrc })),
      }));
      assert.deepEqual(structure.missingTargets, []);
      assert.deepEqual(structure.duplicateIds, []);
      for (const image of structure.images) {
        for (const reference of [image.src, image.full].filter(Boolean)) assert.ok(fs.existsSync(path.resolve(root, reference.split('?')[0])), reference);
      }
      // Visit the entire document, triggering native lazy loading and reveal observers.
      await page.evaluate(async () => {
        for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * .8) {
          scrollTo(0, y);
          await new Promise(resolve => setTimeout(resolve, 18));
        }
        await Promise.all([...document.querySelectorAll('main img')].map(image => image.decode().catch(() => {})));
      });
      const broken = await page.locator('main img').evaluateAll(images => images.filter(i => !i.complete || !i.naturalWidth).map(i => i.src));
      assert.deepEqual(broken, []);
      assert.equal(requests.filter(u => /\/assets\/liftlab\/(?!previews\/).*\.(png|jpe?g)/.test(u)).length, 0, 'Original requested before opening viewer');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Page overflows horizontally');
      const carousels = page.locator('[data-phone-carousel]');
      const counts = [];
      for (let i = 0; i < await carousels.count(); i++) {
        const group = carousels.nth(i);
        const prev = group.locator('[data-phone-prev]');
        const next = group.locator('[data-phone-next]');
        const total = await group.locator('[data-phone-slide]').count();
        assert.ok(await prev.isDisabled());
        for (let n = 1; n < total; n++) await next.click();
        assert.ok(await next.isDisabled());
        assert.equal(await group.locator('[data-phone-current]').textContent(), String(total));
        for (let n = total - 1; n > 0; n--) await prev.click();
        assert.ok(await prev.isDisabled());
        counts.push(total);
      }
      await page.locator('.hero__demo img').click();
      const viewer = page.locator('.case-lightbox');
      await page.waitForFunction(() => document.querySelector('.case-lightbox').classList.contains('is-ready'));
      // Exercise every gallery original, including unloaded slides.
      const galleryCount = await page.locator('.case-lightbox-trigger').count();
      for (let i = 0; i < galleryCount; i++) {
        await page.waitForFunction(() => {
          const viewerImage = document.querySelector('.case-lightbox__stage img');
          const index = Number(document.querySelector('.case-lightbox__count').textContent.split('/')[0]) - 1;
          const source = document.querySelectorAll('.case-lightbox-trigger')[index];
          return viewerImage.complete && viewerImage.naturalWidth > 0 && viewerImage.src === new URL(source.dataset.fullSrc || source.src, document.baseURI).href;
        });
        if (i < galleryCount - 1) await page.locator('.case-lightbox__next').click();
      }
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('Escape');
      assert.equal(await viewer.getAttribute('aria-hidden'), 'true');
      assert.ok(await page.locator('.hero__demo img').evaluate(el => document.activeElement === el));
      // Respect both initial and live OS reduced-motion settings.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => document.documentElement.classList.contains('reduce-motion'));
      assert.equal(await page.locator('[data-reduce-motion]').count(), 0);
      assert.equal(await page.locator('.sus-chart__bars i').first().evaluate(el => getComputedStyle(el).transform), 'matrix(1, 0, 0, 1, 0, 0)');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.waitForFunction(() => !document.documentElement.classList.contains('reduce-motion'));
      await page.locator('.sus-chart').scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      await page.waitForFunction(() => document.querySelector('.sus-chart').classList.contains('is-chart-visible'));
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      await page.waitForFunction(() => !document.querySelector('.sus-chart').classList.contains('is-chart-visible'));
      await page.locator('.sus-chart').scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelector('.sus-chart').classList.contains('is-chart-visible'));
      assert.deepEqual(errors, []);
      assert.deepEqual(failures, []);
      results.push({ viewport, loadedImages: structure.images.length, galleryOriginals: galleryCount, carouselSlides: counts, javascriptErrors: errors.length, failedRequests: failures.length, horizontalOverflow: false, repeatingChart: true, deviceReducedMotion: true });
      await page.close();
    }
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
