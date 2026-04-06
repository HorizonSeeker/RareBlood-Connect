import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/authOptions.js';
import UserDashboard from '@/components/UserDashboard';

export default async function DashboardPage() {
  // Server-side dispatcher: redirect based on role
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  const role = session?.user?.role || null;

  switch (role) {
    case 'admin':
      redirect('/dashboard/admin');
      break;
    case 'bloodbank_admin':
      redirect('/dashboard/bloodbank');
      break;
    case 'hospital':
      redirect('/dashboard/hospital');
      break;
    default:
      // Render regular user dashboard (client component)
      return <UserDashboard />;
  }

  // Fallback: if redirect didn't happen for some reason, render user dashboard
  return <UserDashboard />;
}
