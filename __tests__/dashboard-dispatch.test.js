// Mock dependencies before importing the dashboard module
jest.mock('@/app/api/auth/authOptions.js', () => ({ authOptions: {} }));
jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }));
jest.mock('next/navigation', () => ({ redirect: jest.fn() }));

import DashboardPage from '@/app/dashboard/page';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';

describe('Dashboard dispatcher', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should redirect admin to /dashboard/admin', async () => {
    getServerSession.mockResolvedValue({ user: { role: 'admin' } });
    await DashboardPage();
    expect(redirect).toHaveBeenCalledWith('/dashboard/admin');
  });

  it('should redirect bloodbank_admin to /dashboard/bloodbank', async () => {
    getServerSession.mockResolvedValue({ user: { role: 'bloodbank_admin' } });
    await DashboardPage();
    expect(redirect).toHaveBeenCalledWith('/dashboard/bloodbank');
  });

  it('should not redirect regular user (renders client component) ', async () => {
    getServerSession.mockResolvedValue({ user: { role: 'user' } });
    await DashboardPage();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('should redirect unauthenticated to /login', async () => {
    getServerSession.mockResolvedValue(null);
    await DashboardPage();
    expect(redirect).toHaveBeenCalledWith('/login');
  });
});
