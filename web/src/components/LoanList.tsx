import React, { useState } from 'react';
import { useLoans } from '../hooks/useLoans';
import { useReputation } from '../hooks/useReputation';

type LoanListProps = {
  address: string | null;
  signTx: (txBytes: string) => Promise<void>;
};

export const LoanList: React.FC<LoanListProps> = ({ address, signTx }) => {
  const { loans, loading, error, backLoan, repayLoan } = useLoans(address);
  const { reputationId } = useReputation(address);
  const [backForm, setBackForm] = useState({ loanRequestId: '', amount: '' });
  const [repayForm, setRepayForm] = useState({ loanRequestId: '', repaymentAmount: '' });

  const handleBackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    backLoan(backForm.loanRequestId, Number(backForm.amount), signTx);
  };

  const handleRepaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reputationId) return alert('Reputation not initialized');
    repayLoan(repayForm.loanRequestId, Number(repayForm.repaymentAmount), reputationId, signTx);
  };

  return (
    <div className="loan-list">
      <h3>Loans</h3>
      {Array.from(loans.entries()).map(([id, loan]) => (
        <div key={id} className="loan">
          <div>ID: {id}</div>
          <div>Amount: {loan.amount} SUI</div>
          <div>Interest: {loan.interestBps} bps</div>
          <div>Due Epoch: {loan.dueEpoch}</div>
          <div>Backed: {loan.backed ? 'Yes' : 'No'}</div>
          <div>Backer: {loan.backer}</div>
          <div>Escrow ID: {loan.escrowId}</div>
        </div>
      ))}
      <h3>Back Loan</h3>
      <form onSubmit={handleBackSubmit}>
        <input
          type="text"
          placeholder="Loan Request ID"
          value={backForm.loanRequestId}
          onChange={e => setBackForm({ ...backForm, loanRequestId: e.target.value })}
        />
        <input
          type="number"
          placeholder="Amount (SUI)"
          value={backForm.amount}
          onChange={e => setBackForm({ ...backForm, amount: e.target.value })}
        />
        <button type="submit" className="btn-action" disabled={loading}>
          {loading ? 'Backing...' : 'Back Loan'}
        </button>
      </form>
      <h3>Repay Loan</h3>
      <form onSubmit={handleRepaySubmit}>
        <input
          type="text"
          placeholder="Loan Request ID"
          value={repayForm.loanRequestId}
          onChange={e => setRepayForm({ ...repayForm, loanRequestId: e.target.value })}
        />
        <input
          type="number"
          placeholder="Repayment Amount (SUI)"
          value={repayForm.repaymentAmount}
          onChange={e => setRepayForm({ ...repayForm, repaymentAmount: e.target.value })}
        />
        <button type="submit" className="btn-action" disabled={loading || !reputationId}>
          {loading ? 'Repaying...' : 'Repay Loan'}
        </button>
      </form>
      {error && <div className="error">{error}</div>}
    </div>
  );
};