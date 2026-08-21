import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import PickupPracticeHome from "@/components/PickupPracticeHome";
import "./globals.css";

// Tightly-cropped square export of dukebox-jazzmaster.png — small enough for
// tab/home-screen icons, and the guitar fills the frame so it reads at 16px.
const BRAND_ICON = "/dukebox-jazzmaster-icon.png";

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
      // Keep this list and the default in step with PALETTES / DEFAULT_PALETTE
      // in app/page.js — this runs before hydration, so it can't import them.
      const palettes = ['studio','regatta','ember','kiln','harbor'];
      const savedPalette = localStorage.getItem('dukebox-palette');
      const savedMode = localStorage.getItem('dukebox-mode');
      const palette = palettes.includes(savedPalette) ? savedPalette : 'harbor';
      const mode = savedMode === 'light' || savedMode === 'dark'
        ? savedMode
        : 'light';
      document.documentElement.dataset.palette = palette;
      document.documentElement.dataset.mode = mode;
      document.documentElement.style.colorScheme = mode;
    })();
  `;

  return (
    <html lang="en" data-palette="harbor" data-mode="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        {/* Home's marquee redesign (PickupPracticeHome.jsx) — display face for
            its headings, mono for its shortcut chips and eyebrows. Scoped by
            use, not by page: nothing outside that component reaches for them. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;800;900&family=Work+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600;700&display=swap"
        />
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
        <PickupPracticeHome />
        <KeyboardShortcuts />
      </body>
    </html>
  );
}
