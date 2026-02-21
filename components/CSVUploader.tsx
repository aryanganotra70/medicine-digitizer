'use client';

import { useState } from 'react';
import { MedicineRow } from '@/lib/types';

interface Props {
  onUpload: (medicines: MedicineRow[]) => void;
}

export default function CSVUploader({ onUpload }: Props) {
  const [loading, setLoading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload-csv', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      onUpload(data.medicines);
    } catch (error) {
      alert('Failed to upload CSV');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-container">
      <input
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        disabled={loading}
        className="file-input"
      />
      {loading && <p>Loading...</p>}
    </div>
  );
}
