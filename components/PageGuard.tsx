    'use client';

import { ReactNode } from 'react';

type PageGuardProps = {
  children: ReactNode;
};

export default function PageGuard({ children }: PageGuardProps) {
  // ❗ No auth, no redirect, no login logic
  return <>{children}</>;
}
