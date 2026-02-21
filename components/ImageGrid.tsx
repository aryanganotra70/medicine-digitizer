'use client';

interface Props {
  images: Array<{ url: string; thumbnail: string; title: string }>;
  selectedUrls: string[];
  onToggle: (url: string) => void;
}

export default function ImageGrid({ images, selectedUrls, onToggle }: Props) {
  return (
    <div className="image-grid">
      {images.map((img) => (
        <div
          key={img.url}
          className={`image-item ${selectedUrls.includes(img.url) ? 'selected' : ''}`}
          onClick={() => onToggle(img.url)}
        >
          <img src={img.thumbnail} alt={img.title} loading="lazy" />
          {selectedUrls.includes(img.url) && <div className="checkmark">✓</div>}
        </div>
      ))}
    </div>
  );
}
