import { useEffect, useState } from 'react';

type Loan = {
  id: string;
  requester: string;
  amount: number;
  interest_bps: number;
  due_epoch: number;
  backed: boolean;
  backer: string;
  escrow_id: string;
};

export const LoanList: React.FC<{
  address: string;
  signTx: (txBytes: string) => Promise<void>;
}> = ({ address }) => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchLoans = async () => {
    try {
      console.log(`Fetching loans for owner: ${address}`);
      const response = await fetch(`http://localhost:3001/list-loans?owner=${address}`);
      if (!response.ok) {
        if (response.status === 404) {
          setLoans([]); // Handle 404 by setting empty loans
          return;
        }
        const text = await response.text();
        throw new Error(`HTTP error! Status: ${response.status}, Response: ${text}`);
      }
      const data = await response.json();
      if (data.success) {
        setLoans(data.loans || []);
      } else {
        throw new Error(data.error || 'Failed to fetch loans');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('Failed to fetch loans:', errorMessage);
      setError(errorMessage);
    }
  };

  useEffect(() => {
    if (address) {
      fetchLoans();
    }
  }, [address]);

  return (
    <div className="loan-list">
      <h3>Your Loans</h3>
      {error && <div className="error">{error}</div>}
      {loans.length === 0 ? (
        <p>No loans found.</p>
      ) : (
        <ul>
          {loans.map((loan) => (
            <li key={loan.id}>
              <div>Loan ID: {loan.id}</div>
              <div>Amount: {loan.amount} SUI</div>
              <div>Interest: {loan.interest_bps / 100}%</div>
              <div>Due Epoch: {loan.due_epoch}</div>
              <div>Backed: {loan.backed ? 'Yes' : 'No'}</div>
              <div>Backer: {loan.backer}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};