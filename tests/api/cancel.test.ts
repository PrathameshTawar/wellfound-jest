import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../app';
import { createTestSalon, createTestService, createTestUser, createTestBooking } from '../helpers/testData';
import { getAuthenticatedUser, getAuthHeaders } from '../helpers/authHelper';
import Booking, { IBooking } from '../../models/Booking';
import { ISalon } from '../../models/Salon';
import { IService } from '../../models/Service';
import { IUser } from '../../models/User';

describe('Cancel Booking API - POST /api/bookings/:bookingId/cancel', () => {
  let salon: ISalon;
  let service: IService;
  let stylist: IUser;
  let customer1: IUser;
  let token1: string;
  let customer2: IUser;
  let token2: string;
  let admin: IUser;
  let adminToken: string;
  let booking: IBooking;

  beforeEach(async () => {
    salon = await createTestSalon();
    service = await createTestService(salon._id as mongoose.Types.ObjectId);
    stylist = await createTestUser({ role: 'stylist' });

    const auth1 = await getAuthenticatedUser('customer');
    customer1 = auth1.user;
    token1 = auth1.token;

    const auth2 = await getAuthenticatedUser('customer');
    customer2 = auth2.user;
    token2 = auth2.token;

    const adminAuth = await getAuthenticatedUser('admin');
    admin = adminAuth.user;
    adminToken = adminAuth.token;

    booking = await createTestBooking(
      salon._id as mongoose.Types.ObjectId,
      stylist._id as mongoose.Types.ObjectId,
      customer1._id as mongoose.Types.ObjectId,
      service._id as mongoose.Types.ObjectId,
      {
        startTime: '10:00',
        endTime: '10:30',
        status: 'booked'
      }
    );
  });

  describe('Positive Scenarios & Role-based Authorization', () => {
    it('should allow customer to successfully cancel their own booking with 200 status', async () => {
      const res = await request(app)
        .post(`/api/bookings/${booking._id}/cancel`)
        .set(getAuthHeaders(token1))
        .send();

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Booking cancelled successfully');

      // Verify status updated in database
      const updatedBooking = await Booking.findById(booking._id);
      expect(updatedBooking!.status).toBe('cancelled');
    });

    it('should allow an admin to cancel any customer booking with 200 status', async () => {
      const res = await request(app)
        .post(`/api/bookings/${booking._id}/cancel`)
        .set(getAuthHeaders(adminToken))
        .send();

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Booking cancelled successfully');

      const updatedBooking = await Booking.findById(booking._id);
      expect(updatedBooking!.status).toBe('cancelled');
    });
  });

  describe('Negative & Authorization Violation Scenarios', () => {
    it('should return 401 when cancelling without authentication', async () => {
      const res = await request(app)
        .post(`/api/bookings/${booking._id}/cancel`)
        .send();

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Authentication required');
    });

    it('should return 403 when another customer attempts to cancel a booking they do not own (IDOR)', async () => {
      // Customer 2 attempts to cancel Customer 1's booking
      const res = await request(app)
        .post(`/api/bookings/${booking._id}/cancel`)
        .set(getAuthHeaders(token2))
        .send();

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error', 'Not authorized to cancel this booking');

      // Ensure booking remains booked
      const intactBooking = await Booking.findById(booking._id);
      expect(intactBooking!.status).toBe('booked');
    });

    it('should return 403 when a stylist attempts to cancel a booking', async () => {
      const stylistAuth = await getAuthenticatedUser('stylist');

      const res = await request(app)
        .post(`/api/bookings/${booking._id}/cancel`)
        .set(getAuthHeaders(stylistAuth.token))
        .send();

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error', 'Not authorized to cancel this booking');
    });

    it('should return 404 when bookingId does not exist in database', async () => {
      const nonExistentBookingId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .post(`/api/bookings/${nonExistentBookingId}/cancel`)
        .set(getAuthHeaders(token1))
        .send();

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Booking not found');
    });

    it('should return 400 when attempting to cancel an already cancelled booking', async () => {
      // First cancellation succeeds
      await request(app)
        .post(`/api/bookings/${booking._id}/cancel`)
        .set(getAuthHeaders(token1))
        .send();

      // Second cancellation on same booking must be rejected
      const secondRes = await request(app)
        .post(`/api/bookings/${booking._id}/cancel`)
        .set(getAuthHeaders(token1))
        .send();

      expect(secondRes.status).toBe(400);
      expect(secondRes.body).toHaveProperty('error', 'Booking is already cancelled');
    });

    it('should return 500 when bookingId is malformed', async () => {
      const res = await request(app)
        .post('/api/bookings/malformed-id/cancel')
        .set(getAuthHeaders(token1))
        .send();

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error', 'Server error');
    });
  });
});
