import React from 'react';
import { makePolymediaUrl, requestSuiFromFaucet } from '@polymedia/suitcase-core';
import { useReputation } from '../hooks/useReputation';
import { NETWORK } from '../App';

type AccountPanelProps = {
  account: { address: string; provider: string; sub: string };
  balance: number | undefined;
  signTx: (txBytes: string) => Promise<void>;
};

export const AccountPanel: React.FC<AccountPanelProps> = ({ account, balance, signTx }) => {
  const { reputation, reputationId, loading, error, initReputation } = useReputation(account.address);

  return (
    <div className="account">
      <label className={`provider ${account.provider}`}>{account.provider}</label>
      <div>
        Address: <a href={makePolymediaUrl(NETWORK, 'address', account.address)} target="_blank" rel="noopener">{account.address}</a>
      </div>
      <div>User ID: {account.sub}</div>
      <div>Balance: {balance ?? '(loading)'} SUI</div>
      <div>Reputation: {reputation ?? 'None'}</div>
      {error && <div className="error">{error}</div>}
      {!reputation && (
        <button className="btn-action" onClick={() => initReputation(signTx)} disabled={loading}>
          {loading ? 'Initializing...' : 'Initialize Reputation'}
        </button>
      )}
      {balance === 0 && (
        <button className="btn-faucet" onClick={() => requestSuiFromFaucet(NETWORK, account.address)}>
          Use Faucet
        </button>
      )}
      <hr />
    </div>
  );
};