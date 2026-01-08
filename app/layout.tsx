import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "../components/layout/Sidebar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Scrappy v2",
  description: "Amazon seller management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <div className="flex">
          <Sidebar />
          <main className="flex-1" style={{ backgroundColor: '#f2f2f2' }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
