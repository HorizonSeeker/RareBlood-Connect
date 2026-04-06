import { GET, PUT } from '@/app/api/donors/profile/route';
import { getToken } from 'next-auth/jwt';
import Donor from '@/models/Doner';
import User from '@/models/User';

jest.mock('@/db/connectDB', () => jest.fn());
jest.mock('@/models/Doner');
jest.mock('@/models/User');
jest.mock('next-auth/jwt');

describe('Donor profile API', () => {
  afterEach(() => jest.clearAllMocks());

  it('GET should return 401 if not authenticated', async () => {
    getToken.mockResolvedValue(null);
    const req = {};
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('GET should return 404 if donor not found', async () => {
    getToken.mockResolvedValue({ userId: 'user1', email: 'a@b.com' });
    Donor.findOne.mockResolvedValue(null);
    const req = {};
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it('GET should return donor profile when found', async () => {
    getToken.mockResolvedValue({ userId: 'user2', email: 'x@y.com' });
    Donor.findOne.mockResolvedValue({ mobile_number: '0123', emergency_contact_mobile: '0999', blood_type: 'O+' });
    User.findById.mockResolvedValue({ name: 'Alice', email: 'x@y.com' });
    const req = {};
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('Alice');
    expect(body.mobile_number).toBe('0123');
  });

  it('PUT should return 401 if not authenticated', async () => {
    getToken.mockResolvedValue(null);
    const req = { json: async () => ({ name: 'Bob' }) };
    const res = await PUT(req);
    expect(res.status).toBe(401);
  });

  it('PUT should return 400 if no valid fields', async () => {
    getToken.mockResolvedValue({ userId: 'user3', email: 'z@z.com' });
    const req = { json: async () => ({ foo: 'bar' }) };
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it('PUT should update and return updated donor and user', async () => {
    getToken.mockResolvedValue({ userId: 'user4', email: 'u@u.com' });
    const updatedDonor = { mobile_number: '0777', emergency_contact_mobile: '0666' };
    Donor.findOneAndUpdate.mockResolvedValue(updatedDonor);
    User.findByIdAndUpdate.mockResolvedValue({ name: 'Bobby', email: 'u@u.com' });
    const req = { json: async () => ({ name: 'Bobby', mobile_number: '0777' }) };
    const res = await PUT(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.donor.mobile_number).toBe('0777');
    expect(body.user.name).toBe('Bobby');
  });
});