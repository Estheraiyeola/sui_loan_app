import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { useEffect, useState } from "react";

// Replace the value below with your actual backend URL or import it from your config
const BACKEND_URL = "http://localhost:3001";
const SUI_CLIENT = new SuiClient({ url: getFullnodeUrl('devnet') });
const PACKAGE_ID = '0x5a356ecbfccc2996dde40d0299b35392d7bf01c49de3261bbf565203ffa9205c'; // Replace with your deployed package ID, e.g., 0x123...


export const useReputation = (address: string | null) => {
  const [reputation, setReputation] = useState<number | null>(null);
  const [reputationId, setReputationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReputation = async () => {
    if (!address) {
      setError('No address provided');
      return;
    }
    setLoading(true);
    try {
      console.log(`Fetching reputation for address: ${address}`);
      const response = await fetch(`${BACKEND_URL}/get-reputation?userAddress=${address}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Get reputation response:', data);
      if (data.success) {
        setReputation(data.score !== null ? Number(data.score) : null);
        if (data.score === null) {
          setReputationId(null);
          return;
        }

        const packageId = data.PACKAGE_ID || PACKAGE_ID;
        if (!packageId) {
          throw new Error('PACKAGE_ID not provided in response or configuration');
        }

        const reps = await SUI_CLIENT.getOwnedObjects({
          owner: address,
          filter: { StructType: `${packageId}::microloan::Reputation` },
          options: { showContent: true },
        });
        console.log('Reputation objects:', reps);
        if (reps.data.length && reps.data[0].data && 'objectId' in reps.data[0].data) {
          setReputationId(reps.data[0].data.objectId);
        } else {
          setReputationId(null);
        }
      } else {
        setReputation(null);
        setReputationId(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('Fetch reputation error:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const initReputation = async (signTx: (txBytes: string) => Promise<void>) => {
    if (!address || typeof address !== 'string') {
      setError('No valid address provided');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      console.log(`Initializing reputation for address: ${address}`);
      const response = await fetch(`${BACKEND_URL}/init-reputation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress: address }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
      }
      const { success, transactionBytes, error } = await response.json();
      if (!success) throw new Error(error || 'Failed to initialize reputation');
      console.log('Transaction Bytes:', transactionBytes);
      await signTx(transactionBytes);
      console.log('Transaction executed');
      await fetchReputation();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('Init reputation error:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReputation();
  }, [address]);

  return { reputation, reputationId, loading, error, initReputation, refetch: fetchReputation };
};