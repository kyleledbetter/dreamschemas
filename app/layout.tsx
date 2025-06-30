import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const iconUrl =
  "https://raw.githubusercontent.com/aliasesapp/dreamstack-images/refs/heads/main/images/dreamschemas";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Dreamschemas - CSV to Supabase Schema Converter",
  description:
    "Convert CSV files into production-ready Postgres database schemas for Supabase with AI-powered schema generation and visual editing.",
  icons: {
    icon: `${iconUrl}/favicon-96x96.png`,
  },
  openGraph: {
    title: "Dreamschemas by Dreambase.ai",
    description: "Convert CSVs to Supabase schemas with AI",
    url: "https://dreambase.ai",
    siteName: "Dreamschemas",
    images: [
      {
        url: `${iconUrl}/Dreamschemas-OpenGraph.png`,
      },
    ],
  },
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en\" suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased size-full`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
