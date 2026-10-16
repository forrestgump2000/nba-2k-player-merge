// Renders the app icon set and the Open Graph thumbnail into public/.
import sharp from 'sharp';
import fs from 'node:fs';

const ball = (cx, cy, r) => `
  <defs>
    <clipPath id="L"><polygon points="${cx - r - 2},${cy - r - 2} ${cx + r * 0.28},${cy - r - 2} ${cx - r * 0.28},${cy + r + 2} ${cx - r - 2},${cy + r + 2}"/></clipPath>
    <clipPath id="R"><polygon points="${cx + r * 0.28},${cy - r - 2} ${cx + r + 2},${cy - r - 2} ${cx + r + 2},${cy + r + 2} ${cx - r * 0.28},${cy + r + 2}"/></clipPath>
    <radialGradient id="gL" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#6cc0ff"/><stop offset="1" stop-color="#1060c8"/></radialGradient>
    <radialGradient id="gR" cx="65%" cy="30%" r="80%"><stop offset="0" stop-color="#ff7a8f"/><stop offset="1" stop-color="#c8102e"/></radialGradient>
  </defs>
  <g clip-path="url(#L)" transform="translate(-${r * 0.06},0)"><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#gL)"/>${lines(cx, cy, r)}</g>
  <g clip-path="url(#R)" transform="translate(${r * 0.06},0)"><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#gR)"/>${lines(cx, cy, r)}</g>
  <line x1="${cx + r * 0.3}" y1="${cy - r * 1.12}" x2="${cx - r * 0.3}" y2="${cy + r * 1.12}" stroke="#ffb800" stroke-width="${r * 0.07}" stroke-linecap="round"/>
  <line x1="${cx + r * 0.3}" y1="${cy - r * 1.12}" x2="${cx - r * 0.3}" y2="${cy + r * 1.12}" stroke="#fff6d6" stroke-width="${r * 0.025}" stroke-linecap="round"/>`;
const lines = (cx, cy, r) => {
  const w = r * 0.045;
  return `<g fill="none" stroke="#0b0c10" stroke-width="${w}" opacity=".85">
    <line x1="${cx - r}" y1="${cy}" x2="${cx + r}" y2="${cy}"/>
    <line x1="${cx}" y1="${cy - r}" x2="${cx}" y2="${cy + r}"/>
    <path d="M ${cx - r * 0.62} ${cy - r * 0.78} Q ${cx - r * 0.18} ${cy} ${cx - r * 0.62} ${cy + r * 0.78}"/>
    <path d="M ${cx + r * 0.62} ${cy - r * 0.78} Q ${cx + r * 0.18} ${cy} ${cx + r * 0.62} ${cy + r * 0.78}"/>
  </g>`;
};

const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b1d26"/><stop offset="1" stop-color="#07080b"/></linearGradient></defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <rect x="10" y="10" width="492" height="492" rx="104" fill="none" stroke="#ffb800" stroke-opacity=".25" stroke-width="4"/>
  ${ball(256, 236, 150)}
  <text x="256" y="462" text-anchor="middle" font-family="Impact, 'Arial Black', sans-serif" font-size="74" fill="#ffffff" letter-spacing="4">2K MERGE</text>
</svg>`;
fs.writeFileSync('public/favicon.svg', icon);
const png = (size, out) => sharp(Buffer.from(icon)).resize(size, size).png().toFile(out);
await png(512, 'public/icon-512.png');
await png(192, 'public/icon-192.png');
await png(180, 'public/apple-touch-icon.png');
await png(1024, 'assets/icon-1024.png');

// Open Graph thumbnail: two real headshots fused with the icon in the middle.
const W = 1200, H = 630;
const face = async (id) => sharp(`public/headshots/${id}.webp`).resize(560, 410).png().toBuffer();
const half = (side) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="560" height="410"><polygon points="${side === 'L' ? '0,0 560,0 470,410 0,410' : '90,0 560,0 560,410 0,410'}" fill="#fff"/></svg>`);
const masked = async (id, side) => sharp(await face(id)).composite([{ input: half(side), blend: 'dest-in' }]).png().toBuffer();
const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="g" cx="50%" cy="0%" r="90%"><stop offset="0" stop-color="#2a1426"/><stop offset="1" stop-color="#0b0c10"/></radialGradient>
    <linearGradient id="fadeL" x1="0" x2="1"><stop offset="0" stop-color="#2f9bff" stop-opacity=".35"/><stop offset="1" stop-color="#2f9bff" stop-opacity="0"/></linearGradient>
    <linearGradient id="fadeR" x1="1" x2="0"><stop offset="0" stop-color="#ff4d6d" stop-opacity=".35"/><stop offset="1" stop-color="#ff4d6d" stop-opacity="0"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <rect x="0" y="0" width="420" height="${H}" fill="url(#fadeL)"/>
  <rect x="${W - 420}" y="0" width="420" height="${H}" fill="url(#fadeR)"/>
</svg>`;
const fg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect x="0" y="${H - 190}" width="${W}" height="190" fill="#0b0c10" fill-opacity=".88"/>
  <rect x="0" y="${H - 192}" width="${W}" height="4" fill="#ffb800"/>
  <text x="${W / 2}" y="${H - 108}" text-anchor="middle" font-family="Impact, 'Arial Black', sans-serif" font-size="78" fill="#fff" letter-spacing="3">NBA 2K <tspan fill="#ff3b30">PLAYER MERGE</tspan></text>
  <text x="${W / 2}" y="${H - 52}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="30" fill="#c9ced8" letter-spacing="2">FUSE ANY TWO 2K27 PLAYERS · EVERY RATING · FULL CAREER SIM</text>
</svg>`;
const mini = await sharp(Buffer.from(icon)).resize(190, 190).png().toBuffer();
await sharp(Buffer.from(bg))
  .composite([
    { input: await masked('nikola-jokic', 'L'), left: 40, top: 20 },
    { input: await masked('shai-gilgeous-alexander', 'R'), left: W - 600, top: 20 },
    { input: mini, left: W / 2 - 95, top: 120 },
    { input: Buffer.from(fg), left: 0, top: 0 },
  ])
  .png()
  .toFile('public/og-image.png');

fs.writeFileSync('public/manifest.webmanifest', JSON.stringify({
  name: 'NBA 2K Player Merge', short_name: '2K Merge', start_url: '/', display: 'standalone', background_color: '#0b0c10', theme_color: '#0b0c10',
  icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }],
}, null, 2));
console.log('icons done');
