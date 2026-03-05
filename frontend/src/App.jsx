import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Feed from './pages/Feed';
import Stats from './pages/Stats';
import { useBadge } from './hooks/useBadge';

export default function App() {
  const { unread } = useBadge();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Glass Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 backdrop-blur-md bg-gray-950/80">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔔</span>
            <span className="font-semibold text-white text-lg tracking-tight">NotificationCenter</span>
            {unread > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white">
                {unread}
              </span>
            )}
          </div>
          <nav className="flex gap-1">
            <Link
              to="/"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === '/'
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Feed
            </Link>
            <Link
              to="/stats"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === '/stats'
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Stats
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Feed />} />
          <Route path="/stats" element={<Stats />} />
        </Routes>
      </main>
    </div>
  );
}
