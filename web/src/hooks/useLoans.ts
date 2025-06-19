import { useState, useEffect } from 'react';

const BACKEND_URL = 'http://localhost:3001';

export const useLoans = (address: string | null) => {
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLoans = async () => {
    if (!address) return;
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/list-loans?owner=${address}`);
      const data = await response.json();
      if (data.success) {
        setLoans(data.loans);
      } else {
        setLoans([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoans();
  }, [address]);

  return { loans, loading, error, refetch: fetchLoans };
};