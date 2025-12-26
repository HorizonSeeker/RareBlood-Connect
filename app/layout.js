import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import "./dark-theme.css";
import "./chatbot.css";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import Chatbot from "@/components/Chatbot";
import PusherListener from '@/components/PusherListener';
import { ThemeProvider } from "@/context/ThemeContext";
import SessionWrapper from "@/components/SessionProvider";
import ToastProvider from "@/context/ToastContext";
import RequestTrackingProvider from "@/context/RequestTrackingContext";

// Load Inter as body font
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// Load Manrope as heading font
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

// 1. Cấu hình Metadata (Thêm dòng manifest)
export const metadata = {
  title: "BloodBond - Connecting Lives in Critical Moments",
  description: "Real-time blood donor matching that saves lives",
  manifest: "/manifest.json", // <-- QUAN TRỌNG: Link tới file manifest
  icons: {
    icon: "/icon-192x192.png", // Icon hiển thị trên tab trình duyệt
    apple: "/icon-192x192.png", // Icon cho iPhone
  },
};

// 2. Cấu hình Viewport (Màu sắc thanh trạng thái & Zoom)
// Next.js đời mới khuyến khích tách riêng viewport ra khỏi metadata
export const viewport = {
  themeColor: "#ef4444", // Màu đỏ chủ đạo của app (thanh status bar trên điện thoại sẽ màu này)
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Chặn người dùng zoom vào ra -> Cảm giác giống App Native
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning={true}>
      <body className={`${inter.variable} ${manrope.variable} font-sans bg-[var(--background)] text-[var(--text-primary)] transition-colors duration-200`}>
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