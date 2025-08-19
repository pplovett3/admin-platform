"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, parseJwt, Role } from '@/app/_utils/auth';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    const payload = parseJwt(token);
    if (!payload) {
      router.replace('/login');
      return;
    }
    const role: Role | undefined = payload.role as Role | undefined;
    if (role === 'superadmin') router.replace('/admin/analytics');
    else router.replace('/analytics');
  }, [router]);

  return null;
}
