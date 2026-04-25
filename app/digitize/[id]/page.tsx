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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoadingImages, setIsLoadingImages] = useState<boolean>(false);
  const router = useRouter();

  useEffect(() => {
    initializePage();
  }, []);

  useEffect(() => {
    // Autofill search query with medicine name and "buy in India"
    if (entry) {
      setSearchQuery(`${entry.medicineName} buy in India`);
    }
  }, [entry]);

  const initializePage = async () => {
    // First fetch all counts
    await fetchAllStatusCounts();
    
    // Then fetch entry with current filter
    fetchNextEntry();
  };

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
        // No alert popup - just show the no-entry UI
        setEntry(null);
        setLoading(false);
        return;
      }

      setEntry(data.entry);
      setSelectedUrls([]);
      setGoogleImages([]);
      setHasMore(false);
      const searchQuery = `${data.entry.medicineName} buy in India`;
      fetchGoogleImages(searchQuery);
      fetchAllStatusCounts(); // Update all counts after getting entry
      
      // Prefetch images for next entries in background while user is working
      setTimeout(() => {
        fetch(`/api/projects/${id}/prefetch-next?status=${statusFilter}`, { method: 'POST' })
          .catch(() => {}); // Ignore errors
      }, 2000); // Wait 2 seconds to let current images load first
    } catch (error) {
      console.error('Failed to fetch entry:', error);
      setEntry(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchGoogleImages = async (query: string) => {
    setIsLoadingImages(true);
    const res = await fetch(`/api/google-images?q=${encodeURIComponent(query)}&start=0`);
    const data = await res.json();
    console.log('Google images fetched:', data.images?.length || 0);
    setGoogleImages(data.images || []);
    setHasMore(data.hasMore || false);
    setNextStart(data.nextStart || 0);
    setIsLoadingImages(false);
  };

  const handleManualSearch = async () => {
    if (!searchQuery.trim()) {
      alert('Please enter a search query');
      return;
    }
    setGoogleImages([]);
    await fetchGoogleImages(searchQuery);
  };

  const loadMoreImages = async () => {
    if (!entry || loadingMore) return;
    
    setLoadingMore(true);
    try {
      const queryToUse = searchQuery.trim() || entry.medicineName;
      const res = await fetch(`/api/google-images?q=${encodeURIComponent(queryToUse)}&start=${nextStart}`);
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

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!entry) {
    return (
      <div className="digitize-page">
        <header className="digitize-header">
          <button onClick={() => router.push('/projects')}>← Back to Projects</button>
          <h2>No Entries Available</h2>
          
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
        <div style={{ textAlign: 'center', padding: '4rem', fontSize: '1.2rem', color: '#666' }}>
          <p>No {statusFilter.toLowerCase()} entries available.</p>
          <p>Try selecting a different filter above.</p>
        </div>
      </div>
    );
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
          <div
            className={`google-image-item ${selectedUrls.includes(entry.originalImageUrl) ? 'selected' : ''}`}
            onClick={() => {
              setSelectedUrls((prev) =>
                prev.includes(entry.originalImageUrl)
                  ? prev.filter((u) => u !== entry.originalImageUrl)
                  : [...prev, entry.originalImageUrl]
              );
            }}
            style={{ cursor: 'pointer', position: 'relative' }}
          >
            <img src={entry.originalImageUrl} alt={entry.medicineName} className="original-large" />
            <input
              type="checkbox"
              checked={selectedUrls.includes(entry.originalImageUrl)}
              onChange={(e) => {
                e.stopPropagation();
              }}
              onClick={(e) => e.stopPropagation()}
              style={{ position: 'absolute', top: '10px', right: '10px', width: '20px', height: '20px', cursor: 'pointer' }}
            />
          </div>
        </div>

        <div className="right-panel-images">
          <h3>Select Images ({selectedUrls.length} selected)</h3>
          
          {/* Manual Search Box */}
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="Search for different images..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleManualSearch();
                }
              }}
              style={{
                flex: 1,
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '0.9rem',
              }}
            />
            <button
              onClick={handleManualSearch}
              style={{
                padding: '0.5rem 1.5rem',
                background: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              Search
            </button>
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setGoogleImages([]);
                  fetchGoogleImages(entry.medicineName);
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                Reset
              </button>
            )}
          </div>
          
          <div className="google-images-grid">
            {isLoadingImages ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: '#666' }}>
                <div style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>🔍 Searching for images...</div>
                <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>This may take a few seconds</div>
              </div>
            ) : googleImages.length === 0 ? (
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
