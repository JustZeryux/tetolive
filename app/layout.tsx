import './globals.css';
import CasinoLayout from '@/components/CasinoLayout';
export const metadata = {
  title: 'Teto!live',
  description: 'The best place to coinflip and open cases.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-[#0b0e14] m-0 p-0">
        <CasinoLayout>
          {children}
        </CasinoLayout>
      </body>
    </html>
  );
}