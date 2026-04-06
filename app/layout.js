import "./globals.css";
import "./dark-theme.css";
import "./chatbot.css";
import 'leaflet/dist/leaflet.css';
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import Chatbot from "@/components/Chatbot";
import PusherListener from '@/components/PusherListener';
import { ThemeProvider } from "@/context/ThemeContext";
import SessionWrapper from "@/components/SessionProvider";
import ToastProvider from "@/context/ToastContext";
import RequestTrackingProvider from "@/context/RequestTrackingContext";

// 1. Configure Metadata and PWA Manifest
export const metadata = {
  title: "RareBlood Connect - Connecting Lives in Critical Moments",
  description: "Real-time blood donor matching that saves lives",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192x192.png",
    apple: "/icon-192x192.png",
  },
};

// 2. Configure Viewport (Status bar color & Zoom settings)
// Next.js separates viewport configuration from metadata
export const viewport = {
  themeColor: "#ef4444", // Red primary color for status bar on mobile devices
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Prevent user zoom to maintain app-like experience
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning={true}>
      <body className={`font-sans bg-[var(--background)] text-[var(--text-primary)] transition-colors duration-200`}>
        <ThemeProvider>
          <SessionWrapper>
            <RequestTrackingProvider>
              <ToastProvider>
                <Navbar />
                <main className="min-h-screen">
                  {children}
                </main>
                <Footer />
                <Chatbot />
                {/* Global Pusher listener for real-time alerts */}
                <PusherListener />
              </ToastProvider>
            </RequestTrackingProvider>
          </SessionWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}