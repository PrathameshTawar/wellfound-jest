import jwt, { SignOptions } from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createTestUser } from './testData';
import { IUser } from '../../models/User';

const getJwtSecret = (): string => process.env.JWT_SECRET || 'supersecretjwtkey_12345';

/**
 * Generates a signed JWT token for a given user ID and role
 */
export const generateToken = (
  userId: mongoose.Types.ObjectId | string,
  role: 'customer' | 'stylist' | 'admin' = 'customer',
  expiresIn: any = '1d'
): string => {
  const options: SignOptions = {
    expiresIn
  };

  return jwt.sign(
    { userId: userId.toString(), role },
    getJwtSecret(),
    options
  );
};

/**
 * Returns formatted Authorization header object
 */
export const getAuthHeaders = (token: string): { Authorization: string } => {
  return {
    Authorization: `Bearer ${token}`
  };
};

/**
 * Convenience helper that seeds a user and returns their instance along with valid JWT and headers
 */
export const getAuthenticatedUser = async (
  role: 'customer' | 'stylist' | 'admin' = 'customer',
  overrides: Partial<IUser> = {}
): Promise<{ user: IUser; token: string; headers: { Authorization: string } }> => {
  const user = await createTestUser({ role, ...overrides });
  const token = generateToken(user._id as mongoose.Types.ObjectId, role);
  return {
    user,
    token,
    headers: getAuthHeaders(token)
  };
};
