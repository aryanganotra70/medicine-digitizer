'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useInView } from 'react-intersection-observer';

export default function AdminProjectView() {
  const params = useParams();
  const id = params.id as string;
  const [entries, setEntries] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { ref, inView } = useInView();

  useEffect(() => {
    fetchEntries(true);
  }, [search, statusFilter]);

  useEffect(() => {
    if (inView && hasMore && !loading) {
      fetchEntries(false);
    }
  }, [inView]);

  const fetchEntries = async (reset: boolean) => {
    setLoading(true);
    try {
      const cursor = reset ? '' : nextCursor || '';
      const res = await fetch(
        `/api/projects/${id}/entries?cursor=${cursor}&search=${search}&status=${statusFilter}`
      );
      const data = await res.json();

      setEntries((prev) => (reset ? data.entries : [...prev, ...data.entries]));
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (error) {
      console.error('Failed to fetch entries');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await fetch(`/api/projects/${id}/export`);
      
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to export data');
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project_export_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Failed to export data');
    }
  };

  return (
    <div className="admin-view">
      <header className="admin-header">
        <button onClick={() => router.push('/projects')}>← Back</button>
        <h1>Admin View</h1>
        <button onClick={handleExport} style={{ background: '#28a745' }}>
          Export to CSV
        </button>
      </header>

      <div className="admin-filters">
        <input
          type="text"
          placeholder="Search medicine name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="ALL">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="SKIPPED">Skipped</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>

      <div className="admin-table">
        <table>
          <thead>
            <tr>
              <th>Medicine Name</th>
              <th>Status</th>
              <th>Retries</th>
              <th>Original URL</th>
              <th>Processed Images</th>
              <th>Digitized By</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.medicineName}</td>
                <td>
                  <span className={`status-badge ${entry.status.toLowerCase()}`}>
                    {entry.status}
                  </span>
                </td>
                <td>{entry.retryCount}/3</td>
                <td>
                  <a href={entry.originalImageUrl} target="_blank" rel="noopener noreferrer">
                    View
                  </a>
                </td>
                <td>
                  {entry.processedImages?.length > 0 ? (
                    <div className="image-links">
                      {entry.processedImages.map((url: string, i: number) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                          Image {i + 1}
                        </a>
                      ))}
                    </div>
                  ) : (
                    '-'
                  )}
                </td>
                <td>{entry.user?.username || '-'}</td>
                <td>
                  {entry.retryCount < 3 ? (
                    <button onClick={() => router.push(`/redigitize/${entry.id}`)}>
                      Redigitize
                    </button>
                  ) : (
                    <span style={{ color: '#dc3545', fontSize: '0.9rem' }}>Max retries reached</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {hasMore && <div ref={ref} className="loading-trigger">Loading more...</div>}
      </div>
    </div>
  );
}
