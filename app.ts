import express, { Express } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/authRoutes';
import salonRoutes from './routes/salonRoutes';
import bookingRoutes from './routes/bookingRoutes';

// Load environment variables
dotenv.config();

const app: Express = express();

// Middleware
app.use(express.json());
app.use(cors());

// Health Check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Salon Backend is running!' });
});

// Routes
app.use('/api', authRoutes);
app.use('/api', salonRoutes);
app.use('/api', bookingRoutes);

export default app;
