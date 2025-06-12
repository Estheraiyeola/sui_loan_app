import { useState, useEffect } from 'react';

const BACKEND_URL = 'http://localhost:3001';

export const useLoans = (address: string | null) => {
  const [loans, setLoans] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLoans = async () => {
    if (!address) return;
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/get-loan-details?userAddress=${address}`);
      const data = await response.json();
      if (data.success) {
        const loanMap = new Map();
        data.loans.forEach((loan: any) => {
          loanMap.set(loan.id, {
            id: loan.id,
            amount: loan.amount / 1e9,
            interestBps: loan.interest_bps,
            dueEpoch: loan.due_epoch,
            backed: loan.backed,
            backer: loan.backer,
            requester: loan.requester,
            escrowId: loan.escrow_id,
          });
        });
        setLoans(loanMap);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const createLoan = async (amount: number, interestBps: number, dueEpoch: number, signTx: (txBytes: string) => Promise<void>) => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/create-loan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amount * 1e9, interestBps, dueEpoch, userAddress: address }),
      });
      const { success, transactionBytes, error } = await response.json();
      if (!success) throw new Error(error);
      await signTx(transactionBytes);
      await fetchLoans();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const backLoan = async (loanRequestId: string, amount: number, signTx: (txBytes: string) => Promise<void>) => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/back-loan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loanRequestId, amount: amount * 1e9, userAddress: address }),
      });
      const { success, transactionBytes, error } = await response.json();
      if (!success) throw new Error(error);
      await signTx(transactionBytes);
      await fetchLoans();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const repayLoan = async (loanRequestId: string, repaymentAmount: number, reputationId: string, signTx: (txBytes: string) => Promise<void>) => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/repay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loanRequestId, repaymentAmount: repaymentAmount * 1e9, reputationId, userAddress: address }),
      });
      const { success, transactionBytes, error } = await response.json();
      if (!success) throw new Error(error);
      await signTx(transactionBytes);
      await fetchLoans();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoans();
  }, [address]);

  return { loans, loading, error, createLoan, backLoan, repayLoan, refetch: fetchLoans };
};