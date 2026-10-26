import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../app';
import { createTestSalon, createTestService, createTestUser } from '../helpers/testData';
import { getAuthenticatedUser, getAuthHeaders } from '../helpers/authHelper';
import Booking from '../../models/Booking';
import { ISalon } from '../../models/Salon';
import { IService } from '../../models/Service';
import { IUser } from '../../models/User';

describe('Booking API - POST /api/bookings', () => {
  let salon: ISalon;
  let service30Min: IService;
  let service60Min: IService;
  let stylist1: IUser;
  let stylist2: IUser;
  let customer1: IUser;
  let token1: string;
  let customer2: IUser;
  let token2: string;
  const testDate = '2026-11-20';

  beforeEach(async () => {
    salon = await createTestSalon();
    service30Min = await createTestService(salon._id as mongoose.Types.ObjectId, { duration: 30 });
    service60Min = await createTestService(salon._id as mongoose.Types.ObjectId, { duration: 60 });
    stylist1 = await createTestUser({ role: 'stylist' });
    stylist2 = await createTestUser({ role: 'stylist' });

    const auth1 = await getAuthenticatedUser('customer');
    customer1 = auth1.user;
    token1 = auth1.token;

    const auth2 = await getAuthenticatedUser('customer');
    customer2 = auth2.user;
    token2 = auth2.token;
  });

  describe('Positive Scenarios', () => {
    it('should successfully create a new booking with 201 status and correct calculated endTime', async () => {
      const payload = {
        salonId: salon._id.toString(),
        stylistId: stylist1._id.toString(),
        serviceId: service30Min._id.toString(),
        slotTime: '10:00',
        date: testDate
      };

      const res = await request(app)
        .post('/api/bookings')
        .set(getAuthHeaders(token1))
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('message', 'Booking created successfully');
      expect(res.body).toHaveProperty('booking');

      const booking = res.body.booking;
      expect(booking.salonId).toBe(salon._id.toString());
      expect(booking.stylistId).toBe(stylist1._id.toString());
      expect(booking.customerId).toBe(customer1._id.toString());
      expect(booking.serviceId).toBe(service30Min._id.toString());
      expect(booking.date).toBe(testDate);
      expect(booking.startTime).toBe('10:00');
      // 10:00 + 30m = 10:30
      expect(booking.endTime).toBe('10:30');
      expect(booking.status).toBe('booked');

      // Verify in DB
      const dbBooking = await Booking.findById(booking._id);
      expect(dbBooking).not.toBeNull();
      expect(dbBooking!.status).toBe('booked');
    });

    it('should allow two different stylists to be booked at the exact same time slot', async () => {
      // Customer 1 books Stylist 1 at 14:00
      const res1 = await request(app)
        .post('/api/bookings')
        .set(getAuthHeaders(token1))
        .send({
          salonId: salon._id.toString(),
          stylistId: stylist1._id.toString(),
          serviceId: service30Min._id.toString(),
          slotTime: '14:00',
          date: testDate
        });
      expect(res1.status).toBe(201);

      // Customer 2 books Stylist 2 at the same 14:00 slot
      const res2 = await request(app)
        .post('/api/bookings')
        .set(getAuthHeaders(token2))
        .send({
          salonId: salon._id.toString(),
          stylistId: stylist2._id.toString(),
          serviceId: service30Min._id.toString(),
          slotTime: '14:00',
          date: testDate
        });
      expect(res2.status).toBe(201);
    });
  });

  describe('Negative & Conflict Prevention Scenarios', () => {
    it('should return 401 when booking without authentication token', async () => {
      const res = await request(app)
        .post('/api/bookings')
        .send({
          salonId: salon._id.toString(),
          stylistId: stylist1._id.toString(),
          serviceId: service30Min._id.toString(),
          slotTime: '10:00',
          date: testDate
        });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Authentication required');
    });

    it('should return 400 when date is missing in request body', async () => {
      const res = await request(app)
        .post('/api/bookings')
        .set(getAuthHeaders(token1))
        .send({
          salonId: salon._id.toString(),
          stylistId: stylist1._id.toString(),
          serviceId: service30Min._id.toString(),
          slotTime: '10:00'
          // date omitted
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'date is required');
    });

    it('should return 404 when serviceId does not exist', async () => {
      const nonExistentServiceId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .post('/api/bookings')
        .set(getAuthHeaders(token1))
        .send({
          salonId: salon._id.toString(),
          stylistId: stylist1._id.toString(),
          serviceId: nonExistentServiceId.toString(),
          slotTime: '10:00',
          date: testDate
        });

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Service not found');
    });

    it('should prevent double booking when the exact same slot is booked for the same stylist', async () => {
      // First booking succeeds
      const firstRes = await request(app)
        .post('/api/bookings')
        .set(getAuthHeaders(token1))
        .send({
          salonId: salon._id.toString(),
          stylistId: stylist1._id.toString(),
          serviceId: service30Min._id.toString(),
          slotTime: '11:00',
          date: testDate
        });
      expect(firstRes.status).toBe(201);

      // Second booking for identical slot must fail
      const secondRes = await request(app)
        .post('/api/bookings')
        .set(getAuthHeaders(token2))
        .send({
          salonId: salon._id.toString(),
          stylistId: stylist1._id.toString(),
          serviceId: service30Min._id.toString(),
          slotTime: '11:00',
          date: testDate
        });

      expect(secondRes.status).toBe(400);
      expect(secondRes.body).toHaveProperty('error', 'Time slot is no longer available');
    });

    it('should prevent booking when a longer service overlaps an existing booking', async () => {
      // Stylist 1 has a 30m booking at 10:30 (10:30 - 11:00)
      const initialRes = await request(app)
        .post('/api/bookings')
        .set(getAuthHeaders(token1))
        .send({
          salonId: salon._id.toString(),
          stylistId: stylist1._id.toString(),
          serviceId: service30Min._id.toString(),
          slotTime: '10:30',
          date: testDate
        });
      expect(initialRes.status).toBe(201);

      // Customer 2 attempts a 60m booking at 10:00 (10:00 - 11:00), which overlaps with 10:30
      const overlapRes = await request(app)
        .post('/api/bookings')
        .set(getAuthHeaders(token2))
        .send({
          salonId: salon._id.toString(),
          stylistId: stylist1._id.toString(),
          serviceId: service60Min._id.toString(),
          slotTime: '10:00',
          date: testDate
        });

      expect(overlapRes.status).toBe(400);
      expect(overlapRes.body).toHaveProperty('error', 'Time slot is no longer available');
    });

    it('should prevent booking when a shorter service falls inside a longer booking duration', async () => {
      // Stylist 1 has a 60m booking at 14:00 (14:00 - 15:00)
      const initialRes = await request(app)
        .post('/api/bookings')
        .set(getAuthHeaders(token1))
        .send({
          salonId: salon._id.toString(),
          stylistId: stylist1._id.toString(),
          serviceId: service60Min._id.toString(),
          slotTime: '14:00',
          date: testDate
        });
      expect(initialRes.status).toBe(201);

      // Customer 2 attempts a 30m booking at 14:30 (14:30 - 15:00)
      const overlapRes = await request(app)
        .post('/api/bookings')
        .set(getAuthHeaders(token2))
        .send({
          salonId: salon._id.toString(),
          stylistId: stylist1._id.toString(),
          serviceId: service30Min._id.toString(),
          slotTime: '14:30',
          date: testDate
        });

      expect(overlapRes.status).toBe(400);
      expect(overlapRes.body).toHaveProperty('error', 'Time slot is no longer available');
    });
  });
});
