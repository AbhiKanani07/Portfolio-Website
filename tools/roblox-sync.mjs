import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(
  await readFile(path.join(root, 'tools/roblox.config.json'), 'utf8')
    .catch(() => '{}')
);
const username = (process.env.ROBLOX_USER || cfg.username || '').trim();

if (!username) {
  console.log('No Roblox username set (ROBLOX_USER or tools/roblox.config.json). Skipping.');
  process.exit(0);
}

async function get(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status} from ${url}`);
  return res.json();
}

const user = (await get('https://users.roblox.com/v1/usernames/users', {
  method: 'POST',
  body: JSON.stringify({ usernames: [username], excludeBannedUsers: true }),
})).data?.[0];

if (!user) throw new Error(`No Roblox user named "${username}"`);

const favorites = (
  await get(`https://games.roblox.com/v2/users/${user.id}/favorite/games?limit=50&sortOrder=Desc`)
).data || [];

const apiKey = process.env.ROBLOX_API_KEY;
if (!apiKey) {
  throw new Error('Set ROBLOX_API_KEY to a Roblox Open Cloud API key before running npm run roblox.');
}

const inventory = [];
let pageToken = '';

do {
  const url = new URL(
    `https://apis.roblox.com/cloud/v2/users/${user.id}/inventory-items`
  );
  url.searchParams.set('filter', 'badges=true');
  url.searchParams.set('maxPageSize', '100');
  if (pageToken) url.searchParams.set('pageToken', pageToken);

  const page = await get(url, { headers: { 'x-api-key': apiKey } });
  const items = page.inventoryItems || [];
  inventory.push(...items);
  pageToken = page.nextPageToken || '';
  if (!items.length) break;
} while (pageToken);

// Look up which game awarded each of the 100 newest badges.
const latest = inventory
  .filter((item) => item.badgeDetails?.badgeId)
  .sort((a, b) =>
    String(b.addTime || '').localeCompare(String(a.addTime || ''))
  )
  .slice(0, 100);

const recent = new Map();

for (let i = 0; i < latest.length; i += 5) {
  const batch = latest.slice(i, i + 5);
  const badges = await Promise.all(
    batch.map((item) =>
      get(`https://badges.roblox.com/v1/badges/${item.badgeDetails.badgeId}`)
    )
  );

  badges.forEach((badge, index) => {
    const universeId = badge.awardingUniverse?.id;
    if (!universeId) return;

    const when = batch[index].addTime || null;
    const cur = recent.get(universeId) || { last: null, count: 0 };
    cur.count += 1;
    if (when && (!cur.last || when > cur.last)) cur.last = when;
    recent.set(universeId, cur);
  });
}

const recentIds = [...recent.entries()]
  .sort((a, b) =>
    String(b[1].last).localeCompare(String(a[1].last))
  )
  .slice(0, 24)
  .map(([universeId]) => universeId);

const pinned = [];

for (const placeId of cfg.pinnedPlaceIds || []) {
  try {
    pinned.push(
      (await get(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`))
        .universeId
    );
  } catch (e) {
    console.warn(`Skipped pinned place ${placeId}: ${e.message}`);
  }
}

const universeIds = [
  ...new Set([...recentIds, ...favorites.map((g) => g.id), ...pinned]),
].filter(Boolean);

const details = [];
const icons = new Map();

for (let i = 0; i < universeIds.length; i += 50) {
  const batch = universeIds.slice(i, i + 50).join(',');

  details.push(
    ...((await get(`https://games.roblox.com/v1/games?universeIds=${batch}`)).data || [])
  );

  const thumbnails = (
    await get(
      `https://thumbnails.roblox.com/v1/games/icons?universeIds=${batch}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`
    )
  ).data || [];

  for (const thumbnail of thumbnails) {
    icons.set(thumbnail.targetId, thumbnail.imageUrl);
  }
}

const favIds = new Set(favorites.map((g) => g.id));

const games = details.map((d) => ({
  universeId: d.id,
  placeId: d.rootPlaceId,
  name: d.name,
  creator: d.creator?.name || '',
  genre: d.genre && d.genre !== 'All' ? d.genre : '',
  visits: d.visits || 0,
  playing: d.playing || 0,
  updated: d.updated,
  icon: icons.get(d.id) || null,
  url: `https://www.roblox.com/games/${d.rootPlaceId}`,
  recent: recent.has(d.id),
  lastPlayed: recent.get(d.id)?.last || null,
  badges: recent.get(d.id)?.count || 0,
  favorite: favIds.has(d.id),
  pick: pinned.includes(d.id),
}));

await writeFile(
  path.join(root, 'docs/roblox.json'),
  `${JSON.stringify({
    updated: new Date().toISOString(),
    user: {
      id: user.id,
      name: user.name,
      displayName: user.displayName,
    },
    games,
  }, null, 2)}\n`
);

console.log(
  `Synced ${games.length} games for @${user.name}: ` +
  `${games.filter((g) => g.recent).length} recently played, ` +
  `${games.filter((g) => g.favorite).length} favorites.`
);