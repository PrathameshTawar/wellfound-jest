import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../app';
import { createTestSalon, createTestService, createTestUser } from '../helpers/testData';
import { getAuthHeaders, getAuthenticatedUser } from '../helpers/authHelper';
import Booking from '../../models/Booking';
import { ISalon } from '../../models/Salon';
import { IService } from '../../models/Service';
import { IUser } from '../../models/User';

describe('E2E Complete User Journey - Register -> Login -> Browse Slots -> Book -> Conflict Check -> Cancel -> Restore Slot', () => {
  let salon: ISalon;
  let service: IService;
  let stylist: IUser;
  const targetDate = '2026-12-01';
  const targetSlotTime = '10:00';

  beforeEach(async () => {
    // Seed initial salon infrastructure
    salon = await createTestSalon({
      name: 'E2E Elite Studio',
      openTime: '09:00',
      closeTime: '18:00'
    });

    service = await createTestService(salon._id as mongoose.Types.ObjectId, {
      name: 'Signature Cut & Style',
      duration: 30,
      price: 45
    });

    stylist = await createTestUser({
      name: 'Master Stylist James',
      role: 'stylist'
    });
  });

  it('should successfully execute the full E2E lifecycle with data integrity & business rule validation', async () => {
    const customerPayload = {
      name: 'Samantha Carter',
      email: 'samantha.carter@stargate.io',
      password: 'GatePassword2026!'
    };

    // ==========================================
    // STEP 1: Register New Customer
    // ==========================================
    const registerRes = await request(app)
      .post('/api/register')
      .send(customerPayload);

    expect(registerRes.status).toBe(201);
    expect(registerRes.body).toHaveProperty('message', 'User registered successfully');

    // ==========================================
    // STEP 2: Login to Retrieve JWT Token
    // ==========================================
    const loginRes = await request(app)
      .post('/api/login')
      .send({
        email: customerPayload.email,
        password: customerPayload.password
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty('token');
    expect(loginRes.body).toHaveProperty('role', 'customer');
    expect(loginRes.body).toHaveProperty('userId');

    const customerToken = loginRes.body.token;
    const customerUserId = loginRes.body.userId;
    const authHeaders = getAuthHeaders(customerToken);

    // ==========================================
    // STEP 3: Browse Available Slots Before Booking
    // ==========================================
    const initialSlotsRes = await request(app)
      .get(`/api/salons/${salon._id}/available-slots`)
      .query({
        date: targetDate,
        serviceId: service._id.toString()
      });

    expect(initialSlotsRes.status).toBe(200);
    expect(initialSlotsRes.body).toHaveProperty('availableSlots');

    // Verify targetSlotTime (10:00) with stylist is present
    const isTargetSlotAvailableInitially = initialSlotsRes.body.availableSlots.some(
      (slot: any) => slot.time === targetSlotTime && slot.stylistId === stylist._id.toString()
    );
    expect(isTargetSlotAvailableInitially).toBe(true);

    // ==========================================
    // STEP 4: Customer Creates Booking
    // ==========================================
    const bookingPayload = {
      salonId: salon._id.toString(),
      stylistId: stylist._id.toString(),
      serviceId: service._id.toString(),
      slotTime: targetSlotTime,
      date: targetDate
    };

    const createBookingRes = await request(app)
      .post('/api/bookings')
      .set(authHeaders)
      .send(bookingPayload);

    expect(createBookingRes.status).toBe(201);
    expect(createBookingRes.body).toHaveProperty('message', 'Booking created successfully');
    expect(createBookingRes.body).toHaveProperty('booking');

    const createdBooking = createBookingRes.body.booking;
    expect(createdBooking.status).toBe('booked');
    expect(createdBooking.customerId).toBe(customerUserId);
    expect(createdBooking.startTime).toBe('10:00');
    expect(createdBooking.endTime).toBe('10:30'); // 10:00 + 30 mins

    const bookingId = createdBooking._id;

    // ==========================================
    // STEP 5: Verify Slot is Removed from Availability
    // ==========================================
    const postBookingSlotsRes = await request(app)
      .get(`/api/salons/${salon._id}/available-slots`)
      .query({
        date: targetDate,
        serviceId: service._id.toString()
      });

    expect(postBookingSlotsRes.status).toBe(200);

    const isTargetSlotAvailableAfterBooking = postBookingSlotsRes.body.availableSlots.some(
      (slot: any) => slot.time === targetSlotTime && slot.stylistId === stylist._id.toString()
    );
    expect(isTargetSlotAvailableAfterBooking).toBe(false);

    // ==========================================
    // STEP 6: Negative Test - Attempt Double Booking
    // ==========================================
    const doubleBookingRes = await request(app)
      .post('/api/bookings')
      .set(authHeaders)
      .send(bookingPayload);

    expect(doubleBookingRes.status).toBe(400);
    expect(doubleBookingRes.body).toHaveProperty('error', 'Time slot is no longer available');

    // ==========================================
    // STEP 7: Security Test - Unauthorized User Cannot Cancel
    // ==========================================
    const rogueCustomer = await getAuthenticatedUser('customer');
    const unauthorizedCancelRes = await request(app)
      .post(`/api/bookings/${bookingId}/cancel`)
      .set(rogueCustomer.headers)
      .send();

    expect(unauthorizedCancelRes.status).toBe(403);
    expect(unauthorizedCancelRes.body).toHaveProperty('error', 'Not authorized to cancel this booking');

    // ==========================================
    // STEP 8: Authorized Customer Cancels Booking
    // ==========================================
    const cancelRes = await request(app)
      .post(`/api/bookings/${bookingId}/cancel`)
      .set(authHeaders)
      .send();

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body).toHaveProperty('message', 'Booking cancelled successfully');

    // Verify DB state
    const dbBooking = await Booking.findById(bookingId);
    expect(dbBooking!.status).toBe('cancelled');

    // ==========================================
    // STEP 9: Verify Slot is Restored and Available
    // ==========================================
    const postCancelSlotsRes = await request(app)
      .get(`/api/salons/${salon._id}/available-slots`)
      .query({
        date: targetDate,
        serviceId: service._id.toString()
      });

    expect(postCancelSlotsRes.status).toBe(200);

    const isTargetSlotRestored = postCancelSlotsRes.body.availableSlots.some(
      (slot: any) => slot.time === targetSlotTime && slot.stylistId === stylist._id.toString()
    );
    expect(isTargetSlotRestored).toBe(true);

    // ==========================================
    // STEP 10: Negative Test - Idempotency (Already Cancelled)
    // ==========================================
    const reCancelRes = await request(app)
      .post(`/api/bookings/${bookingId}/cancel`)
      .set(authHeaders)
      .send();

    expect(reCancelRes.status).toBe(400);
    expect(reCancelRes.body).toHaveProperty('error', 'Booking is already cancelled');
  });
});
