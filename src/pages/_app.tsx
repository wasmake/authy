import type { AppProps } from 'next/app';
import { ThemeProvider } from 'next-themes';

import { CurrentUserProvider } from '@/components/me-provider';
import '@/styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <CurrentUserProvider>
        <Component {...pageProps} />
      </CurrentUserProvider>
    </ThemeProvider>
  );
}
