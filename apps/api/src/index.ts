import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'ASSURAI API',
    timestamp: new Date()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 ASSURAI API running on http://localhost:${PORT}`);
});
