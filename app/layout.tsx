import './globals.css';
import { initializeAdmin } from '@/lib/init';

export const metadata = {
  title: 'Medicine Image Processor',
  description: 'Process and upload medicine images',
};

// Initialize admin on server startup
initializeAdmin().catch(console.error);

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
