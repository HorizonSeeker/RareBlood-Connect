import { POST } from '@/app/api/auth/update-session/route';
import { getServerSession } from 'next-auth/next';
import User from '@/models/User';

jest.mock('@/db/connectDB', () => jest.fn());
jest.mock('@/models/User');
jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }));

describe('Update session API', () => {
  afterEach(() => jest.clearAllMocks());

  it('should return 401 if no session', async () => {
    getServerSession.mockResolvedValue(null);
    const res = await POST({});
    expect(res.status).toBe(401);
  });

  it('should return 404 if user not found', async () => {
    getServerSession.mockResolvedValue({ user: { email: 'noone@example.com' } });
    User.findOne.mockResolvedValue(null);
    const res = await POST({});
    expect(res.status).toBe(404);
  });

  it('should return needsUpdate and user payload on success', async () => {
    getServerSession.mockResolvedValue({ user: { email: 'a@b.com' } });
    User.findOne.mockResolvedValue({ _id: 'abc123', email: 'a@b.com', name: 'Tester', role: 'user', isRegistrationComplete: true });
    const res = await POST({});
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.needsUpdate).toBe(true);
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe('a@b.com');
  });
});
