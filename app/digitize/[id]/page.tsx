'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function DigitizePage() {
  const params = useParams();
  const id = params.id as string;
  const [entry, setEntry] = useState<any>(null);
  const [googleImages, setGoogleImages] = useState<any[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextStart, setNextStart] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [statusCounts, setStatusCounts] = useState<{ [key: string]: number }>({
    PENDING: 0,
    SKIPPED: 0,
    FAILED: 0,
    ARCHIVED: 0,
    ALL: 0,
  });
  const router = useRouter();

  useEffect(() => {
    fetchNextEntry();
    fetchAllStatusCounts();
  }, []);

  const fetchAllStatusCounts = async () => {
    try {
      const statuses = ['PENDING', 'SKIPPED', 'FAILED', 'ARCHIVED', 'ALL'];
      const counts: { [key: string]: number } = {};
      
      await Promise.all(
        statuses.map(async (status) => {
          const res = await fetch(`/api/projects/${id}/remaining?status=${status}`);
          const data = await res.json();
          counts[status] = data.count || 0;
        })
      );
      
      setStatusCounts(counts);
    } catch (error) {
      console.error('Failed to fetch status counts');
    }
  };

  const fetchNextEntry = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}/next-entry?status=${statusFilter}`, { method: 'POST' });
      const data = await res.json();

      if (!data.entry) {
        alert(data.message || `No more ${statusFilter.toLowerCase()} entries to process!`);
        router.push('/projects');
        return;
      }

      setEntry(data.entry);
      setSelectedUrls([]);
      setGoogleImages([]);
      setHasMore(false);
      fetchGoogleImages(data.entry.medicineName);
      fetchAllStatusCounts(); // Update all counts after getting entry
    } catch (error) {
      alert('Failed to fetch entry');
    } finally {
      setLoading(false);
    }
  };

  const fetchGoogleImages = async (query: string) => {
    const res = await fetch(`/api/google-images?q=${encodeURIComponent(query)}&start=0`);
    const data = await res.json();
    console.log('Google images fetched:', data.images?.length || 0);
    setGoogleImages(data.images || []);
    setHasMore(data.hasMore || false);
    setNextStart(data.nextStart || 0);
  };

  const loadMoreImages = async () => {
    if (!entry || loadingMore) return;
    
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/google-images?q=${encodeURIComponent(entry.medicineName)}&start=${nextStart}`);
      const data = await res.json();
      console.log('More images fetched:', data.images?.length || 0);
      setGoogleImages((prev) => [...prev, ...(data.images || [])]);
      setHasMore(data.hasMore || false);
      setNextStart(data.nextStart || 0);
    } catch (error) {
      console.error('Failed to load more images');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleComplete = async () => {
    if (selectedUrls.length === 0) {
      alert('Select at least one image');
      return;
    }

    await fetch(`/api/entries/${entry.id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedImages: selectedUrls }),
    });

    fetchNextEntry();
  };

  const handleSkip = async () => {
    await fetch(`/api/entries/${entry.id}/skip`, { method: 'POST' });
    fetchNextEntry();
  };

  const handleArchive = async () => {
    await fetch(`/api/entries/${entry.id}/archive`, { method: 'POST' });
    fetchNextEntry();
  };

  if (loading || !entry) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="digitize-page">
      <header className="digitize-header">
        <button onClick={() => router.push('/projects')}>← Back to Projects</button>
        <h2>{entry.medicineName}</h2>
        
        {/* Status Filter with Remaining Count */}
        <div className="status-filter">
          <label>Show:</label>
          <select 
            value={statusFilter} 
            onChange={(e) => {
              setStatusFilter(e.target.value);
              // Fetch new entry with selected filter
              setTimeout(() => fetchNextEntry(), 100);
            }}
          >
            <option value="PENDING">Pending ({statusCounts.PENDING} remaining)</option>
            <option value="SKIPPED">Skipped ({statusCounts.SKIPPED} remaining)</option>
            <option value="FAILED">Failed ({statusCounts.FAILED} remaining)</option>
            <option value="ARCHIVED">Archived ({statusCounts.ARCHIVED} remaining)</option>
            <option value="ALL">All ({statusCounts.ALL} remaining)</option>
          </select>
        </div>
      </header>

      <div className="digitize-content">
        <div className="left-panel-large">
          <h3>Original Image</h3>
          <img src={entry.originalImageUrl} alt={entry.medicineName} className="original-large" />
        </div>

        <div className="right-panel-images">
          <h3>Select Images ({selectedUrls.length} selected)</h3>
          <div className="google-images-grid">
            {googleImages.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: '#666' }}>
                No images found. Try skipping to the next entry.
              </div>
            ) : (
              <>
                {googleImages.map((img) => (
                  <div
                    key={img.url}
                    className={`google-image-item ${selectedUrls.includes(img.url) ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedUrls((prev) =>
                        prev.includes(img.url)
                          ? prev.filter((u) => u !== img.url)
                          : [...prev, img.url]
                      );
                    }}
                  >
                    <div className="image-wrapper">
                      <img src={img.thumbnail} alt="" loading="lazy" />
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedUrls.includes(img.url)}
                      onChange={(e) => {
                        e.stopPropagation();
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                ))}
                {hasMore && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '1rem' }}>
                    <button 
                      onClick={loadMoreImages} 
                      disabled={loadingMore}
                      style={{ 
                        padding: '0.75rem 2rem',
                        background: '#667eea',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: loadingMore ? 'not-allowed' : 'pointer',
                        opacity: loadingMore ? 0.6 : 1,
                      }}
                    >
                      {loadingMore ? 'Loading...' : 'Load More Images'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="digitize-actions">
        <button onClick={handleSkip} className="btn-skip">
          Skip
        </button>
        <button onClick={handleArchive} className="btn-archive">
          Archive
        </button>
        <button onClick={handleComplete} className="btn-next">
          Next
        </button>
      </div>
    </div>
  );
}
