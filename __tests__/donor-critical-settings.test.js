import { GET, PUT } from '@/app/api/donors/critical-settings/route';
import { getToken } from 'next-auth/jwt';
import Donor from '@/models/Doner';

jest.mock('@/db/connectDB', () => jest.fn());
jest.mock('@/models/Doner');
jest.mock('next-auth/jwt');

describe('Critical settings API', () => {
  afterEach(() => jest.clearAllMocks());

  it('GET should return 401 if not authenticated', async () => {
    getToken.mockResolvedValue(null);
    const req = {};
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('GET should return 404 if donor not found', async () => {
    getToken.mockResolvedValue({ userId: 'u1', email: 'a@b.com' });
    Donor.findOne.mockResolvedValue(null);
    const req = {};
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it('GET should return settings when found', async () => {
    getToken.mockResolvedValue({ userId: 'u2', email: 'x@y.com' });
    Donor.findOne.mockResolvedValue({ is_critical_ready: true, current_location: { type: 'Point', coordinates: [100, 10] } });
    const req = {};
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.is_critical_ready).toBe(true);
    expect(body.current_location.coordinates[0]).toBe(100);
  });

  it('PUT should return 401 if not authenticated', async () => {
    getToken.mockResolvedValue(null);
    const req = { json: async () => ({ is_critical_ready: true }) };
    const res = await PUT(req);
    expect(res.status).toBe(401);
  });

  it('PUT should return 400 if is_critical_ready is missing or invalid', async () => {
    getToken.mockResolvedValue({ userId: 'u3', email: 'z@z.com' });
    const req = { json: async () => ({}) };
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it('PUT should update and return updated settings', async () => {
    getToken.mockResolvedValue({ userId: 'u4', email: 'u@u.com' });
    const updated = { is_critical_ready: true, current_location: { type: 'Point', coordinates: [120, 15] } };
    Donor.findOneAndUpdate.mockResolvedValue(updated);
    const req = { json: async () => ({ is_critical_ready: true, current_location: { coordinates: [120, 15] } }) };
    const res = await PUT(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.is_critical_ready).toBe(true);
    expect(body.current_location.coordinates[1]).toBe(15);
  });
});