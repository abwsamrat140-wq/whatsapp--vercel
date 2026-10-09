import './globals.css';

export const metadata = {
  title: 'WhatsApp Web',
  description: 'ربط جهازك بـ WhatsApp',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
