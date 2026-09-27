import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { Nav } from "@/components/Nav";
import "./globals.css";

const display = Bricolage_Grotesque({ variable: "--ff-display", subsets: ["latin"], axes: ["wdth"] });
const body = Instrument_Sans({ variable: "--ff-body", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Outlier",
  description: "Capture outlier Instagram posts and turn their hooks into ads with MarioBot.",
};

const themeScript = `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${display.variable} ${body.variable} antialiased min-h-screen`}>
        <Nav />
        {children}
        <Toaster position="bottom-left" toastOptions={{ style: { fontFamily: "var(--ff-body)" } }} />
      </body>
    </html>
  );
}
