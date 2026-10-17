# HC particle logo — website package

The Nautigal Bold 700, built from **61,114 individual 3D particles**, with gentle liquid motion and contact-driven internal light. H uses **#BE380B** and C uses **#191919** as their exact sRGB base material colors. Lighting adds highlights and shadows; disturbed particles temporarily glow. The canvas is transparent and contains only the logo.

## Add it to your website

Upload this folder and import the component directly into your page:

```html
<div id="hc-logo"></div>
<main class="page-content">
  <!-- Your glass panels, text, links, and buttons go here. -->
</main>
<style>
  .page-content { position: relative; z-index: 1; }
</style>
<script type="module">
  import { mountHCLogo } from '/HC-Website/hc-logo.js?v=slow1';
  const logo = await mountHCLogo(document.getElementById('hc-logo'));
  // When removing the component in an SPA: logo.dispose();
</script>
```

The component creates a fixed, full-viewport canvas directly under `document.body`, at z-index 0. The mount element's dimensions and overflow do not limit the particles. Keep the page's glass and text layers above it with z-index 1 or higher. Your page background remains visible through the canvas. The standalone `index.html` is a preview page; its body styles are not required for integration.

Pointer movement is captured from the document, including movement over glass panels and text. The canvas ignores pointer targeting, so overlaid buttons, links, scrolling, and text selection remain available. Glass blur or opaque layers naturally change how clearly you can see the sculpture behind them.

Use direct integration for the whole browser window. An iframe confines rendering and pointer events to its own document, so it cannot provide the same full-page behavior across parent-page overlays.

No build step, API key, CDN, or package installation is needed. Three.js and its license are bundled locally. Keep all files together and serve them over HTTP(S), rather than opening them with `file://`. The bundled viewer requires a browser with WebGL 2 enabled.

For local preview from this folder:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Motion and interaction

- The logo rotates 360° around its fixed vertical Y axis every 30 seconds, continuously. The pointer never controls rotation or zoom.
- At rest, small, coherent currents keep the particles flowing continuously while preserving the HC silhouette. This idle motion is separate from the scattering physics.
- **Movement causes scattering; stationary hover and clicks do not.** A rotating letter passing under a still cursor also causes no disturbance.
- A stroke first carries nearby particles along the mouse's direction, creating a short entry trail. After roughly 65–100 milliseconds, they break outward into a varied scatter while retaining forward momentum. Swept picking detects quick strokes across individual particles.
- Slow movement creates a gentle wake; fast movement makes a stronger, faster entry and wider burst. The trail follows changes in direction while contact continues, and particles release on schedule even during a continuous stroke.
- Each new stroke varies release direction, strength, and drag. The disturbance stays local to the path that crosses the logo.
- Moving across a letter also softly lights its interior: amber on H and warm white on C. Light ripples through nearby particles, with subtle halos visible through the gaps. Scattered particles briefly carry the light, which fades after contact ends. Both the inner emission and halo intensity use the same `glowStrength` setting.
- After input stops, particles keep their existing momentum, then spring back into the gently flowing logo. A still cursor creates neither new scattering nor new light.
- Particles can travel across the whole visible viewport. Their outer surfaces can touch its actual edges, with **zero added padding**. Collision sizes follow each bead's projected width as the logo rotates, and boundaries update as the browser is resized.
- Pointer movement also supports touch and pen; native page scrolling remains enabled.
- Rendering pauses while the browser tab is hidden.

## Detail and model contents

Each particle has **162 vertices and 320 triangles**, with smooth normals. The renderer uses antialiasing and supersampling: 2× on standard-density screens and up to 3× on higher-density screens, subject to a 12-million-pixel drawing-buffer cap.

`assets/HC-Particles-Animated.glb` contains all particles, two materials, and the **Horizontal_Rotation_Loop** animation clip. It is approximately **2.46 MB** and uses `EXT_mesh_gpu_instancing`. The viewer renders the beads in two draw calls, with up to two additional lightweight halo draws during illumination.

The GLB stores geometry, colors, and the rotation clip. **Movement-sensitive physics, liquid idle motion, internal lighting, viewport boundaries, and automatic looping are implemented by `hc-logo.js` and `particle-life.js`.** Include the complete website package to retain these effects. Uploading only the GLB to another viewer will not recreate them. That viewer must support GPU instancing and enable animation playback/repeat.

Font license: `FONT-LICENSE.txt`. Three.js license: `vendor/THREE-LICENSE.txt`.

## Optional developer settings

The defaults are ready to use:

```js
const logo = await mountHCLogo(container, {
  rotationSeconds: 30,
  interactionRadius: 1.05,
  repulsionStrength: 165,
  wakeDuration: 0.075,
  springStrength: 15,
  damping: 5.1,
  boundaryRestitution: 0.5,
  liquidAmplitude: 0.085,
  liquidSpeed: 1,
  glowStrength: 0.18,
  glowDecay: 2.4,
  pointerTarget: document,
  zIndex: 0
});
```

Increase `repulsionStrength` for a stronger response or `interactionRadius` for a wider local area. `wakeDuration` sets the brief direction-following phase in seconds, with small per-particle variations; the default is 0.075 seconds. `pixelRatio` can be supplied to adjust rendering cost; the drawing-buffer cap still applies. Keep `pointerTarget: document` to receive movement through page overlays.

`liquidAmplitude` controls the small idle currents and `liquidSpeed` controls their pace. `glowStrength` adjusts light intensity; a higher `glowDecay` makes the contact glow fade faster. Setting `liquidAmplitude` or `glowStrength` to 0 disables that visual effect independently. The default currents preserve the fitted HC silhouette.

`logo.getState()` exposes read-only diagnostics: movement mode, following/released particle counts, alignment with the mouse direction, viewport, particle count, colors, scattering displacement, separate liquid displacement, glow strength, collisions on each edge, nearest edge gaps in CSS pixels, animation time, rendering resolution, and transparency. Call `logo.dispose()` to remove the canvas, event listeners, and GPU resources.
