import { Space_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata = {
  title: "Pending Payments Board | Shop Portal",
  description: "Secure pending payments management and customer transaction history board.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${spaceMono.variable} ${plusJakartaSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
