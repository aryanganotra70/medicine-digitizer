export interface MedicineRow {
  name: string;
  imageUrls: string[];
}

export interface GoogleImage {
  url: string;
  thumbnail: string;
  title: string;
}

export interface ProcessedImage {
  originalUrl: string;
  r2Url: string;
}
