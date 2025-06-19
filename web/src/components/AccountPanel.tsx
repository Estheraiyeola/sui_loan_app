import React from 'react';
import { useReputation } from '../hooks/useReputation';

interface AccountPanelProps {
  account: { address: string; provider: string };
  balance: number | undefined;
  signTx: (txBytes: string) => Promise<void>;
  isCurrent: boolean;
}

export const AccountPanel: React.FC<AccountPanelProps> = ({ account, balance, signTx, isCurrent }) => {
  const { reputation, reputationId, loading, error, initReputation, refetch } = useReputation(account.address);

  const handleInitReputation = async () => {
    try {
      await initReputation(signTx);
      await refetch();
    } catch (err) {
      console.error('Failed to initialize reputation:', err);
    }
  };

  return (
    <div className="account-panel" style={{ border: isCurrent ? '2px solid green' : '1px solid gray', padding: '10px', margin: '10px' }}>
      <h3>Account ({account.provider})</h3>
      <p>Address: {account.address}</p>
      <p>Balance: {balance !== undefined ? `${balance} SUI` : 'Loading...'}</p>
      <p>Reputation: {loading ? 'Loading...' : reputation !== null ? reputation : 'Not initialized'}</p>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {!reputationId && (
        <button onClick={handleInitReputation} disabled={loading || !isCurrent}>
          Initialize Reputation
        </button>
      )}
    </div>
  );
};