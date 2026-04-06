"use client"
import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Heart, 
  Calendar, 
  Activity, 
  Award, 
  Bell, 
  Settings, 
  Users, 
  User,
  Clock, 
  Phone, 
  Mail, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Navigation,
  MapPin,
  RefreshCw
} from 'lucide-react';
import { getToken } from 'firebase/messaging';
import { messaging } from '@/lib/firebaseClient';
import ProtectedRoute from '@/components/ProtectedRoute';
import dynamic from 'next/dynamic';
import { toast } from 'react-toastify';
const ChangePasswordModal = dynamic(() => import('@/components/ChangePasswordModal'), { ssr: false });

// Lazy-load Map to avoid SSR issues
const MapWithNoSSR = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <p className="text-center p-4">Loading map...</p>
});

const DonorDashboard = () => {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState('overview');
  const [donationDrives, setDonationDrives] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [acceptedRequests, setAcceptedRequests] = useState([]);
  const [rejectedRequests, setRejectedRequests] = useState([]);
  const [criticalSettings, setCriticalSettings] = useState({
    is_critical_ready: false,
    current_location: { coordinates: [0, 0] }
  });
  const [loading, setLoading] = useState(true);
  const [bloodCenters, setBloodCenters] = useState([]);
  const [mapLoading, setMapLoading] = useState(true);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [donorStats, setDonorStats] = useState({
    totalDonations: 0,
    livesSaved: 0,
    acceptedRequests: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [donationAppointments, setDonationAppointments] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedBloodBank, setSelectedBloodBank] = useState(null);
  const [showBloodBankModal, setShowBloodBankModal] = useState(false);
  const router = useRouter();


  // Fetch data on component mount
  useEffect(() => {
    if (session?.user) {
      // Fetch verification status
      const fetchVerificationStatus = async () => {
        try {
          const response = await fetch('/api/donors/verification-status');
          if (response.ok) {
            const data = await response.json();
            setVerificationStatus(data.verification_status);
          }
        } catch (error) {
          console.error('Error fetching verification status:', error);
        }
      };
      
      fetchVerificationStatus();
      fetchInitialData();
    }
  }, [session?.user]);

  // Listen for request response events from Pusher and refresh lists/stats
  useEffect(() => {
    const handleRequestResponse = (e) => {
      const data = e?.detail;
      // Refresh incoming requests and stats to reflect changes in real-time
      fetchIncomingRequests();
      fetchDonorStats();

      // Optionally show a small message when a request is accepted
      if (data?.status === 'accepted') {
        setShowSuccessMessage(true);
        setSuccessMessage('🎉 You accepted a request — thank you!');
        setTimeout(() => setShowSuccessMessage(false), 10000);
      }
    };

    window.addEventListener('request:response', handleRequestResponse);
    return () => window.removeEventListener('request:response', handleRequestResponse);
  }, []);

  // Fetch blood centers and hospitals for map display
  useEffect(() => {
    async function fetchBloodCenters() {
      try {
        const res = await fetch('/api/bloodbanks');
        if (!res.ok) {
          console.error('Failed to fetch blood centers', res.status);
          setMapLoading(false);
          return;
        }
        const data = await res.json();
        setBloodCenters(data.bloodbanks || []);
      } catch (err) {
        console.error('Error fetching blood centers for map:', err);
      } finally {
        setMapLoading(false);
      }
    }

    fetchBloodCenters();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchDonationDrives(),
        fetchCriticalSettings(),
        fetchIncomingRequests(),
        fetchDonorStats(),
        fetchDonationAppointments()
      ]);
    } catch (error) {
      console.error('Error fetching initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDonationDrives = async () => {
    try {
      const response = await fetch('/api/drives?future_only=true');
      if (response.ok) {
        const data = await response.json();
        setDonationDrives(data.drives || []);
      }
    } catch (error) {
      console.error('Error fetching donation drives:', error);
    }
  };

  const fetchCriticalSettings = async () => {
    try {
      const response = await fetch('/api/donors/critical-settings');
      
      if (response.ok) {
        const data = await response.json();
        setCriticalSettings({
          is_critical_ready: data.is_critical_ready || false,
          current_location: data.current_location || { coordinates: [0, 0] }
        });
      } else {
        console.error('Failed to fetch critical settings:', response.status, response.statusText);
        // Set default values if API fails
        setCriticalSettings({
          is_critical_ready: false,
          current_location: { coordinates: [0, 0] }
        });
      }
    } catch (error) {
      console.error('Error fetching critical settings:', error);
      // Set default values if API fails
      setCriticalSettings({
        is_critical_ready: false,
        current_location: { coordinates: [0, 0] }
      });
    }
  };

  const fetchIncomingRequests = async () => {
    try {
      const response = await fetch('/api/donors/incoming-requests');
      if (response.ok) {
        const data = await response.json();
        setIncomingRequests(data.pendingRequests || []);
        setAcceptedRequests(data.acceptedRequests || []);
        setRejectedRequests(data.rejectedRequests || []);
      }
    } catch (error) {
      console.error('Error fetching incoming requests:', error);
    }
  };

  const fetchDonorStats = async () => {
    try {
      const response = await fetch('/api/donors/stats');
      if (response.ok) {
        const data = await response.json();
        setDonorStats({
          totalDonations: data.totalDonations || 0,
          livesSaved: data.livesSaved || 0,
          acceptedRequests: data.acceptedRequests || 0
        });
        setRecentActivity(data.recentActivity || []);
      } else {
        console.error('Failed to fetch donor stats:', response.status);
      }
    } catch (error) {
      console.error('Error fetching donor stats:', error);
    }
  };

  const fetchDonationAppointments = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/donors/my-appointments');
      if (response.ok) {
        const data = await response.json();
        setDonationAppointments(data.appointments || []);
      } else {
        console.error('Failed to fetch donation appointments:', response.status);
        toast.error('Failed to refresh appointments');
      }
    } catch (error) {
      console.error('Error fetching donation appointments:', error);
      toast.error('Error fetching appointments');
    } finally {
      setIsRefreshing(false);
    }
  };

  const updateCriticalSettings = async (updates) => {
    try {
      const response = await fetch('/api/donors/critical-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (response.ok) {
        const data = await response.json();
        // Update state with the response from server to ensure consistency
        setCriticalSettings(prev => ({ 
          ...prev, 
          is_critical_ready: data.is_critical_ready,
          current_location: data.current_location || prev.current_location
        }));
      } else {
        console.error('Failed to update settings:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error updating critical settings:', error);
    }
  };

  const handleRequestAccepted = (requestDetails) => {
    // Show success message
    setSuccessMessage(`🎉 Congratulations! You've accepted a blood request and could potentially save a life! Your response has been sent to ${requestDetails.requester_name || 'the requester'}.`);
    setShowSuccessMessage(true);
    
    // Update stats
    setDonorStats(prev => ({
      ...prev,
      acceptedRequests: prev.acceptedRequests + 1,
      livesSaved: prev.livesSaved + 1 // Potential life saved
    }));
    
    // Add to recent activity
    const newActivity = {
      type: 'request_accepted',
      description: `Accepted blood request for ${requestDetails.blood_type} blood type`,
      date: new Date().toISOString(),
      details: requestDetails
    };
    
    setRecentActivity(prev => [newActivity, ...prev.slice(0, 9)]); // Keep last 10 activities
    
    // Auto-hide success message after 10 seconds
    setTimeout(() => {
      setShowSuccessMessage(false);
    }, 10000);
    
    // Refresh data
    fetchDonorStats();
    fetchIncomingRequests();
  };

  const participateInDrive = async (driveId) => {
    try {
      const response = await fetch('/api/drives/participate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drive_id: driveId })
      });
      
      if (response.ok) {
        alert('Successfully registered for the donation drive!');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to register for drive');
      }
    } catch (error) {
      console.error('Error participating in drive:', error);
      alert('Failed to register for drive');
    }
  };

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['user']}>
        <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
          <div className="text-center">
            <div className="rounded-full h-32 w-32 border-b-2 border-[#ef4444] mx-auto"></div>
            <p className="mt-4 text-[var(--text-secondary)]">Loading dashboard...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  // Check verification status - show pending approval message if not verified
  if (verificationStatus && verificationStatus !== 'VERIFIED') {
    return (
      <ProtectedRoute allowedRoles={['user']}>
        <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <div className="bg-[var(--card-background)] border-2 border-yellow-400 rounded-lg p-8 text-center">
              <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">
                {verificationStatus === 'PENDING' ? 'Verification Pending' : 'Verification Rejected'}
              </h2>
              <p className="text-[var(--text-secondary)] mb-6">
                {verificationStatus === 'PENDING' 
                  ? 'Your donor registration is currently under review by our admin team. We will verify your medical documents shortly.' 
                  : 'Your donor registration was rejected. Please contact support for more information.'}
              </p>
              <div className="space-y-2">
                <p className="text-sm text-[var(--text-secondary)]">
                  Status: <span className="font-bold text-yellow-600">{verificationStatus}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['user']}>
      <div className="min-h-screen bg-[var(--background)] py-8">
        <div className="container mx-auto px-4 max-w-7xl">
          {/* Success Message */}
          {showSuccessMessage && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg relative">
              <div className="flex items-start">
                <CheckCircle className="h-6 w-6 text-green-600 mt-0.5 mr-3" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-green-800 mb-2">
                    🎉 Life-Saving Hero!
                  </h3>
                  <p className="text-green-700">
                    {successMessage}
                  </p>
                </div>
                <button
                  onClick={() => setShowSuccessMessage(false)}
                  className="text-green-400 hover:text-green-600"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
          
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2 mb-4">
                  <Heart className="h-8 w-8 text-[#ef4444]" />
                  <h1 className="text-3xl font-bold text-[var(--text-primary)]">Donor Dashboard</h1>
                </div>
                <p className="text-[var(--text-secondary)]">Welcome back, {session?.user?.name || session?.user?.email}!</p>
              </div>
              
              {/* Critical Service Status */}
              <div className="flex items-center space-x-2">
                <div className={`px-3 py-2 rounded-lg border ${criticalSettings.is_critical_ready 
                  ? 'bg-green-50 border-green-200 text-green-800' 
                  : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${criticalSettings.is_critical_ready ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                    <span className="text-sm font-medium">
                      {criticalSettings.is_critical_ready ? 'Available for Emergency' : 'Emergency Service Off'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="mb-8">
            <div className="flex space-x-1 bg-[var(--card-background)] p-1 rounded-lg border border-[var(--border-color)] overflow-x-auto">
              {[
                { id: 'overview', label: 'Overview', icon: Activity },
                { id: 'appointments', label: 'Appointments', icon: Calendar },
                { id: 'drives', label: 'Donation Drives', icon: Users },
                { id: 'requests', label: 'Incoming Requests', icon: Bell },
                { id: 'profile', label: 'Profile', icon: User },
                { id: 'settings', label: 'Emergency Settings', icon: Settings }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-[#ef4444] text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--background)]'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  <span className="font-medium">{tab.label}</span>
                  {tab.id === 'requests' && incomingRequests.length > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {incomingRequests.length}
                    </span>
                  )}
                  {tab.id === 'appointments' && ((() => {
                    const pendingCount = donationAppointments.filter(apt => apt.status === 'pending').length;
                    return pendingCount > 0 ? (
                      <span className="bg-[#ef4444] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {pendingCount}
                      </span>
                    ) : null;
                  })())}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <OverviewTab 
              criticalSettings={criticalSettings} 
              donorStats={donorStats}
              recentActivity={recentActivity}
              donors={bloodCenters}
              mapLoading={mapLoading}
              setActiveTab={setActiveTab}
            />
          )}
          {activeTab === 'appointments' && (
            <AppointmentsTab 
              appointments={donationAppointments}
              onRefreshAppointments={fetchDonationAppointments}
              isRefreshing={isRefreshing}
              onContactBloodBank={(bloodbankInfo) => {
                setSelectedBloodBank(bloodbankInfo);
                setShowBloodBankModal(true);
              }}
            />
          )}
          {activeTab === 'drives' && <DrivesTab drives={donationDrives} onParticipate={participateInDrive} />}
          {activeTab === 'requests' && (
            <RequestsTab 
              pendingRequests={incomingRequests}
              acceptedRequests={acceptedRequests}
              rejectedRequests={rejectedRequests}
              criticalSettings={criticalSettings}
              onRequestAccepted={handleRequestAccepted}
              onRefreshRequests={fetchIncomingRequests}
            />
          )}
          {activeTab === 'profile' && (
            <ProfileTab />
          )}
          {activeTab === 'settings' && (
            <SettingsTab 
              settings={criticalSettings} 
              onUpdateSettings={updateCriticalSettings}
            />
          )}
        </div>

        {/* Blood Bank Contact Modal */}
        {showBloodBankModal && selectedBloodBank && (
          <BloodBankContactModal 
            bloodbank={selectedBloodBank}
            onClose={() => setShowBloodBankModal(false)}
          />
        )}
      </div>
    </ProtectedRoute>
  );
};

// Overview Tab Component
const OverviewTab = ({ criticalSettings, donorStats, recentActivity, donors, mapLoading, setActiveTab }) => {
  const [filterBloodType, setFilterBloodType] = useState('');
  const filteredBloodCenters = filterBloodType ? donors.filter(bc => bc.available_blood_types?.includes(filterBloodType)) : donors;

  return (
  <div className="space-y-8">
    {/* Stats Cards */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className="bg-[var(--card-background)] p-6 rounded-lg border border-[var(--border-color)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[var(--text-secondary)]">Total Donations</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{donorStats.totalDonations}</p>
          </div>
          <Heart className="h-8 w-8 text-[#ef4444]" />
        </div>
      </div>
      
      <div className="bg-[var(--card-background)] p-6 rounded-lg border border-[var(--border-color)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[var(--text-secondary)]">Lives Saved</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{donorStats.livesSaved}</p>
          </div>
          <Award className="h-8 w-8 text-[#ef4444]" />
        </div>
      </div>
      
      <div className="bg-[var(--card-background)] p-6 rounded-lg border border-[var(--border-color)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[var(--text-secondary)]">Requests Accepted</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{donorStats.acceptedRequests}</p>
          </div>
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
      </div>
      
      <div className="bg-[var(--card-background)] p-6 rounded-lg border border-[var(--border-color)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[var(--text-secondary)]">Next Eligible</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">Now</p>
          </div>
          <Calendar className="h-8 w-8 text-[#ef4444]" />
        </div>
      </div>
    </div>

    {/* Main Content */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Recent Activity */}
      <div className="bg-[var(--card-background)] p-6 rounded-lg border border-[var(--border-color)]">
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4 flex items-center">
          <Activity className="h-5 w-5 mr-2" />
          Recent Activity
        </h2>
        {recentActivity.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[var(--text-secondary)]">No recent activity</p>
            <p className="text-sm text-[var(--text-secondary)] mt-2">
              Start by accepting blood requests or scheduling your first donation!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {[...recentActivity].reverse().slice(0, 5).map((activity, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 bg-[var(--background)] rounded-lg">
                <div className="flex-shrink-0">
                  {activity.type === 'request_accepted' ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  ) : activity.type === 'donation_completed' ? (
                    <Heart className="h-5 w-5 text-red-600 mt-0.5" />
                  ) : (
                    <Activity className="h-5 w-5 text-blue-600 mt-0.5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text-primary)] font-medium">
                    {activity.description}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    {new Date(activity.date).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-[var(--card-background)] p-6 rounded-lg border border-[var(--border-color)]">
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">Quick Actions</h2>
        <div className="space-y-3">
          <Link 
            href="/donation-request"
            className="w-full text-left p-4 bg-[#ef4444] text-white rounded-lg hover:bg-[#ef4444]/90 transition-colors cursor-pointer block"
          >
            <div className="flex items-center">
              <Heart className="h-5 w-5 mr-3" />
              <div>
                <div className="font-medium">Schedule Donation</div>
                <div className="text-sm opacity-90">Book your next blood donation</div>
              </div>
            </div>
          </Link>
          
          <button 
            onClick={() => setActiveTab('appointments')}
            className="w-full text-left p-4 bg-[var(--background)] border border-[var(--border-color)] rounded-lg hover:bg-[var(--card-background)] transition-colors cursor-pointer"
          >
            <div className="flex items-center">
              <Calendar className="h-5 w-5 mr-3 text-[var(--text-secondary)]" />
              <div>
                <div className="font-medium text-[var(--text-primary)]">View History</div>
                <div className="text-sm text-[var(--text-secondary)]">See your donation history</div>
              </div>
            </div>
          </button>
        </div>
      </div>
      </div>

    {/* Nearby Blood Centers Section */}
    <div className="mt-8">
      <div className="bg-[var(--card-background)] p-6 rounded-lg border border-[var(--border-color)]">
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">Nearby Blood Centers</h2>

        {/* Filter controls */}
        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm text-[var(--text-secondary)]">Filter by blood type:</label>
          <select
            value={typeof filterBloodType !== 'undefined' ? filterBloodType : ''}
            onChange={(e) => setFilterBloodType(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--background)] text-[var(--text-primary)]"
          >
            <option value="">All</option>
            <option value="A+">A+</option>
            <option value="A-">A-</option>
            <option value="B+">B+</option>
            <option value="B-">B-</option>
            <option value="AB+">AB+</option>
            <option value="AB-">AB-</option>
            <option value="O+">O+</option>
            <option value="O-">O-</option>
          </select>

          <div className="text-sm text-[var(--text-secondary)] ml-auto">
            Showing {filteredBloodCenters.length} blood center{filteredBloodCenters.length !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="border-2 border-gray-200 rounded-xl">
          <MapWithNoSSR donors={filteredBloodCenters} />
        </div>
        <p className="mt-2 text-sm text-gray-600">Markers show nearby blood banks and hospitals. Find centers that have the blood type you need.</p>
        {mapLoading && <p className="text-sm text-[var(--text-secondary)] mt-2">Loading blood centers...</p>}
        {!mapLoading && filteredBloodCenters.length === 0 && <p className="text-sm text-[var(--text-secondary)] mt-2">No blood centers available for selected filter.</p>}
      </div>
    </div>
  </div>
  );
};

// Donation Drives Tab Component
const DrivesTab = ({ drives, onParticipate }) => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <h2 className="text-2xl font-bold text-[var(--text-primary)]">Available Donation Drives</h2>
      <div className="text-sm text-[var(--text-secondary)]">
        {drives.length} active drive{drives.length !== 1 ? 's' : ''}
      </div>
    </div>

    {drives.length === 0 ? (
      <div className="text-center py-12 bg-[var(--card-background)] rounded-lg border border-[var(--border-color)]">
        <Users className="h-16 w-16 text-[var(--text-secondary)] mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">No Active Drives</h3>
        <p className="text-[var(--text-secondary)]">
          There are no active donation drives at the moment. Check back later!
        </p>
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {drives.map(drive => (
          <div key={drive._id} className="bg-[var(--card-background)] p-6 rounded-lg border border-[var(--border-color)] hover:shadow-lg transition-shadow">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{drive.title}</h3>
              <p className="text-[var(--text-secondary)] text-sm mb-3">{drive.description}</p>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-[var(--text-secondary)]" />
                  <span className="text-[var(--text-primary)]">{drive.location}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-[var(--text-secondary)]" />
                  <span className="text-[var(--text-primary)]">
                    {new Date(drive.date).toLocaleDateString()} | {drive.start_time} - {drive.end_time}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Phone className="h-4 w-4 text-[var(--text-secondary)]" />
                  <span className="text-[var(--text-primary)]">{drive.contact_number}</span>
                </div>
              </div>

              {drive.required_blood_types && drive.required_blood_types.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-[var(--text-secondary)] mb-1">Required Blood Types:</p>
                  <div className="flex flex-wrap gap-1">
                    {drive.required_blood_types.map(type => (
                      <span key={type} className="px-2 py-1 bg-[#ef4444] text-white text-xs rounded-full">
                        {type}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="text-xs text-[var(--text-secondary)]">
                Organized by {drive.organizer_id?.name || 'Unknown'}
              </div>
              <button
                onClick={() => onParticipate(drive._id)}
                className="bg-[#ef4444] hover:bg-[#ef4444]/90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Participate
              </button>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

// Requests Tab Component with History
const RequestsTab = ({ pendingRequests, acceptedRequests, rejectedRequests, criticalSettings, onRequestAccepted, onRefreshRequests }) => {
  const [responding, setResponding] = useState(false);
  const [activeRequestTab, setActiveRequestTab] = useState('pending');

  const handleResponseToRequest = async (requestId, requestType, action, requestDetails) => {
    setResponding(true);
    try {
      if (requestType === 'donor_contact_request') {
        const response = await fetch('/api/donor-contact-request/respond', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            requestId: requestId, 
            action: action // 'accept' or 'reject'
          })
        });
        
        if (response.ok) {
          if (action === 'accept') {
            // Update donor stats in database
            try {
              await fetch('/api/donors/update-stats', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  incrementAcceptedRequests: true,
                  activity: {
                    type: 'request_accepted',
                    description: `Accepted ${requestDetails.blood_type || 'blood'} request from ${requestDetails.hospital_name || 'hospital'}`,
                    timestamp: new Date().toISOString(),
                    details: {
                      blood_type: requestDetails.blood_type,
                      hospital: requestDetails.hospital_name,
                      request_id: requestId
                    }
                  }
                }),
              });
            } catch (statsError) {
              console.error('Error updating donor stats:', statsError);
            }

            // Call the success handler
            onRequestAccepted(requestDetails);
          } else {
            alert(`Request ${action}ed successfully!`);
          }
          // Refresh the requests list
          onRefreshRequests();
        } else {
          const error = await response.json();
          alert(error.error || `Failed to ${action} request`);
        }
      } else {
        // Handle other request types (emergency, hospital, etc.)
        alert('Emergency response feature coming soon!');
      }
    } catch (error) {
      console.error(`Error ${action}ing request:`, error);
      alert(`Failed to ${action} request`);
    } finally {
      setResponding(false);
    }
  };

  // Helper function to render request cards with clear distinction
  const renderRequestCard = (request, isHistory = false) => {
    const isContact = request.requestType === 'CONTACT';
    const isEmergency = request.requestType === 'EMERGENCY';
    
    console.log("🎯 Rendering card:", {
      type: request.requestType,
      hospital_location: request.hospital_location,
      message: request.message
    });

    return (
      <div 
        key={request._id} 
        className={`p-6 rounded-lg border-l-4 transition-all shadow-md ${
          isEmergency
            ? 'emergency-request-card bg-red-50 border-l-red-600'
            : isContact
              ? 'bg-blue-50 border-l-blue-500 border-[var(--border-color)]'
              : 'bg-[var(--card-background)] border-l-orange-500 border-[var(--border-color)]'
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3 flex-1">
            {isEmergency ? (
              <>
                <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0" />
                <div>
                  <span className="inline-block px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-full">
                    🚨 EMERGENCY
                  </span>
                  <p className="text-red-900 font-bold text-sm mt-1">URGENT: Immediate response needed</p>
                </div>
              </>
            ) : isContact ? (
              <>
                <User className="h-6 w-6 text-blue-600 flex-shrink-0" />
                <div>
                  <span className="inline-block px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">
                    📋 DONATION REQUEST
                  </span>
                  <p className="text-blue-900 font-semibold text-sm mt-1">Blood Bank Invitation</p>
                </div>
              </>
            ) : null}
          </div>
          
          {/* Timestamps */}
          <div className="text-right text-xs text-[var(--text-secondary)]">
            {isHistory && request.responded_at ? (
              <p>{new Date(request.responded_at).toLocaleDateString()}</p>
            ) : (
              <p>{new Date(request.created_at).toLocaleDateString()}</p>
            )}
            {!isHistory && request.expires_at && (
              <p className="text-red-500 font-medium">Expires: {new Date(request.expires_at).toLocaleTimeString()}</p>
            )}
            {isHistory && (
              <p className={`font-medium ${request.status === 'accepted' ? 'text-green-700' : 'text-red-700'}`}>
                {request.status.toUpperCase()}
              </p>
            )}
          </div>
        </div>

        {/* Main Content */}
        {isEmergency ? (
          // EMERGENCY Request Layout
          <div className="space-y-4">
            <div className="bg-red-100 border border-red-300 rounded-lg p-4">
              <p className="text-red-900 font-bold text-lg">
                🚨 {request.requester_name} urgently needs {request.blood_type} blood
              </p>
              <p className="text-red-800 text-sm mt-2">
                Quantity needed: <strong>{request.units_requested || 0} units</strong>
                {request.distance > 0 && <span className="ml-4">📍 {request.distance}km away</span>}
              </p>
              {request.message && (
                <p className="text-red-700 text-sm mt-3 border-t border-red-300 pt-2">
                  <strong>Additional info:</strong> {request.message}
                </p>
              )}
              {request.hospital_location?.address && (
                <p className="text-red-700 text-sm mt-2">
                  <strong>Location:</strong> {
                    request.hospital_location.address === 'Current Location' 
                      ? '123 Nguyen Hue Boulevard, District 1, Ho Chi Minh City'
                      : request.hospital_location.address
                  }
                </p>
              )}
            </div>

            {/* Emergency Action Button */}
            {!isHistory ? (
              <div className="space-y-2">
                <button
                  onClick={() => handleResponseToRequest(request._id, request.type, 'accept', request)}
                  disabled={responding}
                  className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg text-sm font-bold transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  <AlertTriangle className="h-5 w-5" />
                  <span>{responding ? 'Processing...' : '🚨 I WILL GO NOW'}</span>
                </button>
                <button
                  onClick={() => handleResponseToRequest(request._id, request.type, 'reject', request)}
                  disabled={responding}
                  className="w-full bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {responding ? 'Processing...' : 'Unable to Respond'}
                </button>
              </div>
            ) : (
              <div className="p-3 bg-gray-100 rounded text-center">
                <span className={`text-sm font-bold ${request.status === 'accepted' ? 'text-green-700' : 'text-red-700'}`}>
                  ✓ {request.status === 'accepted' ? 'YOU RESPONDED' : 'DECLINED'}
                </span>
              </div>
            )}
          </div>
        ) : isContact ? (
          // CONTACT Request Layout
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="text-blue-900 font-semibold">
                {request.requester_name} is requesting {request.blood_type} blood donation
              </p>
              <p className="text-blue-800 text-sm mt-2">
                Priority: <strong className="capitalize">{request.urgency}</strong>
              </p>
              {request.message && (
                <p className="text-blue-700 text-sm mt-3 italic">
                  "{request.message}"
                </p>
              )}
            </div>

            {/* Contact Information */}
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <h4 className="font-semibold text-blue-900 mb-2">📧 Contact Information</h4>
              {request.contact_email && (
                <div className="flex items-center space-x-2 text-sm text-blue-800">
                  <Mail className="h-4 w-4" />
                  <span>{request.contact_email}</span>
                </div>
              )}
              {/* Show address for all contact requests (with fallback) */}
              <div className="flex items-start space-x-2 text-sm text-blue-800 mt-3">
                <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  {request.hospital_location?.address && request.hospital_location.address !== 'Current Location'
                    ? request.hospital_location.address
                    : '123 Nguyen Hue Boulevard, District 1, Ho Chi Minh City'}
                </span>
              </div>
            </div>

            {/* Contact Action Buttons */}
            {!isHistory ? (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleResponseToRequest(request._id, request.type, 'accept', request)}
                  disabled={responding}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                >
                  {responding ? 'Processing...' : '✓ Accept'}
                </button>
                <button
                  onClick={() => handleResponseToRequest(request._id, request.type, 'reject', request)}
                  disabled={responding}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                >
                  {responding ? 'Processing...' : '✗ Decline'}
                </button>
              </div>
            ) : (
              <div className="p-3 bg-blue-100 rounded text-center">
                <span className={`text-sm font-bold ${request.status === 'accepted' ? 'text-green-700' : 'text-red-700'}`}>
                  {request.status === 'accepted' ? '✓ ACCEPTED' : '✗ DECLINED'}
                </span>
              </div>
            )}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Blood Requests</h2>
        <div className={`px-3 py-1 rounded-full text-sm ${criticalSettings.is_critical_ready 
          ? 'bg-green-100 text-green-800' 
          : 'bg-gray-100 text-gray-600'}`}>
          {criticalSettings.is_critical_ready ? 'Emergency Service ON' : 'Emergency Service OFF'}
        </div>
      </div>

      {/* Request Type Tabs */}
      <div className="flex space-x-1 bg-gray-600 p-1 rounded-lg">
        <button
          onClick={() => setActiveRequestTab('pending')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeRequestTab === 'pending'
              ? 'bg-white text-gray-600 shadow-sm'
              : 'text-white hover:text-white'
          }`}
        >
          Incoming ({pendingRequests.length})
        </button>
        <button
          onClick={() => setActiveRequestTab('accepted')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeRequestTab === 'accepted'
              ? 'bg-white text-green-600 shadow-sm'
              : 'text-white hover:text-white'
          }`}
        >
          Accepted ({acceptedRequests.length})
        </button>
        <button
          onClick={() => setActiveRequestTab('rejected')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeRequestTab === 'rejected'
              ? 'bg-white text-red-600 shadow-sm'
              : 'text-white hover:text-white'
          }`}
        >
          Rejected ({rejectedRequests.length})
        </button>
      </div>

      {/* Request Content */}
      {activeRequestTab === 'pending' && (
        <div>
          {pendingRequests.length === 0 ? (
            <div className="text-center py-12 bg-[var(--card-background)] rounded-lg border border-[var(--border-color)]">
              <Bell className="h-16 w-16 text-[var(--text-secondary)] mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">No Incoming Requests</h3>
              <p className="text-[var(--text-secondary)]">
                {!criticalSettings.is_critical_ready 
                  ? "Enable emergency service in settings to receive urgent blood requests near your location."
                  : "Great! There are no pending requests at the moment."
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map(request => renderRequestCard(request, false))}
            </div>
          )}
        </div>
      )}

      {activeRequestTab === 'accepted' && (
        <div>
          {acceptedRequests.length === 0 ? (
            <div className="text-center py-12 bg-[var(--card-background)] rounded-lg border border-[var(--border-color)]">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">No Accepted Requests</h3>
              <p className="text-[var(--text-secondary)]">
                Requests you accept will appear here for your reference.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {acceptedRequests.map(request => renderRequestCard(request, true))}
            </div>
          )}
        </div>
      )}

      {activeRequestTab === 'rejected' && (
        <div>
          {rejectedRequests.length === 0 ? (
            <div className="text-center py-12 bg-[var(--card-background)] rounded-lg border border-[var(--border-color)]">
              <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">No Rejected Requests</h3>
              <p className="text-[var(--text-secondary)]">
                Requests you reject will appear here for your reference.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {rejectedRequests.map(request => renderRequestCard(request, true))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Settings Tab Component (With Location)
const SettingsTab = ({ settings, onUpdateSettings }) => {
  const [isReady, setIsReady] = useState(settings.is_critical_ready || false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  // Update local state when settings change
  useEffect(() => {
    setIsReady(settings.is_critical_ready || false);
  }, [settings.is_critical_ready]);

  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            coordinates: [position.coords.longitude, position.coords.latitude]
          });
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  };

  const handleReadyToggle = async (e) => {
    // Prevent the checkbox from being unchecked if already enabled
    if (isReady) {
      e.preventDefault();
      return;
    }
    
    if (isUpdating) {
      e.preventDefault();
      return;
    }
    
    const newValue = e.target.checked;
    
    // Only allow enabling, not disabling
    if (newValue && !isReady) {
      const confirmed = window.confirm(
        "⚠️ IMPORTANT COMMITMENT ⚠️\n\n" +
        "By enabling Emergency Service, you are making a commitment to help save lives during critical situations.\n\n" +
        "• You will receive urgent blood request notifications\n" +
        "• You must respond promptly to emergency calls\n" +
        "• Once enabled, this service CANNOT be disabled\n" +
        "• Your location will be shared for emergency coordination\n\n" +
        "Are you ready to make this life-saving commitment?"
      );
      
      if (!confirmed) {
        e.preventDefault();
        return; // User cancelled
      }
    } else {
      // Prevent any attempt to disable
      e.preventDefault();
      return;
    }
    
    setIsUpdating(true);
    
    try {
      let updateData = { is_critical_ready: newValue };
      
      // If enabling emergency service, get location and FCM token
      if (newValue) {
        // Request notification permission
        console.log('🔵 Requesting notification permission...');
        const permission = await Notification.requestPermission();
        console.log('🔵 Notification permission:', permission);

        if (permission !== 'granted') {
          alert('Notification permission is required for emergency service');
          setIsUpdating(false);
          return;
        }

        // Register service worker and get FCM token
        if ('serviceWorker' in navigator && messaging) {
          try {
            console.log('🔵 Registering Firebase messaging service worker...');
            const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
            console.log('✅ Firebase Service Worker registered:', reg.scope);
            
            // Add a small delay to ensure service worker is ready
            await new Promise(resolve => setTimeout(resolve, 500));

            console.log('🔵 Getting FCM token with service worker...');
            const VAPID_KEY = process.env.NEXT_PUBLIC_FCM_VAPID_KEY;
            const fcmToken = await getToken(messaging, {
              vapidKey: VAPID_KEY,
              serviceWorkerRegistration: reg
            });

            if (fcmToken) {
              console.log('✅ FCM Token obtained:', fcmToken.substring(0, 20) + '...');
              updateData.fcmToken = fcmToken;
            } else {
              console.warn('⚠️ Failed to get FCM token');
            }
          } catch (err) {
            console.error('❌ Error registering service worker or getting FCM token:', err);
            alert('Warning: Could not obtain notification token, but Emergency Service will be enabled');
          }
        } else if (messaging) {
          // Fallback: try to get token without explicit service worker registration
          try {
            console.log('🔵 Getting FCM token (service worker not available)...');
            const VAPID_KEY = process.env.NEXT_PUBLIC_FCM_VAPID_KEY;
            const fcmToken = await getToken(messaging, {
              vapidKey: VAPID_KEY
            });

            if (fcmToken) {
              console.log('✅ FCM Token obtained:', fcmToken.substring(0, 20) + '...');
              updateData.fcmToken = fcmToken;
            } else {
              console.warn('⚠️ Failed to get FCM token');
            }
          } catch (err) {
            console.error('❌ Error getting FCM token:', err);
            alert('Warning: Could not obtain notification token, but Emergency Service will be enabled');
          }
        } else {
          console.warn('⚠️ Firebase messaging not initialized');
          alert('Warning: Notification service not available, but Emergency Service will be enabled');
        }

        // Get location
        setGettingLocation(true);
        try {
          const location = await getCurrentLocation();
          updateData.current_location = location;
          console.log('Location obtained:', location);
        } catch (locationError) {
          console.error('Failed to get location:', {
            code: locationError?.code,
            message: locationError?.message,
            toString: locationError?.toString?.()
          });
          // Build a helpful message based on error code (if available)
          let msg = 'Could not get your location. Emergency service will be enabled without precise location data.';
          if (locationError) {
            if (locationError.code === 1) msg = 'Permission denied. Please allow location access for this site in your browser settings.';
            else if (locationError.code === 2) msg = 'Position unavailable. Ensure GPS or network is enabled.';
            else if (locationError.code === 3) msg = 'Location request timed out. Please try again.';
            else if (locationError.message) msg = locationError.message;
          }
          console.warn('Location error message:', msg);
          alert('Warning: ' + msg);
        } finally {
          setGettingLocation(false);
        }
      }
      
      setIsReady(newValue);
      await onUpdateSettings(updateData);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-[var(--text-primary)]">Emergency Service Settings</h2>

      <div className="bg-[var(--card-background)] p-6 rounded-lg border border-[var(--border-color)]">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Critical Service Availability</h3>
        
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-[var(--text-primary)]">Emergency Response Status</h4>
              <p className="text-sm text-[var(--text-secondary)]">
                {isReady ? 
                  "✅ You are committed to emergency response (permanent)" : 
                  "Enable to receive urgent blood request notifications"
                }
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="emergencyService"
                checked={isReady}
                onChange={handleReadyToggle}
                disabled={isUpdating || gettingLocation || isReady}
                className={`h-5 w-5 rounded border-2 transition-colors ${
                  isReady 
                    ? 'bg-green-500 border-green-500 text-white cursor-not-allowed' 
                    : 'border-gray-300 hover:border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                } ${(isUpdating || gettingLocation) ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
              <label 
                htmlFor="emergencyService" 
                className={`text-sm font-medium ${
                  isReady ? 'text-green-600 cursor-not-allowed' : 'text-gray-700 cursor-pointer'
                }`}
              >
                {isReady ? 'Emergency Service Active ✅' : 'Enable Emergency Service'}
              </label>
            </div>
          </div>

          {!isReady && !gettingLocation && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-orange-800">⚠️ Important Commitment</h4>
                  <p className="text-sm text-orange-700 mt-1">
                    Emergency service is a <strong>permanent commitment</strong>. Once enabled, it cannot be turned off. 
                    You will be responsible for responding to life-threatening blood requests in your area.
                  </p>
                </div>
              </div>
            </div>
          )}

          {gettingLocation && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <div>
                  <h4 className="font-medium text-blue-800">Getting Your Location...</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Please allow location access to enable emergency service.
                  </p>
                </div>
              </div>
            </div>
          )}

          {isReady && !gettingLocation && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <h4 className="font-medium text-green-800">Emergency Service Active</h4>
                  <p className="text-sm text-green-700 mt-1">
                    You will receive notifications for critical blood requests. Make sure to respond promptly to help save lives!
                  </p>
                  {settings.current_location?.coordinates[0] !== 0 && settings.current_location?.coordinates[1] !== 0 && (
                    <p className="text-xs text-green-600 mt-1">
                      📍 Location: {settings.current_location.coordinates[1].toFixed(4)}°, {settings.current_location.coordinates[0].toFixed(4)}°
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start space-x-2">
          <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-yellow-800">Important Information</h4>
            <p className="text-sm text-yellow-700 mt-1">
              When emergency service is enabled, you may receive critical blood request notifications. 
              These requests are time-sensitive and could help save lives. Please ensure you are available 
              to respond promptly when this service is active.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Profile Tab Component
const ProfileTab = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [form, setForm] = useState({
    name: '',
    mobile_number: '',
    email: '',
    emergency_contact_mobile: ''
  });

  useEffect(() => {
    let mounted = true;
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/donors/profile');
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.error('Failed to fetch profile', err);
          toast.error('Failed to load profile information');
          return;
        }
        const data = await res.json();
        if (!mounted) return;
        setForm({
          name: data.name || '',
          mobile_number: data.mobile_number || '',
          email: data.email || '',
          emergency_contact_mobile: data.emergency_contact_mobile || ''
        });
      } catch (err) {
        console.error('Error fetching profile:', err);
        toast.error('Error loading profile');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchProfile();
    return () => { mounted = false; };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch('/api/donors/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to update profile');
        return;
      }
      const data = await res.json();
      toast.success('Profile updated successfully');

      // After updating profile, request session update so client session reflects changes
      try {
        const updateRes = await fetch('/api/auth/update-session', { method: 'POST' });
        if (updateRes.ok) {
          const payload = await updateRes.json().catch(() => ({}));
          if (payload && payload.success && payload.needsUpdate) {
            toast.success('Session updated');
            // Refresh the client router to update server components and session-aware UI
            if (typeof router !== 'undefined' && typeof router.refresh === 'function') {
              router.refresh();
            } else {
              console.warn('router.refresh not available; falling back to full reload');
              window.location.reload();
            }
          } else {
            toast.info('Profile updated but session may not be refreshed');
          }
        } else {
          console.warn('Failed to refresh session after profile update');
          toast.warn('Profile updated but failed to refresh session');
        }
      } catch (err2) {
        console.error('Error updating session after profile update:', err2);
        toast.warn('Profile updated but failed to refresh session');
      }

    } catch (err) {
      console.error('Error updating profile:', err);
      toast.error('Error updating profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-[var(--text-primary)]">Profile</h2>

      <div className="bg-[var(--card-background)] p-6 rounded-lg border border-[var(--border-color)]">
        {loading ? (
          <div className="text-center py-8">
            <div className="rounded-full h-8 w-8 border-b-2 border-[#ef4444] mx-auto"></div>
            <p className="mt-2 text-[var(--text-secondary)]">Loading profile...</p>
          </div>
        ) : (
          <>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Full name</label>
                <input type="text" name="name" value={form.name} onChange={handleChange} className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--card-background)]" />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Email</label>
                <input type="email" name="email" value={form.email} onChange={handleChange} className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--card-background)]" />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Phone number</label>
                <input type="tel" name="mobile_number" value={form.mobile_number} onChange={handleChange} className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--card-background)]" />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Emergency contact phone</label>
                <input type="tel" name="emergency_contact_mobile" value={form.emergency_contact_mobile} onChange={handleChange} className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--card-background)]" />
              </div>
            </div>

            <div className="flex justify-end items-center gap-3">
              <button type="button" onClick={() => setShowChangePassword(true)} className="py-2 px-4 rounded-md border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--card-background)]">
                Change Password
              </button>
              <button type="submit" disabled={isSaving} className={`py-2 px-4 rounded-md text-white ${isSaving ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#ef4444] hover:bg-[#ef4444]/90'}`}>
                {isSaving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>

          {showChangePassword && (
            <ChangePasswordModal isOpen={showChangePassword} onClose={() => setShowChangePassword(false)} />
          )}
        </>
      )}
      </div>
    </div>
  );
};

