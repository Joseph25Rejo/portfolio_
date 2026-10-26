// Cloudflare Worker for the portfolio.
// Static files are served from the assets binding. Only /api/* runs this code.
// The GitHub token lives in the Worker secret GITHUB_TOKEN and never reaches the browser.

const MEDIUM_USER = '@joseph25rejo';
const GITHUB_USER = 'Joseph25Rejo';

const json = (body, status, maxAge) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': status === 200 ? 'public, max-age=' + maxAge : 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'");

const pick = (xml, tag) => {
  const m = xml.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>'));
  if (!m) return '';
  return m[1].replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, '').trim();
};

async function medium() {
  const res = await fetch('https://medium.com/feed/' + MEDIUM_USER, { headers: { 'user-agent': 'portfolio-worker' }, cf: { cacheTtl: 3600 } });
  if (!res.ok) return json({ error: 'upstream' }, 502);
  const xml = await res.text();
  const posts = xml.split('<item>').slice(1, 5).map((item) => {
    const html = pick(item, 'content:encoded');
    const img = (html.match(/<img[^>]+src="([^"]+)"/) || [])[1] || '';
    const text = decode(html.replace(/<figure[\s\S]*?<\/figure>/g, '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
    const link = decode(pick(item, 'link')).split('?')[0];
    return {
      title: decode(pick(item, 'title')),
      link: link.startsWith('https://') ? link : '',
      thumbnail: img.startsWith('https://') ? decode(img) : '',
      description: text.length > 150 ? text.slice(0, 150).replace(/\s+\S*$/, '') + '…' : text,
      date: pick(item, 'pubDate')
    };
  }).filter((p) => p.title && p.link);
  return json({ posts }, 200, 3600);
}

async function github(env) {
  if (!env.GITHUB_TOKEN) return json({ error: 'not-configured' }, 503);
  const headers = {
    authorization: 'bearer ' + env.GITHUB_TOKEN,
    'user-agent': 'portfolio-worker',
    accept: 'application/vnd.github+json'
  };
  const query = 'query($u:String!){user(login:$u){avatarUrl contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{contributionCount date}}}}}}';
  const [gql, ev] = await Promise.all([
    fetch('https://api.github.com/graphql', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ query, variables: { u: GITHUB_USER } }) }),
    fetch('https://api.github.com/users/' + GITHUB_USER + '/events/public?per_page=50', { headers })
  ]);
  if (!gql.ok) return json({ error: 'upstream' }, 502);
  const g = await gql.json();
  const user = g && g.data && g.data.user;
  if (!user) return json({ error: 'upstream' }, 502);
  const cal = user.contributionsCollection.contributionCalendar;
  const days = cal.weeks.flatMap((w) => w.contributionDays.map((d) => [d.date, d.contributionCount]));

  // GitHub no longer lists commits inside push events, so look up each push's head commit.
  let commits = [];
  if (ev.ok) {
    const pushes = (await ev.json()).filter((e) => e.type === 'PushEvent' && e.payload && e.payload.head).slice(0, 8);
    const found = await Promise.all(pushes.map(async (e) => {
      const r = await fetch('https://api.github.com/repos/' + e.repo.name + '/commits/' + e.payload.head, { headers });
      if (!r.ok) return null;
      const c = await r.json();
      const msg = String(c.commit && c.commit.message || '').split('\n')[0];
      return { message: msg.length > 64 ? msg.slice(0, 64) + '…' : msg, date: e.created_at, url: c.html_url };
    }));
    const seen = new Set();
    commits = found.filter((c) => c && c.url && !seen.has(c.url) && seen.add(c.url)).slice(0, 4);
  }
  return json({ total: cal.totalContributions, days, commits, avatar: user.avatarUrl }, 200, 600);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/medium') return medium().catch(() => json({ error: 'failed' }, 502));
    if (url.pathname === '/api/github') return github(env).catch(() => json({ error: 'failed' }, 502));
    if (url.pathname.startsWith('/api/')) return json({ error: 'not-found' }, 404);
    return env.ASSETS.fetch(request);
  }
};
