function profileUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError('A valid profile link is required.');
  }
  const handles = url.searchParams.getAll('handle');
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password ||
    url.pathname !== '/pages/public-profile.html' || handles.length !== 1 ||
    !/^[a-f0-9]{32}$/i.test(handles[0]) || [...url.searchParams.keys()].length !== 1 || url.hash) {
    throw new TypeError('A stable public profile link is required.');
  }
  return url.href;
}

function createQr(url) {
  if (typeof globalThis.qrcode !== 'function') {
    throw new Error('The local QR code generator is unavailable.');
  }
  const qr = globalThis.qrcode(0, 'M');
  qr.addData(profileUrl(url));
  qr.make();
  return qr;
}

function qrSvg(url) {
  return createQr(url).createSvgTag({
    cellSize: 4,
    margin: 4,
    scalable: true,
    alt: 'QR code links to this learner profile',
    title: 'Scan to open this learner profile'
  });
}

export function renderProfileQr({ target, url } = {}) {
  if (!target || typeof target !== 'object' || !('innerHTML' in target)) {
    throw new TypeError('A QR code target element is required.');
  }
  target.innerHTML = qrSvg(url);
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
  })[character]);
}

function filenameFor(nickname) {
  const slug = nickname.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
  return `profile-${slug || 'learner'}.svg`;
}

function cardLabel(value, limit) {
  const text = value.trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

export function downloadProfileCard({ profile, url } = {}) {
  if (!profile || typeof profile.nickname !== 'string') {
    throw new TypeError('A learner profile is required for the share card.');
  }
  const stableUrl = profileUrl(url);
  const nickname = cardLabel(profile.nickname.trim() || 'Fisher learner', 32);
  const title = typeof profile.title === 'string' ? cardLabel(profile.title, 40) : '';
  const badges = Array.isArray(profile.sections?.badges?.pinned)
    ? profile.sections.badges.pinned.slice(0, 3).filter((badge) => typeof badge?.title === 'string')
    : [];
  const qr = qrSvg(stableUrl).replace('<svg ', '<svg x="500" y="58" width="160" height="160" ');
  const badgeMarkup = badges.map(({ title: badgeTitle }, index) => {
    const y = 190 + index * 36;
    return `<rect x="40" y="${y - 23}" width="390" height="30" rx="15" fill="#eef2f6"/><text x="56" y="${y - 3}" fill="#17344d" font-size="16" font-family="Arial,sans-serif">${escapeXml(cardLabel(badgeTitle, 36))}</text>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="330" viewBox="0 0 720 330" role="img" aria-labelledby="card-title card-description">
  <title id="card-title">${escapeXml(nickname)}'s learner profile</title>
  <desc id="card-description">A share card with a QR code linking to this learner profile.</desc>
  <rect width="720" height="330" rx="24" fill="#fbf8f0"/>
  <rect x="24" y="24" width="672" height="282" rx="20" fill="none" stroke="#d8dfdf" stroke-width="2"/>
  <text x="40" y="58" fill="#35516a" font-size="14" font-weight="700" letter-spacing="1.5" font-family="Arial,sans-serif">DISCRETEFISHER HUB</text>
  <text x="40" y="108" fill="#17344d" font-size="30" font-weight="700" font-family="Arial,sans-serif">${escapeXml(nickname)}</text>
  ${title ? `<text x="40" y="140" fill="#536878" font-size="18" font-family="Arial,sans-serif">${escapeXml(title)}</text>` : ''}
  ${badgeMarkup}
  <rect x="486" y="44" width="188" height="188" rx="16" fill="#ffffff" stroke="#d8dfdf" stroke-width="2"/>
  ${qr}
  <text x="40" y="292" fill="#536878" font-size="12" font-family="Arial,sans-serif">${escapeXml(stableUrl)}</text>
</svg>`;
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filenameFor(nickname);
  try {
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }
}
