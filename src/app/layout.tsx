import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vantage Ledger | Advanced Financial Systems',
  description: 'Streamlined financial entity management and AI-powered transaction mapping.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&family=Source+Code+Pro:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
