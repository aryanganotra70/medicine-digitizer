'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function RedigitizePage() {
  const params = useParams();
  const entryId = params.id as string;
  const [entry, setEntry] = useState<any>(null);
  const [googleImages, setGoogleImages] = useState<any[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextStart, setNextStart] = useState(0);
  const router = useRouter();

  useEffect(() => {
    fetchEntry();
  }, []);

  const fetchEntry = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/entries/${entryId}`);
      const data = await res.json();

      if (!res.ok || !data.entry) {
        alert(data.error || 'Failed to fetch entry');
        router.push('/projects');
        return;
      }

      setEntry(data.entry);
      fetchGoogleImages(data.entry.medicineName);
    } catch (error) {
      alert('Failed to fetch entry');
      router.push('/projects');
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

    if (entry.retryCount >= 3) {
      alert('Maximum retry attempts (3) reached for this entry');
      return;
    }

    setLoading(true);
    try {
      // Increment retry count
      await fetch(`/api/entries/${entry.id}/increment-retry`, {
        method: 'POST',
      });

      // Process images
      await fetch(`/api/entries/${entry.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedImages: selectedUrls }),
      });

      alert('Entry redigitized successfully! Processing in background.');
      router.push(`/admin/projects/${entry.projectId}`);
    } catch (error) {
      alert('Failed to complete entry');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (confirm('Cancel redigitization? Entry will remain in its current state.')) {
      router.push(`/admin/projects/${entry?.projectId}`);
    }
  };

  if (loading || !entry) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="digitize-page">
      <header className="digitize-header">
        <button onClick={handleCancel}>← Cancel</button>
        <h2>{entry.medicineName} (Redigitize)</h2>
        <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>
          Retry {entry.retryCount}/3
        </span>
      </header>

      <div className="digitize-content">
        <div className="left-panel-large">
          <h3>Original Image</h3>
          <img src={entry.originalImageUrl} alt={entry.medicineName} className="original-large" />
          
          {entry.processedImages && entry.processedImages.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h4>Previously Processed:</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginTop: '0.5rem' }}>
                {entry.processedImages.map((url: string, i: number) => (
                  <img key={i} src={url} alt="" style={{ width: '100%', borderRadius: '4px', border: '1px solid #ddd' }} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="right-panel-images">
          <h3>Select Images ({selectedUrls.length} selected)</h3>
          <div className="google-images-grid">
            {googleImages.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: '#666' }}>
                No images found.
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
        <button onClick={handleCancel} className="btn-skip">
          Cancel
        </button>
        <button onClick={handleComplete} className="btn-next" disabled={loading}>
          {loading ? 'Processing...' : 'Complete Redigitization'}
        </button>
      </div>
    </div>
  );
}
