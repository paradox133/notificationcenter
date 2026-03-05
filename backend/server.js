const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3080;

// Ensure data directory exists
const dataDir = '/app/data';
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'notifications.db'));

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT DEFAULT '',
    priority TEXT DEFAULT 'info',
    category TEXT DEFAULT 'general',
    status TEXT DEFAULT 'unread',
    source TEXT DEFAULT '',
    actionUrl TEXT DEFAULT '',
    snoozedUntil TEXT DEFAULT '',
    metadata TEXT DEFAULT '{}',
    createdAt TEXT DEFAULT (datetime('now','localtime')),
    readAt TEXT DEFAULT '',
    acknowledgedAt TEXT DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_notif_status ON notifications(status);
  CREATE INDEX IF NOT EXISTS idx_notif_agent ON notifications(agent);
  CREATE INDEX IF NOT EXISTS idx_notif_priority ON notifications(priority);
  CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications(createdAt);

  CREATE TABLE IF NOT EXISTS dedup_cache (
    hash TEXT PRIMARY KEY,
    notificationId INTEGER,
    createdAt TEXT DEFAULT (datetime('now','localtime'))
  );
`);

app.use(cors());
app.use(express.json());

// Rate limit store (in-memory)
const rateLimitStore = {}; // { agent: [timestamps] }

function checkRateLimit(agent) {
  const now = Date.now();
  if (!rateLimitStore[agent]) rateLimitStore[agent] = [];
  // Keep only timestamps within the last 60 seconds
  rateLimitStore[agent] = rateLimitStore[agent].filter(t => now - t < 60000);
  if (rateLimitStore[agent].length >= 10) return false;
  rateLimitStore[agent].push(now);
  return true;
}

// POST /api/notify — create notification
app.post('/api/notify', (req, res) => {
  const { agent, title, message = '', priority = 'info', category = 'general', source = '', actionUrl = '', metadata = '{}' } = req.body;

  if (!agent || !title) {
    return res.status(400).json({ error: 'agent and title are required' });
  }

  // Rate limit
  if (!checkRateLimit(agent)) {
    return res.status(429).json({ error: 'Rate limit exceeded: max 10 per agent per minute' });
  }

  // Dedup: same agent+title within 5 min
  const hash = crypto.createHash('md5').update(`${agent}:${title}`).digest('hex');
  const existing = db.prepare(`
    SELECT d.notificationId FROM dedup_cache d
    WHERE d.hash = ? AND datetime(d.createdAt) > datetime('now', 'localtime', '-5 minutes')
  `).get(hash);

  if (existing) {
    return res.status(200).json({ deduplicated: true, id: existing.notificationId });
  }

  // Insert notification
  const metaStr = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);
  const insert = db.prepare(`
    INSERT INTO notifications (agent, title, message, priority, category, source, actionUrl, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = insert.run(agent, title, message, priority, category, source, actionUrl, metaStr);
  const id = result.lastInsertRowid;

  // Cache dedup
  db.prepare(`INSERT OR REPLACE INTO dedup_cache (hash, notificationId) VALUES (?, ?)`).run(hash, id);

  res.status(201).json({ id, created: true });
});

// GET /api/notifications
app.get('/api/notifications', (req, res) => {
  const { status, priority, agent, category, limit = 50 } = req.query;

  let query = 'SELECT * FROM notifications WHERE 1=1';
  const params = [];

  if (status) { query += ' AND status = ?'; params.push(status); }
  if (priority) { query += ' AND priority = ?'; params.push(priority); }
  if (agent) { query += ' AND agent = ?'; params.push(agent); }
  if (category) { query += ' AND category = ?'; params.push(category); }

  query += ' ORDER BY createdAt DESC LIMIT ?';
  params.push(parseInt(limit));

  const rows = db.prepare(query).all(...params);
  res.json(rows);
});

// GET /api/notifications/unread/count
app.get('/api/notifications/unread/count', (req, res) => {
  const row = db.prepare(`SELECT COUNT(*) as count FROM notifications WHERE status = 'unread'`).get();
  res.json({ count: row.count });
});

// GET /api/notifications/stats
app.get('/api/notifications/stats', (req, res) => {
  const byStatus = db.prepare(`SELECT status, COUNT(*) as count FROM notifications GROUP BY status`).all();
  const byPriority = db.prepare(`SELECT priority, COUNT(*) as count FROM notifications GROUP BY priority`).all();
  const byAgent = db.prepare(`SELECT agent, COUNT(*) as count FROM notifications GROUP BY agent ORDER BY count DESC`).all();
  const timeline = db.prepare(`
    SELECT strftime('%Y-%m-%d %H:00', createdAt) as hour, COUNT(*) as count
    FROM notifications
    WHERE createdAt >= datetime('now', 'localtime', '-24 hours')
    GROUP BY hour
    ORDER BY hour ASC
  `).all();

  res.json({ byStatus, byPriority, byAgent, timeline });
});

// PATCH /api/notifications/:id
app.patch('/api/notifications/:id', (req, res) => {
  const { id } = req.params;
  const { status, snoozedUntil } = req.body;

  const notif = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
  if (!notif) return res.status(404).json({ error: 'Not found' });

  let readAt = notif.readAt;
  let acknowledgedAt = notif.acknowledgedAt;
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  if (status === 'read' && !readAt) readAt = now;
  if (status === 'acknowledged' && !acknowledgedAt) acknowledgedAt = now;

  db.prepare(`
    UPDATE notifications SET status = ?, snoozedUntil = ?, readAt = ?, acknowledgedAt = ? WHERE id = ?
  `).run(status || notif.status, snoozedUntil || notif.snoozedUntil, readAt, acknowledgedAt, id);

  const updated = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
  res.json(updated);
});

// POST /api/notifications/bulk-read
app.post('/api/notifications/bulk-read', (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array required' });
  }

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`
    UPDATE notifications SET status = 'read', readAt = ? WHERE id IN (${placeholders}) AND status = 'unread'
  `).run(now, ...ids);

  res.json({ updated: ids.length });
});

// GET /api/health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`NotificationCenter backend running on port ${PORT}`);
});
