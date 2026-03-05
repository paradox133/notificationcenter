import React, { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts';

const API = '/api';

const STATUS_COLORS = {
  unread: '#ef4444',
  read: '#3b82f6',
  acknowledged: '#22c55e',
  snoozed: '#a855f7',
};

const AGENT_AVATARS = {
  rex: '📋', quinn: '🐛', wells: '❤️', gordon: '💰',
  dick: '🎯', sentry: '🛡️', oracle: '🔮', nana: '👴',
  pixel: '🎨', neo: '💻', crane: '🏗️', sage: '📊',
};

function StatCard({ title, value, sub, icon }) {
  return (
    <div className="bg-gray-900/60 border border-white/5 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-400 text-sm">{title}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

export default function Stats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/notifications/stats`)
      .then(r => r.json())
      .then(data => { setStats(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-16 text-gray-500">Loading stats...</div>;
  if (!stats) return <div className="text-center py-16 text-gray-500">Failed to load stats</div>;

  const totalNotifications = stats.byStatus.reduce((s, r) => s + r.count, 0);
  const unread = stats.byStatus.find(r => r.status === 'unread')?.count || 0;
  const critical = stats.byPriority.find(r => r.priority === 'critical')?.count || 0;
  const topAgent = stats.byAgent[0];

  const donutData = stats.byStatus.map(r => ({
    name: r.status,
    value: r.count,
  }));

  const barData = stats.byAgent.slice(0, 10).map(r => ({
    name: (AGENT_AVATARS[r.agent] || '🤖') + ' ' + r.agent,
    count: r.count,
  }));

  const timelineData = stats.timeline.map(r => ({
    hour: r.hour ? r.hour.substring(11, 16) : '',
    count: r.count,
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Total" value={totalNotifications} icon="🔔" sub="all time" />
        <StatCard title="Unread" value={unread} icon="📬" sub={`${totalNotifications ? Math.round(unread / totalNotifications * 100) : 0}% unread`} />
        <StatCard title="Critical" value={critical} icon="🚨" sub="needs attention" />
        <StatCard title="Top Agent" value={topAgent ? topAgent.agent : '—'} icon={AGENT_AVATARS[topAgent?.agent] || '🤖'} sub={topAgent ? `${topAgent.count} notifications` : ''} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Donut: by status */}
        <div className="bg-gray-900/60 border border-white/5 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">By Status</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={donutData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
              >
                {donutData.map((entry, idx) => (
                  <Cell key={idx} fill={STATUS_COLORS[entry.name] || '#6b7280'} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
              />
              <Legend
                formatter={(value) => <span style={{ color: '#9ca3af', fontSize: 12 }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Bar: by agent */}
        <div className="bg-gray-900/60 border border-white/5 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">By Agent</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} width={90} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Timeline: last 24h */}
      <div className="bg-gray-900/60 border border-white/5 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-4">Timeline — Last 24h</h3>
        {timelineData.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No data in the last 24 hours</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="hour" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
              />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
