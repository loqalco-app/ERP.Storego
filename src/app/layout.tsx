import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Store ERP",
  description: "Sistema de gestión comercial",
  manifest: "/manifest.json",
  themeColor: "#F5F5F7",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
