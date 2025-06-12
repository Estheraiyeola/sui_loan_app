import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3000;
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());


app.get('/', (req, res) => {
  res.send('Microloan API is running!');
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});


const PORT = process.env.PORT || '3001';
// const { SUI_URL, PACKAGE_ID, MODULE_NAME } = process.env;
const PACKAGE_ID = '0x84b10f347185089b21b5c1c9443baede698fe0d93fc0f82e0adb651a35aab673';
const MODULE_NAME ='microloan';

// Initialize Sui provider
const provider = new SuiClient({ url: getFullnodeUrl('testnet') });

// Helper: Get SUI coin for amount
async function getCoinForAmount(address, amount) {
  const coins = await provider.getCoins({ owner: address, coinType: '0x2::sui::SUI' });
  const coin = coins.data.find(c => parseInt(c.balance) >= amount * 1e9);
  if (!coin) throw new Error(`No coin with balance >= ${amount} MIST`);
  return coin.coinObjectId;
}

// POST /init-reputation
app.post('/init-reputation', async (req, res) => {
  try {
    const { userAddress } = req.body;
    console.log('Initializing reputation for:', userAddress);
    console.log('Package ID:', PACKAGE_ID);
    console.log('Module Name:', MODULE_NAME);
    if (!userAddress) return res.status(400).json({ error: 'userAddress required' });
    const tx = new Transaction();
    tx.moveCall({ target: `${PACKAGE_ID}::${MODULE_NAME}::init_reputation`, arguments: [] });
    const bytes = await tx.build({ provider });
    res.json({ success: true, transactionBytes: bytes.toString('base64') });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /create-loan
app.post('/create-loan', async (req, res) => {
  try {
    const { amount, interestBps, dueEpoch, userAddress } = req.body;
    if (!amount || !interestBps || !dueEpoch || !userAddress) {
      return res.status(400).json({ error: 'amount, interestBps, dueEpoch, userAddress required' });
    }
    const coinId = await getCoinForAmount(userAddress, amount);
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::create_loan`,
      arguments: [tx.object(coinId), tx.pure.u64(interestBps), tx.pure.u64(dueEpoch)],
    });
    const bytes = await tx.build({ provider });
    res.json({ success: true, transactionBytes: bytes.toString('base64') });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /back-loan
app.post('/back-loan', async (req, res) => {
  try {
    const { loanRequestId, amount, userAddress } = req.body;
    if (!loanRequestId || !amount || !userAddress) {
      return res.status(400).json({ error: 'loanRequestId, amount, userAddress required' });
    }
    const coinId = await getCoinForAmount(userAddress, amount);
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::back_loan`,
      arguments: [tx.object(coinId), tx.object(loanRequestId)],
    });
    const bytes = await tx.build({ provider });
    res.json({ success: true, transactionBytes: bytes.toString('base64') });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /repay
app.post('/repay', async (req, res) => {
  try {
    const { loanRequestId, repaymentAmount, reputationId, userAddress } = req.body;
    if (!loanRequestId || !repaymentAmount || !reputationId || !userAddress) {
      return res.status(400).json({ error: 'loanRequestId, repaymentAmount, reputationId, userAddress required' });
    }
    const coinId = await getCoinForAmount(userAddress, repaymentAmount);
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::repay`,
      arguments: [tx.object(coinId), tx.object(loanRequestId), tx.object(reputationId)],
    });
    const bytes = await tx.build({ provider });
    res.json({ success: true, transactionBytes: bytes.toString('base64') });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /get-reputation
app.get('/get-reputation', async (req, res) => {
  try {
    const { userAddress } = req.query;
    if (!userAddress) return res.status(400).json({ error: 'userAddress required' });
    const reputation = await provider.getOwnedObjects({
      owner: userAddress,
      filter: { StructType: `${PACKAGE_ID}::${MODULE_NAME}::Reputation` },
      options: { showContent: true },
    });
    if (!reputation.data.length) return res.status(404).json({ error: 'Reputation not found' });
    res.json({ success: true, score: reputation.data[0].data.content.fields.score });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /get-loan-details
app.get('/get-loan-details', async (req, res) => {
  try {
    const { loanRequestId } = req.query;
    if (!loanRequestId) return res.status(400).json({ error: 'loanRequestId required' });
    const loan = await provider.getObject({
      id: loanRequestId,
      options: { showContent: true },
    });
    if (loan.data.content.type !== `${PACKAGE_ID}::${MODULE_NAME}::LoanRequest`) {
      return res.status(404).json({ error: 'LoanRequest not found' });
    }
    res.json({ success: true, loan: loan.data.content.fields });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));