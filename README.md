# Harshil.design portfolio

Static HTML, CSS, and JavaScript. No build step is required. Serve the project
root over HTTP; the particle logo uses locally bundled ES modules and WebGL.

## Publication

Public repository: `Harshil-Chaudhary-BCU/harshil-design`.
The separate OTVERSE repository and `otverse.ai` are not part of this deployment.
GitHub Actions packages runtime dependencies into `dist/` and deploys them to
GitHub Pages on pushes to `main`. Local review output and disconnected case
studies are excluded. Run `node scripts/package-site.mjs` to check the package
locally. The 404 base path is set during deployment to support a project URL.

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

## Pages and code

- `index.html`: landing page; its stylesheet and script tags are the source of truth for dependencies.
- `liftlab.html`: LiftLab case study and portfolio return navigation.
- `about.html`: standalone About page; its supporting files remain in use.
- `404.html`: responsive error page. Configure the eventual host to serve it for missing URLs with HTTP status 404; the simple local server does not automatically do this.
- `design-system.css` and `typography.css`: shared widths, spacing, type tokens, and local Geist fonts.
- `landing-system.css`: final landing-page layout and responsive overrides.
- `landing-motion.*`, `studio-tag.js`, and `hc-model-v2/`: hero and particle-logo rendering.
- `work-carousel.*` and `work-card-physics.js`: draggable, keyboard-accessible project carousel.
- `resume-journey.*`: pinned timeline above and below the 1100px breakpoint. Windows shorter than 560px and reduced-motion preferences use the readable normal-flow layout.
- `editorial.js` and `compact-menu.js`: section progress and compact navigation.
- `connect-footer.css` and `connect-motion.js`: Contact layout and rigid-letter arc motion.
- `cursor.*`, `preloader.*`, `smooth-scroll.js`, and `portfolio-return.js`: shared interaction behaviour.

Keep `assets/`, font files, vendor modules, and their licence notices. The
original `hc-model/`, SVG preview, and export scripts are source/preview tools,
not dependencies to strip blindly. `tmp/` and `output/` contain review images
and existing exports; they are not required by the landing page.

## Responsive audit — 10 October 2026

Checked in the Codex in-app browser at 320, 390, 768, 1024, 1100, 1101, 1440,
and 1920 CSS-pixel widths. No document-width overflow or broken landing-page
images were found. Also checked the short 844 × 390 landscape layout and
restoration to the animated portrait layout.

Interaction checks covered section navigation, compact-menu opening/closing,
project selectors, one-slot dragging, keyboard carousel control, the pinned
desktop and compact journeys, independent education-line drawing, Contact's
active tracker, case-study entry/return, and Back to home. Local dependency
references, page anchors, and JavaScript syntax were checked. Obsolete Work
scripts and their unused frame/3D/control styles were removed.

This is not a claim of testing every browser or physical device. Chrome was
not accessible to automation. Its supplied screenshot appears zoomed out;
reset page zoom with Command+0 and compare at 100% before changing CSS.

### Still intentionally incomplete

- Résumé PDF buttons remain disabled until a PDF is supplied.
- LinkedIn is unlinked until its destination is supplied.
- All three case studies are disconnected and marked “coming soon”; their source files remain local and are excluded from publication.
- GitHub Pages must use the GitHub Actions deployment source in repository settings.

Instagram and OTVerse website links are configured; they open in a new tab
with `noopener noreferrer`.
