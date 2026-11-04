// Geometry shared by the site components (FloodlightTower, PitchShowcase) and by the share
// image script (scripts/og.mjs), so the drawings never drift apart.
// Plain data only: this file is also loaded by Node without a bundler.

/** Floodlight tower, viewBox 0 0 120 90 (docs/design/site.md and docs/art/og-image.md). */
export const tower = {
  width: 120,
  height: 90,
  plate: { x: 8, y: 8, width: 104, height: 52, rx: 6 },
  lampRadius: 7,
  lampXs: [26, 49, 72, 95],
  lampYs: [24, 44],
  post: { x: 56, y: 60, width: 8, height: 30 },
};

/** Perspective pitch of the home hero, viewBox 0 0 1000 260. */
export const showcasePitch = {
  viewBox: '0 0 1000 260',
  trapezoid: 'M140 0H860L1000 260H0Z',
  stripes: [
    'M140 0H212L100 260H0Z',
    'M284 0H356L300 260H200Z',
    'M428 0H500L500 260H400Z',
    'M572 0H644L700 260H600Z',
    'M716 0H788L900 260H800Z',
  ],
  endLine: 'M120 40H880',
  halfway: 'M500 40V260',
  circle: { cx: 500, cy: 150, rx: 150, ry: 62 },
  spotRadius: 5,
};
