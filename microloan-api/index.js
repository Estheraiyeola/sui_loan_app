import express from 'express';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const SUI_CLIENT = new SuiClient({ url: getFullnodeUrl('devnet') });
const PACKAGE_ID = '0x5a356ecbfccc2996dde40d0299b35392d7bf01c49de3261bbf565203ffa9205c'; // Your package ID

app.get('/get-reputation', async (req, res) => {
  try {
    const { userAddress } = req.query;
    if (!userAddress || typeof userAddress !== 'string') {
      return res.status(400).json({ success: false, error: 'Invalid userAddress' });
    }

    console.log(`Fetching reputation for address: ${userAddress}`);
    const objects = await SUI_CLIENT.getOwnedObjects({
      owner: userAddress,
      filter: { StructType: `${PACKAGE_ID}::microloan::Reputation` },
      options: { showContent: true },
    });

    console.log('Reputation objects:', objects);
    if (objects.data.length === 0) {
      return res.status(200).json({ success: true, score: null, PACKAGE_ID });
    }

    const reputationObject = objects.data[0].data;
    if (!reputationObject || !('content' in reputationObject) || !reputationObject.content) {
      return res.status(200).json({ success: true, score: null, PACKAGE_ID });
    }

    const score = reputationObject.content.fields?.score || 0;
    return res.status(200).json({ success: true, score, PACKAGE_ID });
  } catch (error) {
    console.error('Error in /get-reputation:', error);
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

app.post('/init-reputation', async (req, res) => {
  try {
    const { userAddress } = req.body;
    if (!userAddress || typeof userAddress !== 'string') {
      return res.status(400).json({ success: false, error: 'Invalid userAddress' });
    }

    console.log(`Initializing reputation for address: ${userAddress}`);
    const tx = new Transaction();
    tx.setSender(userAddress);
    tx.moveCall({
      target: `${PACKAGE_ID}::microloan::init_reputation`,
      arguments: [], // No arguments, as per microloan.move
    });

    const transactionBytes = await tx.build({ client: SUI_CLIENT });
    const transactionBase64 = Buffer.from(transactionBytes).toString('base64');

    return res.status(200).json({ success: true, transactionBytes: transactionBase64 });
  } catch (error) {
    console.error('Error in /init-reputation:', error);
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

app.get('/list-loans', async (req, res) => {
  try {
    const { owner } = req.query;
    if (!owner || typeof owner !== 'string') {
      return res.status(400).json({ success: false, error: 'Invalid owner address' });
    }

    console.log(`Fetching loans for owner: ${owner}`);
    const objects = await SUI_CLIENT.getOwnedObjects({
      owner,
      filter: { StructType: `${PACKAGE_ID}::microloan::LoanRequest` },
      options: { showContent: true },
    });

    console.log('Loan objects:', objects);
    const loans = objects.data.map((obj) => {
      if (!obj.data || !('content' in obj.data) || !obj.data.content) {
        return null;
      }
      const fields = obj.data.content.fields;
      return {
        id: obj.data.objectId,
        requester: fields.requester,
        amount: Number(fields.amount),
        interest_bps: Number(fields.interest_bps),
        due_epoch: Number(fields.due_epoch),
        backed: fields.backed,
        backer: fields.backer,
        escrow_id: fields.escrow_id,
      };
    }).filter((loan) => loan !== null);

    console.log('Returning loans:', loans);
    return res.status(200).json({ success: true, loans });
  } catch (error) {
    console.error('Error in /list-loans:', error);
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});