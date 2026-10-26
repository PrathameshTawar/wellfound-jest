import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../app';
import { createTestSalon, createTestService, createTestUser, createTestBooking } from '../helpers/testData';
import { ISalon } from '../../models/Salon';
import { IService } from '../../models/Service';
import { IUser } from '../../models/User';

describe('Salon API - GET /api/salons/:salonId/available-slots', () => {
  let salon: ISalon;
  let service30Min: IService;
  let service60Min: IService;
  let stylist1: IUser;
  let stylist2: IUser;
  const testDate = '2026-11-15';

  beforeEach(async () => {
    // Seed salon (09:00 - 18:00)
    salon = await createTestSalon({
      openTime: '09:00',
      closeTime: '18:00'
    });

    // Seed services
    service30Min = await createTestService(salon._id as mongoose.Types.ObjectId, {
      name: 'Express Haircut',
      duration: 30
    });

    service60Min = await createTestService(salon._id as mongoose.Types.ObjectId, {
      name: 'Deluxe Facial',
      duration: 60
    });

    // Seed stylists
    stylist1 = await createTestUser({
      name: 'Marco Stylist',
      role: 'stylist'
    });

    stylist2 = await createTestUser({
      name: 'Sophia Stylist',
      role: 'stylist'
    });
  });

  describe('Positive Scenarios', () => {
    it('should return 200 and all available 30-minute slots when no bookings exist', async () => {
      const res = await request(app)
        .get(`/api/salons/${salon._id}/available-slots`)
        .query({
          date: testDate,
          serviceId: service30Min._id.toString()
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('date', testDate);
      expect(res.body).toHaveProperty('service', service30Min.name);
      expect(res.body).toHaveProperty('duration', 30);
      expect(Array.isArray(res.body.availableSlots)).toBe(true);
      expect(res.body.availableSlots.length).toBeGreaterThan(0);

      // Verify slot object structure
      const firstSlot = res.body.availableSlots[0];
      expect(firstSlot).toHaveProperty('time');
      expect(firstSlot).toHaveProperty('stylistId');
      expect(firstSlot).toHaveProperty('stylistName');

      // 09:00 slot should be present for both stylists
      const slotsAt0900 = res.body.availableSlots.filter((s: any) => s.time === '09:00');
      expect(slotsAt0900.length).toBe(2);
      expect(slotsAt0900.some((s: any) => s.stylistId === stylist1._id.toString())).toBe(true);
      expect(slotsAt0900.some((s: any) => s.stylistId === stylist2._id.toString())).toBe(true);

      // Last 30-min slot before 18:00 should be 17:30
      const lastSlot = res.body.availableSlots[res.body.availableSlots.length - 1];
      expect(lastSlot.time).toBe('17:30');
    });

    it('should correctly calculate available slots for longer 60-minute duration service', async () => {
      const res = await request(app)
        .get(`/api/salons/${salon._id}/available-slots`)
        .query({
          date: testDate,
          serviceId: service60Min._id.toString()
        });

      expect(res.status).toBe(200);
      expect(res.body.duration).toBe(60);

      // For a 60 min service closing at 18:00, the last viable slot is 17:00 (17:00 + 60m = 18:00)
      const slotTimes = res.body.availableSlots.map((s: any) => s.time);
      expect(slotTimes).toContain('17:00');
      expect(slotTimes).not.toContain('17:30');
    });

    it('should exclude booked stylist from slot while keeping other available stylists in the same slot', async () => {
      // Customer books Stylist 1 at 10:00 for 30 mins
      const customer = await createTestUser({ role: 'customer' });
      await createTestBooking(
        salon._id as mongoose.Types.ObjectId,
        stylist1._id as mongoose.Types.ObjectId,
        customer._id as mongoose.Types.ObjectId,
        service30Min._id as mongoose.Types.ObjectId,
        {
          date: testDate,
          startTime: '10:00',
          endTime: '10:30',
          status: 'booked'
        }
      );

      const res = await request(app)
        .get(`/api/salons/${salon._id}/available-slots`)
        .query({
          date: testDate,
          serviceId: service30Min._id.toString()
        });

      expect(res.status).toBe(200);

      // Find all slots at 10:00
      const slotsAt1000 = res.body.availableSlots.filter((s: any) => s.time === '10:00');

      // Only Stylist 2 should be available at 10:00; Stylist 1 must be excluded
      expect(slotsAt1000.length).toBe(1);
      expect(slotsAt1000[0].stylistId).toBe(stylist2._id.toString());
      expect(slotsAt1000.some((s: any) => s.stylistId === stylist1._id.toString())).toBe(false);
    });

    it('should make slot available again if a previous booking was cancelled', async () => {
      const customer = await createTestUser({ role: 'customer' });
      // Create a cancelled booking
      await createTestBooking(
        salon._id as mongoose.Types.ObjectId,
        stylist1._id as mongoose.Types.ObjectId,
        customer._id as mongoose.Types.ObjectId,
        service30Min._id as mongoose.Types.ObjectId,
        {
          date: testDate,
          startTime: '11:00',
          endTime: '11:30',
          status: 'cancelled' // cancelled status should not block slot
        }
      );

      const res = await request(app)
        .get(`/api/salons/${salon._id}/available-slots`)
        .query({
          date: testDate,
          serviceId: service30Min._id.toString()
        });

      expect(res.status).toBe(200);

      // Both stylists should be available at 11:00 because status is cancelled
      const slotsAt1100 = res.body.availableSlots.filter((s: any) => s.time === '11:00');
      expect(slotsAt1100.length).toBe(2);
    });
  });

  describe('Negative & Validation Scenarios', () => {
    it('should return 400 when date query parameter is missing', async () => {
      const res = await request(app)
        .get(`/api/salons/${salon._id}/available-slots`)
        .query({ serviceId: service30Min._id.toString() });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'date and serviceId are required');
    });

    it('should return 400 when serviceId query parameter is missing', async () => {
      const res = await request(app)
        .get(`/api/salons/${salon._id}/available-slots`)
        .query({ date: testDate });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'date and serviceId are required');
    });

    it('should return 400 when both date and serviceId are missing', async () => {
      const res = await request(app)
        .get(`/api/salons/${salon._id}/available-slots`);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'date and serviceId are required');
    });

    it('should return 404 when salonId does not exist', async () => {
      const nonExistentSalonId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .get(`/api/salons/${nonExistentSalonId}/available-slots`)
        .query({
          date: testDate,
          serviceId: service30Min._id.toString()
        });

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Salon or Service not found');
    });

    it('should return 404 when serviceId does not exist', async () => {
      const nonExistentServiceId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .get(`/api/salons/${salon._id}/available-slots`)
        .query({
          date: testDate,
          serviceId: nonExistentServiceId.toString()
        });

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Salon or Service not found');
    });

    it('should return 500 when salonId has an invalid ObjectId format', async () => {
      const res = await request(app)
        .get('/api/salons/invalid-id-format/available-slots')
        .query({
          date: testDate,
          serviceId: service30Min._id.toString()
        });

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error', 'Server error');
    });
  });
});
