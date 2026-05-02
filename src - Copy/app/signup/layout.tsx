import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Account',
  description: 'Create your Resourceful account to get started with your property tax appeal report. Track your report progress and access your analysis anytime.',
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
