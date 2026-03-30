import type { Metadata } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Header } from "@/components/header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Digital Book",
  description: "A digital book hub for creating and viewing interactive book-style content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="dark h-full antialiased"
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col">
        <TooltipProvider>
          <Header />
          <main className="flex flex-col flex-1">{children}</main>
        </TooltipProvider>
      </body>
    </html>
  );
}
