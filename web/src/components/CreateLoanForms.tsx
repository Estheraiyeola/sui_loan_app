import React, { useState } from 'react';
import { useLoans } from '../hooks/useLoans';

type CreateLoanFormProps = {
  address: string | null;
  signTx: (txBytes: string) => Promise<void>;
};

export const CreateLoanForm: React.FC<CreateLoanFormProps> = ({ address, signTx }) => {
  const { loading, error, createLoan } = useLoans(address);
  const [formData, setFormData] = useState({ amount: '', interestBps: '', dueEpoch: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createLoan(Number(formData.amount), Number(formData.interestBps), Number(formData.dueEpoch), signTx);
  };

  return (
    <div className="create-loan-form">
      <h3>Create Loan</h3>
      <form onSubmit={handleSubmit}>
        <input
          type="number"
          placeholder="Amount (SUI)"
          value={formData.amount}
          onChange={e => setFormData({ ...formData, amount: e.target.value })}
        />
        <input
          type="number"
          placeholder="Interest (bps)"
          value={formData.interestBps}
          onChange={e => setFormData({ ...formData, interestBps: e.target.value })}
        />
        <input
          type="number"
          placeholder="Due Epoch"
          value={formData.dueEpoch}
          onChange={e => setFormData({ ...formData, dueEpoch: e.target.value })}
        />
        <button type="submit" className="btn-action" disabled={loading}>
          {loading ? 'Creating...' : 'Create Loan'}
        </button>
      </form>
      {error && <div className="error">{error}</div>}
    </div>
  );
};