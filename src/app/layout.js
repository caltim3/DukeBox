import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import PickupPracticeHome from "@/components/PickupPracticeHome";
import AppHomeButton from "@/components/AppHomeButton";
import "./globals.css";

const BRAND_ICON = "/dukebox-jazzmaster.png";

export const metadata = {
  title: "The DukeBox",
  description: "The Duke Box",
  icons: {
    icon: [{ url: BRAND_ICON, type: "image/png" }],
    shortcut: [{ url: BRAND_ICON, type: "image/png" }],
    apple: [{ url: BRAND_ICON, type: "image/png" }],
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
  `;

  return (
    <html lang="en" data-palette="bluenote" data-mode="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <style>{`
          .db-pickup-logo-mark {
            width: 34px !important;
            height: 34px !important;
            flex: 0 0 34px !important;
            transform: none !important;
            background: url('${BRAND_ICON}') center / contain no-repeat !important;
          }
          .db-pickup-logo-mark i { display: none !important; }
        `}</style>
      </head>
      <body>
        {children}
        <AppHomeButton />
        <PickupPracticeHome />
        <KeyboardShortcuts />
      </body>
    </html>
  );
}
