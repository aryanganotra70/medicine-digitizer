'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LocksPage() {
  const [locks, setLocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchLocks();
  }, []);

  const fetchLocks = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/locks');
      if (!res.ok) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      setLocks(data.locks || []);
    } catch (error) {
      console.error('Failed to fetch locks');
    } finally {
      setLoading(false);
    }
  };

  const clearAllLocks = async () => {
    if (!confirm('Clear all Redis locks? This will allow all locked entries to be reassigned.')) {
      return;
    }

    try {
      const res = await fetch('/api/admin/clear-locks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      alert(data.message);
      fetchLocks();
    } catch (error) {
      alert('Failed to clear locks');
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="locks-page" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header className="page-header">
        <button onClick={() => router.push('/projects')}>← Back</button>
        <h1>Redis Locks ({locks.length})</h1>
        <button onClick={clearAllLocks} style={{ background: '#dc3545' }}>
          Clear All Locks
        </button>
      </header>

      {locks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
          No active locks
        </div>
      ) : (
        <table style={{ width: '100%', background: 'white', borderRadius: '8px', overflow: 'hidden' }}>
          <thead style={{ background: '#667eea', color: 'white' }}>
            <tr>
              <th style={{ padding: '1rem', textAlign: 'left' }}>Entry ID</th>
              <th style={{ padding: '1rem', textAlign: 'left' }}>User ID</th>
              <th style={{ padding: '1rem', textAlign: 'left' }}>TTL</th>
              <th style={{ padding: '1rem', textAlign: 'left' }}>Expires In</th>
            </tr>
          </thead>
          <tbody>
            {locks.map((lock) => (
              <tr key={lock.entryId} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '1rem' }}>{lock.entryId}</td>
                <td style={{ padding: '1rem' }}>{lock.userId}</td>
                <td style={{ padding: '1rem' }}>{lock.ttl}s</td>
                <td style={{ padding: '1rem' }}>{lock.expiresIn}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: '2rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
        <h3>About Redis Locks</h3>
        <p style={{ marginTop: '0.5rem', color: '#666' }}>
          Redis locks prevent multiple users from working on the same entry simultaneously.
          Each lock has a 10-minute TTL and is automatically released when the user completes or skips the entry.
          If a user closes their browser, the lock will expire after 10 minutes.
        </p>
      </div>
    </div>
  );
}
