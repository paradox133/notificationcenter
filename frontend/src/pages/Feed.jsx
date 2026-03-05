import React, { useState, useEffect, useCallback } from 'react';

const API = '/api';

const PRIORITY_COLORS = {
  critical: 'border-red-500',
  warning: 'border-amber-500',
  info: 'border-blue-500',
};

const PRIORITY_BADGE = {
  critical: 'bg-red-500/20 text-red-400 border border-red-500/30',
  warning: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  info: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
};

const CATEGORY_ICONS = {
  system: '⚙️',
  deploy: '🚀',
  qa: '🐛',
  health: '❤️',
  finance: '💰',
  general: '📌',
};

const AGENT_AVATARS = {
  rex: '📋', quinn: '🐛', wells: '❤️', gordon: '💰',
  dick: '🎯', sentry: '🛡️', oracle: '🔮', nana: '👴',
  pixel: '🎨', neo: '💻', crane: '🏗️', sage: '📊',
};

function timeAgo(dateStr) {
  const now = new Date();
  const then = new Date(dateStr);
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const TABS = ['all', 'unread', 'critical', 'warnings'];

export default function Feed() {
  const [notifications, setNotifications] = useState([]);
  const [tab, setTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [snoozeId, setSnoozeId] = useState(null);

  const fetchNotifications = useCallback(() => {
    let url = `${API}/notifications?limit=100`;
    if (tab === 'unread') url += '&status=unread';
    if (tab === 'critical') url += '&priority=critical';
    if (tab === 'warnings') url += '&priority=warning';

    fetch(url)
      .then(r => r.json())
      .then(data => { setNotifications(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [tab]);

  useEffect(() => {
    setLoading(true);
    fetchNotifications();
  }, [fetchNotifications]);

  const updateStatus = async (id, status, snoozedUntil = '') => {
    await fetch(`${API}/notifications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, snoozedUntil }),
    });
    fetchNotifications();
  };

  const bulkRead = async () => {
    const ids = selected.size > 0
      ? [...selected]
      : notifications.filter(n => n.status === 'unread').map(n => n.id);

    if (ids.length === 0) return;
    await fetch(`${API}/notifications/bulk-read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    setSelected(new Set());
    fetchNotifications();
  };

  const toggleSelect = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleSnooze = async (id, hours) => {
    const until = new Date(Date.now() + hours * 3600000).toISOString().replace('T', ' ').substring(0, 19);
    await updateStatus(id, 'snoozed', until);
    setSnoozeId(null);
  };

  const unreadCount = notifications.filter(n => n.status === 'unread').length;

  return (
    <div>
      {/* Filter Tabs + Actions */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-1 bg-gray-900 p-1 rounded-lg">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
                tab === t
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t === 'warnings' ? 'Warnings' : t.charAt(0).toUpperCase() + t.slice(1)}
              {t === 'unread' && unreadCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {selected.size > 0 && (
            <span className="text-sm text-gray-400 self-center">{selected.size} selected</span>
          )}
          <button
            onClick={bulkRead}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-medium transition-colors"
          >
            {selected.size > 0 ? `Mark ${selected.size} Read` : 'Mark All Read'}
          </button>
        </div>
      </div>

      {/* Notification List */}
      {loading ? (
        <div className="text-center py-16 text-gray-500">Loading...</div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <div className="text-4xl mb-3">✅</div>
          <div>No notifications</div>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map(n => (
            <div
              key={n.id}
              className={`relative bg-gray-900/60 border border-white/5 rounded-xl pl-4 pr-4 py-4 border-l-4 ${PRIORITY_COLORS[n.priority] || 'border-blue-500'} ${
                n.status === 'read' || n.status === 'acknowledged' ? 'opacity-60' : ''
              } transition-opacity`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={selected.has(n.id)}
                  onChange={() => toggleSelect(n.id)}
                  className="mt-1 accent-blue-500 cursor-pointer"
                />

                {/* Avatar */}
                <div className="text-2xl flex-shrink-0 w-8 text-center">
                  {AGENT_AVATARS[n.agent] || '🤖'}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white text-sm">{n.title}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PRIORITY_BADGE[n.priority]}`}>
                      {n.priority}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-white/5">
                      {CATEGORY_ICONS[n.category] || '📌'} {n.category}
                    </span>
                    {n.status === 'acknowledged' && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">✓ ack</span>
                    )}
                    {n.status === 'snoozed' && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">💤 snoozed</span>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm mt-1">{n.message}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
                    <span>@{n.agent}</span>
                    {n.source && <span>via {n.source}</span>}
                    <span>{timeAgo(n.createdAt)}</span>
                    {n.actionUrl && (
                      <a href={n.actionUrl} target="_blank" rel="noopener noreferrer"
                        className="text-blue-400 hover:underline">→ Open</a>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-1.5 flex-shrink-0">
                  {n.status === 'unread' && (
                    <button
                      onClick={() => updateStatus(n.id, 'read')}
                      className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-md transition-colors"
                    >
                      Read
                    </button>
                  )}
                  {n.status !== 'acknowledged' && (
                    <button
                      onClick={() => updateStatus(n.id, 'acknowledged')}
                      className="px-2 py-1 text-xs bg-green-900/50 hover:bg-green-900 text-green-400 rounded-md transition-colors"
                    >
                      Ack
                    </button>
                  )}
                  {n.status !== 'snoozed' && (
                    <div className="relative">
                      <button
                        onClick={() => setSnoozeId(snoozeId === n.id ? null : n.id)}
                        className="px-2 py-1 text-xs bg-purple-900/50 hover:bg-purple-900 text-purple-400 rounded-md transition-colors"
                      >
                        💤
                      </button>
                      {snoozeId === n.id && (
                        <div className="absolute right-0 top-8 z-10 bg-gray-800 border border-white/10 rounded-lg shadow-xl p-2 min-w-[130px]">
                          {[1, 4, 24].map(h => (
                            <button
                              key={h}
                              onClick={() => handleSnooze(n.id, h)}
                              className="block w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 rounded"
                            >
                              {h === 1 ? '1 hour' : h === 4 ? '4 hours' : '24 hours'}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