// Appointments Tab Component
const AppointmentsTab = ({ appointments, onRefreshAppointments, isRefreshing, onContactBloodBank }) => {
  const getStatusBadge = (status) => {
    const now = new Date();
    const isSoon = false; // In a real app, check if appointment is soon
    
    switch (status) {
      case 'pending':
        return {
          label: '⏳ Pending Approval',
          className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700'
        };
      case 'approved':
        return {
          label: 'Approved',
          className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border border-green-300 dark:border-green-700'
        };
      case 'completed':
        return {
          label: '🩸 Completed',
          className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
        };
      case 'cancelled':
        return {
          label: '❌ Cancelled',
          className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border border-red-300 dark:border-red-700'
        };
      default:
        return {
          label: status,
          className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
        };
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Booking Calendar</h2>
        <button
          onClick={onRefreshAppointments}
          disabled={isRefreshing}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
            isRefreshing
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-[#ef4444] hover:bg-[#ef4444]/90 text-white'
          }`}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? '' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {appointments.length === 0 ? (
        <div className="bg-[var(--card-background)] rounded-lg border border-[var(--border-color)] p-12 text-center">
          <Calendar className="h-16 w-16 text-[var(--text-secondary)] mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">No Appointments Yet</h3>
          <p className="text-[var(--text-secondary)] mb-6">
            You haven't booked any donation appointments yet. Ready to save lives?
          </p>
          <Link href="/donation-request" className="inline-block px-6 py-3 bg-[#ef4444] text-white rounded-lg font-semibold hover:bg-[#ef4444]/90 transition-colors">
            📅 Book an Appointment
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {[...appointments].reverse().map((apt) => {
            const badgeInfo = getStatusBadge(apt.status);
            return (
              <div
                key={apt._id}
                className={`rounded-lg p-6 border-2 transition-all ${
                  apt.status === 'approved'
                    ? 'bg-green-50 dark:bg-green-900/10 border-green-300 dark:border-green-700 shadow-lg'
                    : 'bg-[var(--card-background)] border-[var(--border-color)]'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  {/* Appointment Details */}
                  <div className="flex-1">
                    <div className="flex items-start gap-4 mb-3">
                      <div className="flex-shrink-0">
                        <div className="w-14 h-14 bg-[#ef4444]/10 rounded-lg flex items-center justify-center">
                          <Calendar className="h-6 w-6 text-[#ef4444]" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">
                          {apt.bloodbank_name}
                        </h3>
                        <div className="space-y-1 text-sm text-[var(--text-secondary)]">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 flex-shrink-0" />
                            <span>{formatDate(apt.appointment_date)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 flex-shrink-0" />
                            <span>{apt.appointment_time}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="mb-3">
                      <span className={`inline-block px-4 py-2 rounded-full font-semibold text-sm ${badgeInfo.className}`}>
                        {badgeInfo.label}
                      </span>
                    </div>

                    {/* Approved Message */}
                    {apt.status === 'approved' && (
                      <div className="mt-3 p-3 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg">
                        <p className="text-green-800 dark:text-green-300 font-semibold flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          ✅ Confirmed! Please arrive on time.
                        </p>
                      </div>
                    )}

                    {/* Cancellation Reason */}
                    {apt.status === 'cancelled' && apt.cancellation_reason && (
                      <div className="mt-3 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
                        <p className="text-red-800 dark:text-red-300 text-sm">
                          <strong>Reason:</strong> {apt.cancellation_reason}
                        </p>
                      </div>
                    )}

                    {/* Notes */}
                    {apt.notes && (
                      <div className="mt-3 p-3 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg">
                        <p className="text-blue-800 dark:text-blue-300 text-sm">
                          <strong>Note:</strong> {apt.notes}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {(apt.status === 'pending' || apt.status === 'approved') && (
                    <div className="flex gap-2 md:flex-col">
                      {apt.status === 'approved' && (
                        <button
                          onClick={() => onContactBloodBank(apt.bloodbank_info)}
                          className="px-4 py-2 bg-[#ef4444] hover:bg-[#ef4444]/90 text-white rounded-lg font-semibold transition-colors text-center whitespace-nowrap"
                        >
                          Contact Blood Bank
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <h3 className="text-lg font-bold text-blue-900 dark:text-blue-300 mb-3 flex items-center gap-2">
          <Heart className="h-5 w-5" fill="currentColor" />
          Before Your Appointment
        </h3>
        <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
          <li>✓ Get a good night's sleep before your donation</li>
          <li>✓ Eat a healthy meal 2-3 hours before your appointment</li>
          <li>✓ Stay hydrated by drinking plenty of water</li>
          <li>✓ Bring valid ID and proof of registration</li>
          <li>✓ Avoid strenuous exercise on the day of donation</li>
          <li>✓ Wear comfortable, loose-fitting clothing</li>
        </ul>
      </div>
    </div>
  );
};

// Blood Bank Contact Modal Component
const BloodBankContactModal = ({ bloodbank, onClose }) => {
  const phone = bloodbank.phone || 'Not available';
  const address = bloodbank.address || 'Not available';
  const name = bloodbank.name || 'Blood Bank';
  
  const handleCallClick = () => {
    if (bloodbank.phone && bloodbank.phone !== 'Not available') {
      window.location.href = `tel:${bloodbank.phone}`;
    }
  };

  const handleEmailClick = () => {
    // Using a default email or placeholder since BloodBank model doesn't have email field
    toast.warning('Email functionality not yet available. Please use the call feature instead.');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--card-background)] rounded-lg shadow-2xl max-w-md w-full border border-[var(--border-color)]">
        {/* Header */}
        <div className="bg-[#ef4444] text-white p-6 rounded-t-lg">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <Phone className="h-6 w-6 flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-xl font-bold">{name}</h2>
                <p className="text-red-100 text-sm">Contact Information</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-red-100 transition-colors"
            >
              <XCircle className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Phone */}
          <div className="flex items-start gap-3 p-3 bg-[var(--background)] rounded-lg">
            <Phone className="h-5 w-5 text-[#ef4444] flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--text-secondary)] mb-1">Phone</p>
              <p className="font-semibold text-[var(--text-primary)] break-all">{phone}</p>
            </div>
          </div>

          {/* Address */}
          <div className="flex items-start gap-3 p-3 bg-[var(--background)] rounded-lg">
            <MapPin className="h-5 w-5 text-[#ef4444] flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--text-secondary)] mb-1">Address</p>
              <p className="font-semibold text-[var(--text-primary)]">{address}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={handleCallClick}
              disabled={phone === 'Not available'}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white rounded-lg font-semibold transition-colors"
            >
              <Phone className="h-4 w-4" />
              Call Now
            </button>
            <button
              onClick={handleEmailClick}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors"
            >
              <Mail className="h-4 w-4" />
              Send Email
            </button>
          </div>
        </div>

        {/* Footer Note */}
        <div className="border-t border-[var(--border-color)] p-4 bg-blue-50 dark:bg-blue-900/10 rounded-b-lg">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            💡 Call directly to confirm your appointment and get the best support
          </p>
        </div>
      </div>
    </div>
  );
};

export default DonorDashboard;
