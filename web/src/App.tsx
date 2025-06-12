import React, { useEffect, useRef, useState } from 'react';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import {
  genAddressSeed,
  generateNonce,
  generateRandomness,
  getExtendedEphemeralPublicKey,
  getZkLoginSignature,
  jwtToAddress,
} from '@mysten/sui/zklogin';
import { jwtDecode } from 'jwt-decode';
// import { makePolymediaUrl, requestSuiFromFaucet } from '@polymedia/suitcase-core';
import { Modal, isLocalhost } from '@polymedia/suitcase-react';
import config from './config.example.json';
import { AccountPanel } from './components/AccountPanel';
import { CreateLoanForm } from './components/CreateLoanForms';
import { LoanList } from './components/LoanList';
import './App.less';


// Helper to decode base64 to Uint8Array
function decodeBase64(base64: string): Uint8Array {
  if (typeof window !== 'undefined' && window.atob) {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  return Uint8Array.from(Buffer.from(base64, 'base64'));
}

export const NETWORK = 'testnet';
const MAX_EPOCH = 2;
const SUI_CLIENT = new SuiClient({ url: getFullnodeUrl(NETWORK) });
const SETUP_KEY = 'zklogin-demo.setup';
const ACCOUNTS_KEY = 'zklogin-demo.accounts';

type OpenIdProvider = 'Google' | 'Twitch' | 'Facebook';
type SetupData = { provider: OpenIdProvider; maxEpoch: number; randomness: string; privateKey: string };
type AccountData = { provider: OpenIdProvider; address: string; zkProofs: any; privateKey: string; salt: string; sub: string; aud: string; maxEpoch: number };

export const App: React.FC = () => {
  const accountsRef = useRef<AccountData[]>(loadAccounts());
  const [balances, setBalances] = useState<Map<string, number>>(new Map());
  const [modal, setModal] = useState<string>('');

  useEffect(() => {
    handleRedirect();
    refreshBalances();
    const id = setInterval(refreshBalances, 5000);
    return () => clearInterval(id);
  }, []);

  const saveSetup = (data: SetupData) => sessionStorage.setItem(SETUP_KEY, JSON.stringify(data));
  const loadSetup = (): SetupData | null => JSON.parse(sessionStorage.getItem(SETUP_KEY) || 'null');
  const clearSetup = () => sessionStorage.removeItem(SETUP_KEY);

  const saveAccount = (acct: AccountData) => {
    if (!acct.address.startsWith('0x')) return;
    accountsRef.current = [acct, ...accountsRef.current];
    sessionStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accountsRef.current));
    refreshBalances();
  };

  function loadAccounts(): AccountData[] {
    try {
      const raw = JSON.parse(sessionStorage.getItem(ACCOUNTS_KEY) || '[]');
      return raw.filter((a: any) => typeof a.address === 'string' && a.address.startsWith('0x'));
    } catch {
      return [];
    }
  }

  const clearState = () => {
    sessionStorage.clear();
    accountsRef.current = [];
    setBalances(new Map());
  };

  const refreshBalances = async () => {
    const map = new Map<string, number>();
    await Promise.all(
      accountsRef.current.map(async (acct) => {
        try {
          const bal = await SUI_CLIENT.getBalance({ owner: acct.address, coinType: '0x2::sui::SUI' });
          map.set(acct.address, Number(bal.totalBalance) / 1e9);
        } catch (err) {
          console.warn(`Balance fetch failed for ${acct.address}:`, err);
        }
      })
    );
    setBalances(map);
  };

  const startLogin = async (provider: OpenIdProvider) => {
    setModal(`Logging in with ${provider}…`);
    const { epoch } = await SUI_CLIENT.getLatestSuiSystemState();
    const maxEpoch = Number(epoch) + MAX_EPOCH;
    const keypair = new Ed25519Keypair();
    const randomness = generateRandomness();
    const nonce = generateNonce(keypair.getPublicKey(), maxEpoch, randomness);
    saveSetup({ provider, maxEpoch, randomness: randomness.toString(), privateKey: keypair.getSecretKey()});

    const CLIENT_ID_MAP: Record<OpenIdProvider, keyof typeof config> = {
      Google: 'CLIENT_ID_GOOGLE',
      Twitch: 'CLIENT_ID_TWITCH',
      Facebook: 'CLIENT_ID_FACEBOOK',
    };
    const params = new URLSearchParams({
      client_id: config[CLIENT_ID_MAP[provider]],
      nonce,
      redirect_uri: window.location.origin + '/callback',
      response_type: 'id_token',
      scope: 'openid',
    });
    const urlMap: Record<OpenIdProvider, string> = {
      Google: 'accounts.google.com/o/oauth2/v2/auth',
      Twitch: 'id.twitch.tv/oauth2/authorize',
      Facebook: 'www.facebook.com/v19.0/dialog/oauth',
    };
    window.location.href = `https://${urlMap[provider]}?${params}`;
  };

  const handleRedirect = async () => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const jwt = new URLSearchParams(hash).get('id_token');
    window.history.replaceState(null, '', window.location.pathname + '/callback');
    if (!jwt) return;

    const { sub, aud } = jwtDecode<{ sub: string; aud: string }>(jwt);
    const setup = loadSetup(); if (!setup) return;
    clearSetup();

    const saltRes = await fetch(config.URL_SALT_SERVICE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jwt }),
    });
    const { salt } = await saltRes.json();
    let rawAddress = jwtToAddress(jwt, BigInt(salt));
    const address = rawAddress.startsWith('0x') ? rawAddress : `0x${rawAddress}`;

    const payload = {
      maxEpoch: setup.maxEpoch,
      jwtRandomness: setup.randomness,
      extendedEphemeralPublicKey: getExtendedEphemeralPublicKey(new Ed25519Keypair().getPublicKey()),
      jwt,
      salt,
      keyClaimName: 'sub',
    };
    
    const zkRes = await fetch(config.URL_ZK_PROVER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const zkProofs = await zkRes.json();

    saveAccount({ provider: setup.provider, address, zkProofs, privateKey: setup.privateKey, salt, sub, aud, maxEpoch: setup.maxEpoch });
    setModal('');
  };

  const signTx = async (acct: AccountData, txBytes: string) => {
    setModal('Signing transaction…');
    try {
      const keypair = Ed25519Keypair.fromSecretKey(acct.privateKey);
      const tx = Transaction.from(Buffer.from(txBytes, 'base64'));
      tx.setSender(acct.address);
      const { bytes, signature } = await tx.sign({ client: SUI_CLIENT, signer: keypair });
      const seed = genAddressSeed(BigInt(acct.salt), 'sub', acct.sub, acct.aud).toString();
      const zkSig = getZkLoginSignature({ inputs: { ...acct.zkProofs, addressSeed: seed }, maxEpoch: acct.maxEpoch, userSignature: signature });
      const result = await SUI_CLIENT.executeTransactionBlock({
        transactionBlock: bytes,
        signature: zkSig,
        options: { showEffects: true, showObjectChanges: true },
      });
      setModal(`Transaction succeeded: ${result.digest}`);
      refreshBalances();
    } catch (err) {
      console.error('Transaction failed', err);
      setModal(`Transaction failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const providers: OpenIdProvider[] = isLocalhost() ? ['Google', 'Twitch', 'Facebook'] : ['Google', 'Twitch'];

  return (
    <div id="page">
      <Modal onClose={() => setModal('')}>{modal}</Modal>
      <div id="network-indicator">{NETWORK}</div>
      <h1>Microloan DApp</h1>
      <section id="login-buttons" className="section">
        <h2>Log in:</h2>
        {providers.map(p => (
          <button key={p} className={`btn-login ${p}`} onClick={() => startLogin(p)}>
            {p}
          </button>
        ))}
      </section>
      <section id="accounts" className="section">
        {accountsRef.current
          .filter(acct => acct.address)
          .map((acct, idx) => (
            <div key={`${acct.address}-${idx}`}>
              <AccountPanel
                account={acct}
                balance={balances.get(acct.address)}
                signTx={txBytes => signTx(acct, txBytes)}
              />
              <CreateLoanForm address={acct.address} signTx={txBytes => signTx(acct, txBytes)} />
              <LoanList address={acct.address} signTx={txBytes => signTx(acct, txBytes)} />
            </div>
          ))}
        <button className="btn-clear" onClick={clearState}>🧨 CLEAR STATE</button>
      </section>
    </div>
  );
};