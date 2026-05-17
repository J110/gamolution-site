#!/usr/bin/env python3
"""Generate og-image.svg with brand mark + agent emergence (dots and motion trails)."""
import random, math, pathlib

random.seed(42)  # deterministic — same output every run

W, H = 1200, 630
CX, CY = 600, 220        # mark center
MARK_R = 84              # mark outer ring radius

SAGE, AMBER, SLATE = "#3d5a4a", "#c08552", "#5d7a8a"
SAGE_SOFT, AMBER_SOFT, SLATE_SOFT = "#7a9388", "#d4a987", "#92a4b2"
COLORS = [SAGE, AMBER, SLATE, SAGE_SOFT, AMBER_SOFT, SLATE_SOFT]

# Text exclusion zones (don't put dots/trails on top of typography)
TEXT_ZONES = [
    (360, 430, 350, 850),   # wordmark
    (440, 510, 280, 920),   # tagline
    (505, 535, 350, 850),   # subtitle
]
def in_text_zone(x, y):
    return any(y0 < y < y1 and x0 < x < x1 for y0, y1, x0, x1 in TEXT_ZONES)

dots, trails = [], []

# Dense halo around mark (just outside the ring)
for _ in range(70):
    a = random.uniform(0, 2 * math.pi)
    dist = random.uniform(MARK_R + 4, 180)
    x, y = CX + math.cos(a) * dist, CY + math.sin(a) * dist
    if in_text_zone(x, y): continue
    dots.append((x, y, random.uniform(1.6, 3.0), random.choice(COLORS), random.uniform(0.4, 0.85)))

# Mid ring (further out)
for _ in range(60):
    a = random.uniform(0, 2 * math.pi)
    dist = random.uniform(180, 320)
    x, y = CX + math.cos(a) * dist, CY + math.sin(a) * dist
    if y < 70 or y > 560 or x < 70 or x > 1130: continue
    if in_text_zone(x, y): continue
    dots.append((x, y, random.uniform(1.2, 2.4), random.choice(COLORS), random.uniform(0.25, 0.55)))

# Scattered far agents (whole canvas, very sparse)
for _ in range(50):
    x, y = random.uniform(70, 1130), random.uniform(70, 560)
    if in_text_zone(x, y): continue
    dx, dy = x - CX, y - CY
    if math.hypot(dx, dy) < 320: continue  # already covered by halo/mid
    dots.append((x, y, random.uniform(1.0, 2.0), random.choice(COLORS), random.uniform(0.15, 0.4)))

# Motion trails — curved paths flowing from outer ring toward the mark
for _ in range(14):
    a = random.uniform(0, 2 * math.pi)
    sd = random.uniform(240, 330)
    ed = random.uniform(MARK_R + 12, 150)
    sx, sy = CX + math.cos(a) * sd, CY + math.sin(a) * sd
    ex, ey = CX + math.cos(a) * ed, CY + math.sin(a) * ed
    mx = (sx + ex) / 2 + random.uniform(-28, 28)
    my = (sy + ey) / 2 + random.uniform(-28, 28)
    if in_text_zone(sx, sy) or in_text_zone(ex, ey): continue
    trails.append((sx, sy, mx, my, ex, ey, random.choice(COLORS), random.uniform(0.18, 0.4)))

svg_dots = '\n'.join(
    f'  <circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{c}" opacity="{op:.2f}"/>'
    for x, y, r, c, op in dots
)
svg_trails = '\n'.join(
    f'  <path d="M{sx:.1f} {sy:.1f} Q{mx:.1f} {my:.1f} {ex:.1f} {ey:.1f}" stroke="{c}" stroke-width="1" fill="none" opacity="{op:.2f}" stroke-linecap="round"/>'
    for sx, sy, mx, my, ex, ey, c, op in trails
)

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
  <rect width="{W}" height="{H}" fill="#faf9f6"/>

  <!-- Emergence layer (background) -->
{svg_trails}
{svg_dots}

  <!-- Brand mark (foreground, sharp) -->
  <g transform="translate({CX} {CY})">
    <circle cx="0" cy="0" r="{MARK_R}" fill="none" stroke="#1a1f1a" stroke-width="3"/>
    <circle cx="-30" cy="-20" r="20" fill="#3d5a4a"/>
    <circle cx="30" cy="-20" r="14" fill="#c08552"/>
    <circle cx="0" cy="30" r="17" fill="#5d7a8a"/>
  </g>

  <!-- Typography -->
  <text x="600" y="400" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="84" fill="#1a1f1a">Gamolution</text>
  <text x="600" y="470" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="46" fill="#3d5a4a">Turn games into reality.</text>
  <text x="600" y="525" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="20" fill="#88897e" letter-spacing="3">A POSSIBILITY ENGINE FOR HUMAN SYSTEMS</text>

  <!-- Subtle frame -->
  <rect x="60" y="60" width="1080" height="510" fill="none" stroke="#1a1f1a" stroke-width="1" opacity="0.15"/>
</svg>
'''

pathlib.Path('og-image.svg').write_text(svg)
print(f"Generated og-image.svg — {len(dots)} dots, {len(trails)} trails")
