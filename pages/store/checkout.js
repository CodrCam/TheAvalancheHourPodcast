// /pages/store/checkout.js
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function CheckoutRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/store/checkout/shipping');
  }, [router]);

  return null;
}