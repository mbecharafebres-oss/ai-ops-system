#!/usr/bin/env node
// Minimal MCP stdio server that fills two gaps in common Slack MCP servers:
// - canvas_list + canvas_read: Slack Canvas read access (huddle notes live there).
// - threads_updated_since: threads whose replies are newer than a given time, even when the
//   thread started long before. conversations_history only returns root messages with their
//   original date, so late replies in old threads are easy to miss.
// Requires SLACK_MCP_XOXP_TOKEN with canvases:read + files:read, and channels/groups/im/mpim
// :history + :read scopes for threads_updated_since.

const https = require('https');

const TOKEN = process.env.SLACK_MCP_XOXP_TOKEN;
if (!TOKEN) {
  process.stderr.write('SLACK_MCP_XOXP_TOKEN is not set\n');
  process.exit(1);
}

// The token is only ever sent to Slack hosts over HTTPS.
function isSlackHost(u) {
  try {
    const { protocol, hostname } = new URL(u);
    return protocol === 'https:' && (hostname === 'slack.com' || hostname.endsWith('.slack.com'));
  } catch (e) {
    return false;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function slackApiOnce(path, params) {
  const qs = new URLSearchParams(params).toString();
  const url = `https://slack.com/api/${path}${qs ? '?' + qs : ''}`;
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { Authorization: `Bearer ${TOKEN}` } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          const body = JSON.parse(data);
          body._retryAfter = Number(res.headers['retry-after'] || 0);
          resolve(body);
        } catch (e) {
          reject(new Error(`Failed to parse Slack API response: ${data.slice(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

async function slackApi(path, params = {}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const resp = await slackApiOnce(path, params);
    if (resp.error !== 'ratelimited') return resp;
    await sleep(((resp._retryAfter || 2) + 1) * 1000);
  }
  return { ok: false, error: 'ratelimited' };
}

// Accepts a Slack ts ("1791966304.890589"), epoch seconds, or an ISO date ("2026-10-14T10:30:00+02:00").
function toTs(value) {
  if (value === undefined || value === null || value === '') return null;
  if (/^\d+(\.\d+)?$/.test(String(value))) return Number(value);
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) throw new Error(`Cannot parse time: ${value}`);
  return ms / 1000;
}

const iso = (ts) => new Date(Number(ts) * 1000).toISOString();

async function paginate(path, params, key) {
  const out = [];
  let cursor;
  do {
    const resp = await slackApi(path, cursor ? { ...params, cursor } : params);
    if (!resp.ok) throw new Error(`${path}: ${resp.error}`);
    out.push(...(resp[key] || []));
    cursor = resp.response_metadata && resp.response_metadata.next_cursor;
  } while (cursor);
  return out;
}

let userNames = null;
async function userName(id) {
  if (!id) return null;
  if (!userNames) {
    userNames = {};
    try {
      const members = await paginate('users.list', { limit: '200' }, 'members');
      for (const m of members) userNames[m.id] = m.real_name || m.name;
    } catch (e) {
      // users:read missing: fall back to IDs
    }
  }
  if (!(id in userNames)) {
    // Slack Connect users (e.g. the customer's team in ext- channels) are not in users.list
    const info = await slackApi('users.info', { user: id });
    userNames[id] = info.ok ? info.user.real_name || info.user.name : id;
  }
  return userNames[id];
}

async function threadsUpdatedSince(args) {
  const since = toTs(args.since);
  if (since === null) throw new Error('since is required');
  const lookbackDays = args.lookback_days || 30;
  const oldest = String(Date.now() / 1000 - lookbackDays * 86400);
  const exclude = new Set(args.exclude_channel_ids || []);
  const maxText = args.max_text_chars || 1500;
  const mention = args.mention_user_id;

  let channels;
  if (args.channel_ids && args.channel_ids.length) {
    channels = args.channel_ids.map((id) => ({ id }));
  } else {
    channels = await paginate(
      'users.conversations',
      { types: 'public_channel,private_channel,mpim,im', exclude_archived: 'true', limit: '200' },
      'channels'
    );
  }

  const threads = [];
  const errors = [];
  let scanned = 0;
  for (const ch of channels) {
    if (exclude.has(ch.id)) continue;
    scanned++;
    let history;
    try {
      history = await paginate('conversations.history', { channel: ch.id, oldest, limit: '200' }, 'messages');
    } catch (e) {
      errors.push({ channel_id: ch.id, error: e.message });
      continue;
    }
    const updated = history.filter(
      (m) => m.thread_ts === m.ts && m.reply_count > 0 && Number(m.latest_reply || 0) > since
    );
    for (const root of updated) {
      let replies;
      try {
        replies = await paginate(
          'conversations.replies',
          { channel: ch.id, ts: root.ts, oldest: String(since), limit: '200' },
          'messages'
        );
      } catch (e) {
        errors.push({ channel_id: ch.id, thread_ts: root.ts, error: e.message });
        continue;
      }
      const fresh = replies.filter((r) => r.ts !== root.ts && Number(r.ts) > since);
      if (!fresh.length) continue;
      const newReplies = [];
      for (const r of fresh) {
        newReplies.push({
          ts: r.ts,
          time: iso(r.ts),
          user: r.user || r.bot_id,
          name: r.user ? await userName(r.user) : r.username || (r.bot_profile && r.bot_profile.name) || null,
          text: (r.text || '').slice(0, maxText),
          mentions_user: mention ? (r.text || '').includes(`<@${mention}>`) : undefined,
        });
      }
      threads.push({
        channel_id: ch.id,
        channel_name: ch.name || (ch.is_im ? `dm:${await userName(ch.user)}` : null),
        thread_ts: root.ts,
        root_time: iso(root.ts),
        root_user: root.user ? await userName(root.user) : root.username || null,
        root_text: (root.text || '').slice(0, 300),
        latest_reply: iso(root.latest_reply),
        reply_count: root.reply_count,
        new_replies: newReplies,
      });
    }
  }
  threads.sort((a, b) => (a.latest_reply < b.latest_reply ? 1 : -1));
  return {
    since: iso(since),
    lookback_days: lookbackDays,
    channels_scanned: scanned,
    threads_with_new_replies: threads.length,
    threads,
    errors,
  };
}

function downloadUrl(url) {
  return new Promise((resolve, reject) => {
    const doGet = (u, redirects = 0) => {
      if (!isSlackHost(u)) return reject(new Error('Refusing to send the Slack token to a non-Slack host'));
      https.get(u, { headers: { Authorization: `Bearer ${TOKEN}` } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 5) {
          return doGet(new URL(res.headers.location, u).toString(), redirects + 1);
        }
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve(data));
      }).on('error', reject);
    };
    doGet(url);
  });
}

function htmlToText(html) {
  return html
    .replace(/<h1[^>]*>/g, '\n# ')
    .replace(/<h2[^>]*>/g, '\n## ')
    .replace(/<h3[^>]*>/g, '\n### ')
    .replace(/<\/h[1-3]>/g, '\n')
    .replace(/<li[^>]*>/g, '\n- ')
    .replace(/<\/p>/g, '\n')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const TOOLS = [
  {
    name: 'canvas_list',
    description:
      'List Slack canvases visible to this token (standalone canvases, channel canvases, and huddle-notes canvases). Optionally filter to a single channel.',
    inputSchema: {
      type: 'object',
      properties: {
        channel_id: { type: 'string', description: 'Restrict to canvases shared in this channel ID (e.g. C06KAQ9PTSS). Omit to list across the workspace.' },
        limit: { type: 'number', description: 'Max results (default 20, max 100).' },
      },
    },
  },
  {
    name: 'canvas_read',
    description:
      'Read the full text content of a Slack canvas by its file ID (from canvas_list). Returns title, metadata, and the canvas body as plain text.',
    inputSchema: {
      type: 'object',
      properties: {
        file_id: { type: 'string', description: 'Canvas file ID, e.g. F0B71M06WVD' },
      },
      required: ['file_id'],
    },
  },
  {
    name: 'threads_updated_since',
    description:
      'Find threads with replies newer than `since`, including threads whose root message is old (which conversations_history alone misses). Scans every channel, group DM and DM the token is a member of (or only channel_ids), looking back lookback_days for thread roots, and returns each thread with only its new replies.',
    inputSchema: {
      type: 'object',
      properties: {
        since: { type: 'string', description: 'Only replies after this time. ISO date (e.g. 2026-10-14T10:30:00+02:00), epoch seconds or Slack ts.' },
        lookback_days: { type: 'number', description: 'How far back to look for thread roots (default 30).' },
        channel_ids: { type: 'array', items: { type: 'string' }, description: 'Only these channels. Omit to scan all conversations the token is a member of.' },
        exclude_channel_ids: { type: 'array', items: { type: 'string' }, description: 'Channels to skip (e.g. alert/notification channels).' },
        mention_user_id: { type: 'string', description: 'Flag replies that mention this user ID (e.g. U0123456789).' },
        max_text_chars: { type: 'number', description: 'Truncate each reply to this many characters (default 1500).' },
      },
      required: ['since'],
    },
  },
];

async function callTool(name, args) {
  if (name === 'canvas_list') {
    const params = { types: 'canvas', count: String(Math.min(args.limit || 20, 100)) };
    if (args.channel_id) params.channel = args.channel_id;
    const resp = await slackApi('files.list', params);
    if (!resp.ok) return { error: resp.error };
    return {
      files: (resp.files || []).map((f) => ({
        id: f.id,
        title: f.title,
        is_huddle_canvas: !!f.is_huddle_canvas,
        channels: f.channels || [],
        updated: f.updated ? new Date(f.updated * 1000).toISOString() : null,
        creator: f.canvas_creator_id || f.user,
        permalink: f.permalink,
      })),
    };
  }
  if (name === 'canvas_read') {
    const info = await slackApi('files.info', { file: args.file_id });
    if (!info.ok) return { error: info.error };
    const f = info.file;
    const html = await downloadUrl(f.url_private_download);
    return {
      title: f.title,
      updated: f.updated ? new Date(f.updated * 1000).toISOString() : null,
      creator: f.canvas_creator_id || f.user,
      channels: f.channels || [],
      permalink: f.permalink,
      content: htmlToText(html),
    };
  }
  if (name === 'threads_updated_since') return threadsUpdatedSince(args);
  throw new Error(`Unknown tool: ${name}`);
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (line) handleMessage(line);
  }
});

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

async function handleMessage(line) {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch (e) {
    return;
  }
  const { id, method, params } = msg;
  try {
    if (method === 'initialize') {
      send({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'slack-thread-watcher', version: '0.2.1' },
        },
      });
    } else if (method === 'tools/list') {
      send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    } else if (method === 'tools/call') {
      const result = await callTool(params.name, params.arguments || {});
      send({
        jsonrpc: '2.0',
        id,
        result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] },
      });
    } else if (method === 'notifications/initialized') {
      // no response needed
    } else if (id !== undefined) {
      send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
    }
  } catch (e) {
    if (id !== undefined) {
      send({ jsonrpc: '2.0', id, error: { code: -32000, message: e.message } });
    }
  }
}

process.stderr.write('slack-thread-watcher MCP server running on stdio\n');
