import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your Resourceful account to access your property tax appeal reports, download PDFs, and track your appeal status.',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
