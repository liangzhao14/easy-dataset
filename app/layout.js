import './globals.css';
import ThemeRegistry from '@/components/ThemeRegistry';
import I18nProvider from '@/components/I18nProvider';
import AuthProvider from '@/lib/auth-provider';
import { Toaster } from 'sonner';
import { Provider } from 'jotai';

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
