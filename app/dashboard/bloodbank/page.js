"use client"
import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Building2, Users, Activity, TrendingUp, Package } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Lazy-load Map to avoid SSR issues
const MapWithNoSSR = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <p className="text-center p-4">Đang tải bản đồ...</p>
});

const BloodBankDashboard = () => {
  const { data: session } = useSession();
  const [inventoryStats, setInventoryStats] = useState({
    totalUnits: 0,
    bloodTypes: 0,
    expiringSoon: 0,
    expired: 0
  });
  const [bloodTypeBreakdown, setBloodTypeBreakdown] = useState({});
  const [loading, setLoading] = useState(true);
  const [donors, setDonors] = useState([]);
  const [mapLoading, setMapLoading] = useState(true);
  const [filterBloodType, setFilterBloodType] = useState('');

  const filteredDonors = filterBloodType ? donors.filter(d => d.blood_type === filterBloodType) : donors;

  useEffect(() => {
    fetchInventoryStats();
  }, []);

  // Fetch donors for map display (only accessible to bloodbank_admin)
  useEffect(() => {
    async function fetchDonors() {
      try {
        const res = await fetch('/api/donors');
        if (!res.ok) {
          console.error('Failed to fetch donors for map', res.status);
          setMapLoading(false);
          return;
        }
        const data = await res.json();
        setDonors(data.donors || []);
      } catch (err) {
        console.error('Error fetching donors for map:', err);
      } finally {
        setMapLoading(false);
      }
    }

    fetchDonors();
  }, []);

  const fetchInventoryStats = async () => {
    try {
      const response = await fetch('/api/inventory');
      if (response.ok) {
        const data = await response.json();
        const inventory = data.inventory || [];
        
        const today = new Date();
        const expiringSoon = inventory.filter(item => {
          const expiry = new Date(item.expiry_date);
          const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
          return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
        }).length;
        
        const expired = inventory.filter(item => 
          new Date(item.expiry_date) <= today
        ).length;
        
        const bloodTypes = [...new Set(inventory.map(item => item.blood_type))].length;
        const totalUnits = inventory.reduce((sum, item) => sum + item.units_available, 0);
        
        // Calculate blood type breakdown
        const breakdown = {};
        const allBloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
        
        // Initialize all blood types with 0
        allBloodTypes.forEach(type => {
          breakdown[type] = 0;
        });
        
        // Add actual units from inventory
        inventory.forEach(item => {
          if (breakdown.hasOwnProperty(item.blood_type)) {
            breakdown[item.blood_type] += item.units_available;
          }
        });
        
        setInventoryStats({
          totalUnits,
          bloodTypes,
          expiringSoon,
          expired
        });
        setBloodTypeBreakdown(breakdown);
      }
    } catch (error) {
      console.error('Error fetching inventory stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['bloodbank_admin']}>
      <div className="min-h-screen bg-[var(--background)] py-8">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center space-x-2 mb-4">
              <Building2 className="h-8 w-8 text-[#ef4444]" />
              <h1 className="text-3xl font-bold text-[var(--text-primary)]">Blood Bank Dashboard</h1>
            </div>
            <p className="text-[var(--text-secondary)]">Welcome back, {session?.user?.name || session?.user?.email}!</p>
          </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-[var(--card-background)] p-6 rounded-lg border border-[var(--border-color)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--text-secondary)]">Total Units</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{loading ? '...' : inventoryStats.totalUnits}</p>
              </div>
              <Activity className="h-8 w-8 text-[#ef4444]" />
            </div>
          </div>
          
          <div className="bg-[var(--card-background)] p-6 rounded-lg border border-[var(--border-color)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--text-secondary)]">Blood Types</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{loading ? '...' : inventoryStats.bloodTypes}</p>
              </div>
              <Package className="h-8 w-8 text-[#ef4444]" />
            </div>
          </div>
          
          <div className="bg-[var(--card-background)] p-6 rounded-lg border border-[var(--border-color)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--text-secondary)]">Expiring Soon</p>
                <p className="text-2xl font-bold text-orange-500">{loading ? '...' : inventoryStats.expiringSoon}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-500" />
            </div>
          </div>
          
          <div className="bg-[var(--card-background)] p-6 rounded-lg border border-[var(--border-color)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--text-secondary)]">Expired Items</p>
                <p className="text-2xl font-bold text-red-500">{loading ? '...' : inventoryStats.expired}</p>
              </div>
              <Activity className="h-8 w-8 text-red-500" />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Blood Type Breakdown */}
          <div className="bg-[var(--card-background)] p-6 rounded-lg border border-[var(--border-color)]">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4 flex items-center">
              <Activity className="h-5 w-5 mr-2" />
              Blood Type Inventory
            </h2>
            {loading ? (
              <div className="text-center py-8">
                <p className="text-[var(--text-secondary)]">Loading inventory...</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(bloodTypeBreakdown).map(([bloodType, units]) => (
                  <div key={bloodType} className="flex justify-between items-center p-3 bg-[var(--background)] rounded-lg border border-[var(--border-color)]">
                    <span className="font-medium text-[var(--text-primary)]">{bloodType}</span>
                    <span className={`font-bold ${units > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {units} units
                    </span>
                  </div>
                ))}
              </div>
            )}
            {!loading && Object.values(bloodTypeBreakdown).every(units => units === 0) && (
              <div className="text-center py-4 mt-4 bg-[var(--background)] rounded-lg border border-[var(--border-color)]">
                <p className="text-[var(--text-secondary)]">No inventory available</p>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  Start by adding blood units to your inventory
                </p>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-[var(--card-background)] p-6 rounded-lg border border-[var(--border-color)]">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Link href="/inventory">
                <button className="w-full text-left p-4 bg-[#ef4444] text-white rounded-lg hover:bg-[#ef4444]/90 transition-colors">
                  <div className="flex items-center">
                    <Activity className="h-5 w-5 mr-3" />
                    <div>
                      <div className="font-medium">Manage Inventory</div>
                      <div className="text-sm opacity-90">Add or update blood units</div>
                    </div>
                  </div>
                </button>
              </Link>
              
              <Link href="/donors">
                <button className="w-full text-left p-4 bg-[var(--background)] border border-[var(--border-color)] rounded-lg hover:bg-[var(--card-background)] transition-colors">
                  <div className="flex items-center">
                    <Users className="h-5 w-5 mr-3 text-[var(--text-secondary)]" />
                    <div>
                      <div className="font-medium text-[var(--text-primary)]">View Donors</div>
                      <div className="text-sm text-[var(--text-secondary)]">Manage donor records</div>
                    </div>
                  </div>
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* Donor Map Section */}
        <div className="mt-8">
          <div className="bg-[var(--card-background)] p-6 rounded-lg border border-[var(--border-color)]">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">Donor Map</h2>

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
                Showing {filteredDonors.length} donor{filteredDonors.length !== 1 ? 's' : ''}
              </div>
            </div>

            <div className="border-2 border-gray-200 rounded-xl">
              <MapWithNoSSR donors={filteredDonors} />
            </div>
            <p className="mt-2 text-sm text-gray-600">Markers show donor locations from <code>/api/donors</code>.</p>
            {mapLoading && <p className="text-sm text-[var(--text-secondary)] mt-2">Loading donors...</p>}
            {!mapLoading && filteredDonors.length === 0 && <p className="text-sm text-[var(--text-secondary)] mt-2">No donor locations available for selected filter.</p>}
          </div>
        </div>
      </div>
      </div>
    </ProtectedRoute>
  );
};

export default BloodBankDashboard;
