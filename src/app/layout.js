import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import PickupPracticeHome from "@/components/PickupPracticeHome";
import "./globals.css";

export const metadata = {
  title: "The DukeBox",
  description: "The Duke Box",
  icons: {
    icon: "/dukebox-goldtop.svg",
    shortcut: "/dukebox-goldtop.svg",
    apple: "/dukebox-goldtop.svg",
  },
};

export default function RootLayout({ children }) {
  const themeBootScript = `
    (() => {
      const palettes = ['bluenote','brass','console','loft','ecm','hotclub','chalk','tape'];
      const savedPalette = localStorage.getItem('dukebox-palette');
      const savedMode = localStorage.getItem('dukebox-mode');
      const palette = palettes.includes(savedPalette) ? savedPalette : 'bluenote';
      const mode = savedMode === 'light' || savedMode === 'dark'
        ? savedMode
        : (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
      document.documentElement.dataset.palette = palette;
      document.documentElement.dataset.mode = mode;
      document.documentElement.style.colorScheme = mode;
    })();
  `
  return (
    <html lang="en" data-palette="bluenote" data-mode="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <style>{`
          .db-pickup-logo-mark {
            width: 30px !important;
            height: 30px !important;
            flex: 0 0 30px !important;
            transform: none !important;
            background: url('/dukebox-goldtop.svg') center / contain no-repeat !important;
          }
          .db-pickup-logo-mark i { display: none !important; }
        `}</style>
      </head>
      <body>
        {children}
        <PickupPracticeHome />
        <KeyboardShortcuts />
      </body>
    </html>
  );
}