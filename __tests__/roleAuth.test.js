import { ensureHospitalVerified } from '@/lib/roleAuth';

// Mock DB connect and HospitalProfile model
jest.mock('@/db/connectDB.mjs', () => jest.fn());
jest.mock('@/models/HospitalProfile.js', () => ({ findOne: jest.fn() }));

import HospitalProfile from '@/models/HospitalProfile.js';

describe('roleAuth.ensureHospitalVerified', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return success when hospital profile is verified', async () => {
    const mockProfile = { verification_status: 'verified', _id: 'hp1' };
    HospitalProfile.findOne.mockResolvedValue(mockProfile);

    const res = await ensureHospitalVerified('u1');
    expect(res.success).toBe(true);
    expect(res.profile).toBe(mockProfile);
  });

  it('should return 404 when profile not found', async () => {
    HospitalProfile.findOne.mockResolvedValue(null);
    const res = await ensureHospitalVerified('u1');
    expect(res.success).toBe(false);
    expect(res.status).toBe(404);
    expect(res.error).toMatch(/not found/i);
  });

  it('should return 403 when profile is pending/not verified', async () => {
    const mockProfile = { verification_status: 'pending', verification_notes: 'Need more docs' };
    HospitalProfile.findOne.mockResolvedValue(mockProfile);
    const res = await ensureHospitalVerified('u1');
    expect(res.success).toBe(false);
    expect(res.status).toBe(403);
    expect(res.verification_status).toBe('pending');
    expect(res.notes).toBe('Need more docs');
  });
});
