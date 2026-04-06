import { POST } from '@/app/api/users/change-password/route';
import { getToken } from 'next-auth/jwt';
import User from '@/models/User';

jest.mock('@/db/connectDB', () => jest.fn());
jest.mock('@/models/User');
jest.mock('next-auth/jwt');

import bcrypt from 'bcrypt';
jest.mock('bcrypt');

describe('Change password API', () => {
  afterEach(() => jest.clearAllMocks());

  it('should return 401 when unauthenticated', async () => {
    getToken.mockResolvedValue(null);
    const req = { json: async () => ({}) };
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('should return 400 when fields missing', async () => {
    getToken.mockResolvedValue({ userId: 'u1' });
    const req = { json: async () => ({}) };
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('should return 403 when current password wrong', async () => {
    getToken.mockResolvedValue({ userId: 'u2' });
    const req = { json: async () => ({ currentPassword: 'x', newPassword: 'newpassword' }) };
    const mockUser = { password: 'hashed' };
    User.findById.mockResolvedValue(mockUser);
    bcrypt.compare.mockResolvedValue(false);
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('should change password when current correct', async () => {
    getToken.mockResolvedValue({ userId: 'u3' });
    const req = { json: async () => ({ currentPassword: 'oldpass', newPassword: 'newpassword' }) };
    const mockUser = { password: 'hashed', save: jest.fn() };
    User.findById.mockResolvedValue(mockUser);
    bcrypt.compare.mockResolvedValue(true);
    bcrypt.genSalt.mockResolvedValue('salt');
    bcrypt.hash.mockResolvedValue('newhashed');

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockUser.password).toBe('newhashed');
    expect(mockUser.save).toHaveBeenCalled();
  });
});