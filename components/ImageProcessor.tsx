'use client';

import { useState, useEffect } from 'react';
import { MedicineRow } from '@/lib/types';
import ImageGrid from './ImageGrid';

interface Props {
  medicines: MedicineRow[];
}

export default function ImageProcessor({ medicines }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [googleImages, setGoogleImages] = useState<any[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<Record<string, string[]>>({});

  const currentMedicine = medicines[currentIndex];

  useEffect(() => {
    if (currentMedicine) {
      fetchGoogleImages(currentMedicine.name);
    }
  }, [currentIndex]);

  const fetchGoogleImages = async (query: string) => {
    try {
      console.log('Fetching images for:', query);
      const res = await fetch(`/api/google-images?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      console.log('Received data:', data);
      console.log('Images count:', data.images?.length || 0);
      setGoogleImages(data.images || []);
    } catch (error) {
      console.error('Failed to fetch images', error);
    }
  };

  const toggleImage = (url: string) => {
    setSelectedUrls((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]
    );
  };

  const processAndNext = async () => {
    if (selectedUrls.length === 0) {
      alert('Select at least one image');
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch('/api/process-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrls: selectedUrls,
          medicineName: currentMedicine.name,
        }),
      });
      const data = await res.json();
      
      const successUrls = data.results
        .filter((r: any) => r.success)
        .map((r: any) => r.r2Url);

      const updatedResults = {
        ...results,
        [currentMedicine.name]: successUrls,
      };
      
      setResults(updatedResults);
      setSelectedUrls([]);
      
      if (currentIndex < medicines.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        // Last medicine - export CSV
        await exportCSV(updatedResults);
        alert('Processing complete! CSV downloaded.');
      }
    } catch (error) {
      alert('Processing failed');
    } finally {
      setProcessing(false);
    }
  };

  const exportCSV = async (resultsToExport = results) => {
    const csvData = Object.entries(resultsToExport).map(([name, urls]) => {
      const row: any = { medicine_name: name };
      urls.forEach((url, index) => {
        row[`image_url_${index + 1}`] = url;
      });
      return row;
    });

    const res = await fetch('/api/export-csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: csvData }),
    });

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'processed_medicines.csv';
    a.click();
  };

  const skipMedicine = () => {
    if (currentIndex < medicines.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Last medicine - export what we have
      if (Object.keys(results).length > 0) {
        exportCSV();
        alert('Processing complete! CSV downloaded.');
      } else {
        alert('No medicines were processed.');
      }
    }
  };

  if (!currentMedicine) return <div>No medicines to process</div>;

  return (
    <div className="processor-container">
      <div className="header">
        <h2>{currentMedicine.name}</h2>
        <p>
          {currentIndex + 1} / {medicines.length}
        </p>
      </div>

      <div className="content">
        <div className="left-panel">
          <h3>Original Images</h3>
          <div className="original-images">
            {currentMedicine.imageUrls.map((url, i) => (
              <img key={i} src={url} alt="" loading="lazy" />
            ))}
          </div>
        </div>

        <div className="right-panel">
          <h3>Select New Images ({selectedUrls.length} selected)</h3>
          <ImageGrid
            images={googleImages}
            selectedUrls={selectedUrls}
            onToggle={toggleImage}
          />
        </div>
      </div>

      <div className="actions">
        <button onClick={processAndNext} disabled={processing}>
          {processing ? 'Processing...' : currentIndex === medicines.length - 1 ? 'Process & Export' : 'Process & Next'}
        </button>
        <button onClick={skipMedicine} disabled={processing}>
          {currentIndex === medicines.length - 1 ? 'Skip & Export' : 'Skip'}
        </button>
        {Object.keys(results).length > 0 && (
          <button onClick={() => exportCSV()} disabled={processing}>
            Export Now ({Object.keys(results).length} processed)
          </button>
        )}
      </div>
    </div>
  );
}
