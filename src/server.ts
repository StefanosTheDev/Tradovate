import express, { Request, Response } from 'express';
import { Run1MinChart } from './index';
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Get 1 Min Chart
app.get('/1Min', (req: Request, res: Response) => {
  Run1MinChart();
  res.send('Hello from TypeScript Express Server!');
});

app.get('/22EMA', (req: Request, res: Response) => {
  res.send('/Hello From 22 EMA');
});
// Start server
app.listen(port, () => {
  console.log(`🚀 Server is running on http://localhost:${port}`);
});
