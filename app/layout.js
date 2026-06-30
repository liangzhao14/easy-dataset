import './globals.css';
import ThemeRegistry from '@/components/ThemeRegistry';
import I18nProvider from '@/components/I18nProvider';
import AuthProvider from '@/lib/auth-provider';
import { Toaster } from 'sonner';
import { Provider } from 'jotai';
import Script from 'next/script';

export const metadata = {
  title: 'Easy Dataset',
  description: '一个强大的 LLM 数据集生成工具',
  icons: {
    icon: '/imgs/logo.ico'
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Script
          src="http://49.232.88.183:8080/script.js"
          data-website-id="b50b220a-0340-4249-a8f0-640e8037ad2d"
          strategy="afterInteractive"
        />
        <Provider>
          <ThemeRegistry>
            <I18nProvider>
              <AuthProvider>
                {children}
                <Toaster richColors position="top-right" duration={1000} />
              </AuthProvider>
            </I18nProvider>
          </ThemeRegistry>
        </Provider>
      </body>
    </html>
  );
}
