import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import "./globals.css";

export const metadata = {
  title: "The DukeBox",
  description: "The Duke Box",
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
      <head><script dangerouslySetInnerHTML={{ __html: themeBootScript }} /></head>
      <body>
        {children}
        <KeyboardShortcuts />
      </body>
    </html>
  );
}
