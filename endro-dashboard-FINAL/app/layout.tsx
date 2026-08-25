export const metadata = { title: "Endro Dashboard" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, background: "#fafafa" }}>{children}</body>
    </html>
  );
}
