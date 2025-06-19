import React, { useState } from 'react';
import { useReputation } from '../hooks/useReputation';

interface CreateLoanFormProps {
  address: string;
  signTx: (txBytes: string) => Promise<void>;
  disabled: boolean;
}

export const CreateLoanForm: React.FC<CreateLoanFormProps> = ({ address, signTx, disabled }) => {
  const { reputationId, loading } = useReputation(address);
  const [amount, setAmount] = useState('');
  const [interestBps, setInterestBps] = useState('');
  const [dueEpoch, setDueEpoch] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reputationId) {
      alert('Please initialize your reputation first.');
      return;
    }
    try {
      const response = await fetch('http://localhost:3001/create-loan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: address,
          amount: Number(amount) * 1e9, // Convert SUI to MIST
          interestBps: Number(interestBps),
          dueEpoch: Number(dueEpoch),
        }),
      });
      const { success, transactionBytes, error } = await response.json();
      if (!success) throw new Error(error || 'Failed to create loan');
      await signTx(transactionBytes);
      alert('Loan created successfully!');
    } catch (err) {
      console.error('Failed to create loan:', err);
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="create-loan-form" style={{ padding: '10px', margin: '10px' }}>
      <h3>Create Loan</h3>
      {!reputationId && !loading && <p style={{ color: 'red' }}>Initialize reputation before creating a loan.</p>}
      <form onSubmit={handleSubmit}>
        <div>
          <label>Amount (SUI):</label>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            disabled={disabled || !reputationId || loading}
            required
          />
        </div>
        <div>
          <label>Interest Rate (BPS, e.g., 100 = 1%):</label>
          <input
            type="number"
            value={interestBps}
            onChange={e => setInterestBps(e.target.value)}
            disabled={disabled || !reputationId || loading}
            required
          />
        </div>
        <div>
          <label>Due Epoch:</label>
          <input
            type="number"
            value={dueEpoch}
            onChange={e => setDueEpoch(e.target.value)}
            disabled={disabled || !reputationId || loading}
            required
          />
        </div>
        <button type="submit" disabled={disabled || !reputationId || loading}>
          Create Loan
        </button>
      </form>
    </div>
  );
};