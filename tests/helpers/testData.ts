import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User, { IUser } from '../../models/User';
import Salon, { ISalon } from '../../models/Salon';
import Service, { IService } from '../../models/Service';
import Booking, { IBooking } from '../../models/Booking';

/**
 * Creates and saves a test user in the database
 */
export const createTestUser = async (overrides: Partial<IUser> = {}): Promise<IUser> => {
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const passwordHash = await bcrypt.hash(overrides.password || 'password123', 10);
  
  const user = new User({
    name: overrides.name || `Test User ${randomSuffix}`,
    email: overrides.email || `test-${randomSuffix}@example.com`,
    password: passwordHash,
    role: overrides.role || 'customer'
  });

  return await user.save();
};

/**
 * Creates and saves a test salon
 */
export const createTestSalon = async (overrides: Partial<ISalon> = {}): Promise<ISalon> => {
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const salon = new Salon({
    name: overrides.name || `Glamour Studio ${randomSuffix}`,
    location: overrides.location || '456 Fashion Blvd, Suite 100',
    openTime: overrides.openTime || '09:00',
    closeTime: overrides.closeTime || '18:00'
  });

  return await salon.save();
};

/**
 * Creates and saves a test service linked to a salon
 */
export const createTestService = async (
  salonId: mongoose.Types.ObjectId | string,
  overrides: Partial<IService> = {}
): Promise<IService> => {
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const service = new Service({
    name: overrides.name || `Classic Haircut ${randomSuffix}`,
    duration: overrides.duration !== undefined ? overrides.duration : 30, // in minutes
    price: overrides.price !== undefined ? overrides.price : 35,
    salonId: typeof salonId === 'string' ? new mongoose.Types.ObjectId(salonId) : salonId
  });

  return await service.save();
};

/**
 * Creates and saves a test booking
 */
export const createTestBooking = async (
  salonId: mongoose.Types.ObjectId | string,
  stylistId: mongoose.Types.ObjectId | string,
  customerId: mongoose.Types.ObjectId | string,
  serviceId: mongoose.Types.ObjectId | string,
  overrides: Partial<IBooking> = {}
): Promise<IBooking> => {
  const booking = new Booking({
    salonId: typeof salonId === 'string' ? new mongoose.Types.ObjectId(salonId) : salonId,
    stylistId: typeof stylistId === 'string' ? new mongoose.Types.ObjectId(stylistId) : stylistId,
    customerId: typeof customerId === 'string' ? new mongoose.Types.ObjectId(customerId) : customerId,
    serviceId: typeof serviceId === 'string' ? new mongoose.Types.ObjectId(serviceId) : serviceId,
    date: overrides.date || '2026-11-01',
    startTime: overrides.startTime || '10:00',
    endTime: overrides.endTime || '10:30',
    status: overrides.status || 'booked'
  });

  return await booking.save();
};
