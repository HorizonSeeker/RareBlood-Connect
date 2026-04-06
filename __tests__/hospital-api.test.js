// Tests for hospital-related API endpoints and enforcement

// Mock DB connect and models
jest.mock('@/db/connectDB.mjs', () => jest.fn());
jest.mock('next-auth/jwt', () => ({ getToken: jest.fn() }));
jest.mock('@/models/User.js', () => ({ findById: jest.fn(), findOne: jest.fn() }));
jest.mock('@/models/HospitalInventory.js', () => ({ findOne: jest.fn(), create: jest.fn() }));
jest.mock('@/models/HospitalInventoryLog.js', () => ({ create: jest.fn() }));
jest.mock('@/models/HospitalProfile.js', () => ({ findOne: jest.fn() }));
jest.mock('@/config/firebase.mjs', () => ({ messaging: () => ({ sendMulticast: jest.fn().mockResolvedValue({ successCount: 0, failureCount: 0 }) }) }));
jest.mock('@/lib/roleAuth.js', () => ({ ensureHospitalVerified: jest.fn(), authenticateRole: jest.fn() }));

import { POST as inventoryPOST } from '@/app/api/hospital-inventory/route';
import { POST as submitVerify } from '@/app/api/hospitals/verify/route';
import { POST as emergencyPOST } from '@/app/api/emergency/request/route';
import { getToken } from 'next-auth/jwt';
import User from '@/models/User.js';
import HospitalInventory from '@/models/HospitalInventory.js';
import HospitalInventoryLog from '@/models/HospitalInventoryLog.js';
import HospitalProfile from '@/models/HospitalProfile.js';
import { ensureHospitalVerified, authenticateRole } from '@/lib/roleAuth';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Hospital Inventory API - POST enforcement', () => {
  it('should block POST when hospital is not verified', async () => {
    getToken.mockResolvedValue({ userId: 'u1' });
    User.findById.mockResolvedValue({ _id: 'u1', role: 'hospital' });
    ensureHospitalVerified.mockResolvedValue({ success: false, error: 'Hospital not verified', status: 403, verification_status: 'pending' });

    const req = { json: async () => ({ blood_type: 'A+', units_available: 5, expiry_date: new Date(Date.now() + 1000000).toISOString() }) };
    const res = await inventoryPOST(req);
    expect(res.status).toBe(403);
  });

  it('should allow POST when hospital is verified', async () => {
    getToken.mockResolvedValue({ userId: 'u1' });
    User.findById.mockResolvedValue({ _id: 'u1', role: 'hospital' });
    ensureHospitalVerified.mockResolvedValue({ success: true, profile: { verification_status: 'verified' } });

    HospitalInventory.findOne.mockResolvedValue(null);
    HospitalInventory.create.mockResolvedValue({ _id: 'i1', blood_type: 'A+', units_available: 5 });
    HospitalInventoryLog.create.mockResolvedValue(true);

    const req = { json: async () => ({ blood_type: 'A+', units_available: 5, expiry_date: new Date(Date.now() + 1000000).toISOString() }) };
    const res = await inventoryPOST(req);
    expect(res.status).toBe(200);
  });
});

describe('Hospitals Verify API - submission flow', () => {
  it('should submit verification and update profile', async () => {
    authenticateRole.mockResolvedValue({ success: true, user: { _id: 'u1', email: 'h@h.com' }, userId: 'u1' });

    const mockProfile = { verification_documents: [], verification_status: 'not_requested', verification_requested_at: null, save: jest.fn(), _id: 'hp1' };
    HospitalProfile.findOne.mockResolvedValue(mockProfile);

    const req = { json: async () => ({ documents: [{ name: 'License', url: 'https://example.com/license.pdf' }] }) };
    const res = await submitVerify(req);

    expect(mockProfile.save).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it('should return 404 when profile not found', async () => {
    authenticateRole.mockResolvedValue({ success: true, user: { _id: 'u1', email: 'h@h.com' }, userId: 'u1' });
    HospitalProfile.findOne.mockResolvedValue(null);

    const req = { json: async () => ({ documents: [{ name: 'License', url: 'https://example.com/license.pdf' }] }) };
    const res = await submitVerify(req);
    expect(res.status).toBe(404);
  });
});

describe('Emergency request - hospital verification enforcement', () => {
  it('should block logged-in hospital from creating emergency request when not verified', async () => {
    getToken.mockResolvedValue({ email: 'h@h.com' });
    User.findOne.mockResolvedValue({ _id: 'u1', role: 'hospital' });
    ensureHospitalVerified.mockResolvedValue({ success: false, error: 'Hospital not verified', status: 403, verification_status: 'pending' });

    const req = { json: async () => ({ patientName: 'P', contactNumber: '0123', bloodType: 'O+', unitsRequired: 2, hospitalLocation: {}, emergencyDetails: 'test', selectedBloodBankId: 'bb1', isLoggedIn: true }) };
    const res = await emergencyPOST(req);
    expect(res.status).toBe(403);
  });
});
