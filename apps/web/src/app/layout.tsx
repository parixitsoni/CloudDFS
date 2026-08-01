import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { ToastProvider } from "@/components/Toast";
import { VisitorTracker } from "@/components/VisitorTracker";

export const metadata: Metadata = {
  title: "CloudDFS | Fault-Tolerant Distributed Storage",
  description:
    "A production-grade distributed file system built with TypeScript, Node.js, and Cloudflare R2 / AWS S3 backend.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased text-slate-900 bg-slate-50 min-h-screen pb-12" suppressHydrationWarning>
        <ToastProvider>
          <VisitorTracker />
          <Navbar />
          <main className="max-w-7xl mx-auto px-3 sm:px-6">{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
