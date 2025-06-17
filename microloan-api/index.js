import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import cors from 'cors';

const app = express();
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*', // Allow all origins by default,
}));
app.use(express.json());

const PORT      = process.env.PORT      || 3001;
const PACKAGE_ID= "0x84b10f347185089b21b5c1c9443baede698fe0d93fc0f82e0adb651a35aab673"
const MODULE_NAME= "microloan"

// Initialize Sui provider (devnet/testnet as you prefer)
const provider = new SuiClient({ url: getFullnodeUrl('devnet') });

/**
 * POST /init-reputation
 * Builds a tx that calls init_reputation()
 */
app.post('/init-reputation', async (req, res) => {
  const { userAddress } = req.body;
  if (!userAddress) {
    return res.status(400).json({ success: false, error: 'userAddress required' });
  }
  try {
    const tx = new Transaction();

    // You don't need to split coins if init_reputation takes no coin input.
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::init_reputation`,
      arguments: [],
    });

    const { transactionBlockBytes } = await tx.build({ client: provider });
    return res.json({
      success: true,
      transactionBytes: Buffer.from(transactionBlockBytes).toString('base64'),
    });
  } catch (e: any) {
    console.error('[POST /init-reputation] error:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /create-loan
 * Builds a tx that splits off `amount`, then calls request_loan(coin, interestBps, dueEpoch)
 */
app.post('/create-loan', async (req, res) => {
  const { userAddress, amount, interestBps, dueEpoch } = req.body;
  if (!userAddress || amount == null || interestBps == null || dueEpoch == null) {
    return res.status(400).json({ success: false, error: 'userAddress, amount, interestBps, dueEpoch required' });
  }
  try {
    const tx = new Transaction();

    // Split off exactly `amount` (in MIST) from gas
    const [loanCoin] = tx.splitCoins(tx.gas, [amount]);

    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::request_loan`,
      arguments: [
        loanCoin,
        tx.pure.u64(interestBps),
        tx.pure.u64(dueEpoch),
      ],
    });

    const { transactionBlockBytes } = await tx.build({ client: provider });
    return res.json({
      success: true,
      transactionBytes: Buffer.from(transactionBlockBytes).toString('base64'),
    });
  } catch (e: any) {
    console.error('[POST /create-loan] error:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /back-loan
 * Builds a tx that splits `amount`, then calls back_loan(coin, LoanRequest)
 */
app.post('/back-loan', async (req, res) => {
  const { userAddress, loanRequestId, amount } = req.body;
  if (!userAddress || !loanRequestId || amount == null) {
    return res.status(400).json({ success: false, error: 'userAddress, loanRequestId, amount required' });
  }
  try {
    const tx = new Transaction();

    const [backCoin] = tx.splitCoins(tx.gas, [amount]);

    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::back_loan`,
      arguments: [
        backCoin,
        tx.object(loanRequestId),
      ],
    });

    const { transactionBlockBytes } = await tx.build({ client: provider });
    return res.json({
      success: true,
      transactionBytes: Buffer.from(transactionBlockBytes).toString('base64'),
    });
  } catch (e: any) {
    console.error('[POST /back-loan] error:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /repay
 * Builds a tx that splits `repaymentAmount`, then calls repay(coin, LoanRequest, Reputation)
 */
app.post('/repay', async (req, res) => {
  const { userAddress, loanRequestId, repaymentAmount, reputationId } = req.body;
  if (!userAddress || !loanRequestId || repaymentAmount == null || !reputationId) {
    return res.status(400).json({ success: false, error: 'userAddress, loanRequestId, repaymentAmount, reputationId required' });
  }
  try {
    const tx = new Transaction();

    const [repayCoin] = tx.splitCoins(tx.gas, [repaymentAmount]);

    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::repay`,
      arguments: [
        repayCoin,
        tx.object(loanRequestId),
        tx.object(reputationId),
      ],
    });

    const { transactionBlockBytes } = await tx.build({ client: provider });
    return res.json({
      success: true,
      transactionBytes: Buffer.from(transactionBlockBytes).toString('base64'),
    });
  } catch (e: any) {
    console.error('[POST /repay] error:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * GET /get-reputation
 * Returns the on-chain reputation score for a user
 */
app.get('/get-reputation', async (req, res) => {
  let userAddress = req.query.userAddress;
  if (Array.isArray(userAddress)) userAddress = userAddress[0];

  if (!userAddress || typeof userAddress !== 'string') {
    return res.status(400).json({ success: false, error: 'userAddress required' });
  }
  if (!userAddress.startsWith('0x')) userAddress = '0x' + userAddress;

  try {
    const objs = await provider.getOwnedObjects({
      owner: userAddress,
      filter: { StructType: `${PACKAGE_ID}::${MODULE_NAME}::Reputation` },
      options: { showContent: true },
    });
    if (objs.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Reputation not found' });
    }
    const score = Number(objs.data[0].data.content.fields.score);
    return res.json({ success: true, score });
  } catch (e: any) {
    console.error('[GET /get-reputation] error:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * GET /list-loans
 * Returns all active LoanRequest objects on-chain
 */
app.get('/list-loans', async (_req, res) => {
  try {
    const objs = await provider.getOwnedObjects({
      filter: { StructType: `${PACKAGE_ID}::${MODULE_NAME}::LoanRequest` },
      options: { showContent: true },
    });
    const loans = objs.data.map(o => ({
      id: o.data.objectId,
      ...o.data.content.fields,
    }));
    return res.json({ success: true, loans });
  } catch (e: any) {
    console.error('[GET /list-loans] error:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * GET /get-loan-details?loanRequestId=…
 * Returns a single LoanRequest’s fields
 */
app.get('/get-loan-details', async (req, res) => {
  let loanRequestId = req.query.loanRequestId;
  if (Array.isArray(loanRequestId)) loanRequestId = loanRequestId[0];

  if (!loanRequestId) {
    return res.status(400).json({ success: false, error: 'loanRequestId required' });
  }
  try {
    const loan = await provider.getObject({
      id: loanRequestId,
      options: { showContent: true },
    });
    if (loan.data.content.type !== `${PACKAGE_ID}::${MODULE_NAME}::LoanRequest`) {
      return res.status(404).json({ success: false, error: 'LoanRequest not found' });
    }
    return res.json({ success: true, loan: loan.data.content.fields });
  } catch (e: any) {
    console.error('[GET /get-loan-details] error:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`🟢 Microloan API listening on port ${PORT}`);
});
