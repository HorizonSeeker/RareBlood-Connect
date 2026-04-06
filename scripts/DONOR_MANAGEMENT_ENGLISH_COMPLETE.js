"use client"
import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  Users, 
  Search, 
  Filter, 
  Phone, 
  Mail, 
  MapPin,
  Droplet,
  Calendar,
  Heart,
  User,
  RefreshCw,
  Navigation,
  AlertCircle,
  Shield
} from 'lucide-react';

const ViewDonors = () => {
  const { data: session } = useSession();
  const [donors, setDonors] = useState([]);
  const [filteredDonors, setFilteredDonors] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [bloodTypeFilter, setBloodTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [maxDistance, setMaxDistance] = useState(50);
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [selectedDonor, setSelectedDonor] = useState(null);
  const [contactForm, setContactForm] = useState({
    urgencyLevel: 'Medium',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [bloodBankLocation, setBloodBankLocation] = useState(null);

  const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const statusOptions = ['Active', 'Inactive'];

  useEffect(() => {
    // Fetch donors list
    fetchDonors();
  }, [maxDistance, criticalOnly]);

  useEffect(() => {
    // Filter donors based on search term, blood type, and status
    let filtered = donors;

    if (searchTerm) {
      filtered = filtered.filter(donor => 
        donor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        donor.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        donor.mobile_number.includes(searchTerm) ||
        donor.address.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (bloodTypeFilter) {
      filtered = filtered.filter(donor => donor.blood_type === bloodTypeFilter);
    }

    if (statusFilter) {
      filtered = filtered.filter(donor => donor.status === statusFilter);
    }

    setFilteredDonors(filtered);
  }, [searchTerm, bloodTypeFilter, statusFilter, donors]);

  const fetchDonors = async () => {
    try {
      setError(null);
      const params = new URLSearchParams({
        maxDistance: maxDistance.toString(),
        criticalOnly: criticalOnly.toString()
      });
      
      const response = await fetch(`/api/donors?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setDonors(data.donors);
        setFilteredDonors(data.donors);
        setBloodBankLocation(data.bloodBankLocation);
      } else {
        throw new Error(data.error || 'Failed to fetch donors');
      }
    } catch (error) {
      console.error('Error fetching donors:', error);
      setError(error.message);
      setDonors([]);
      setFilteredDonors([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const refreshDonors = async () => {
    setRefreshing(true);
    await fetchDonors();
  };

  const handleContactDonor = (donor) => {
    setSelectedDonor(donor);
    setShowContactModal(true);
    setContactForm({
      urgencyLevel: 'Medium',
      message: ''
    });
  };

  const submitContactRequest = async () => {
    if (!selectedDonor) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/donor-contact-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          donorId: selectedDonor._id,
          bloodType: selectedDonor.blood_type,
          urgencyLevel: contactForm.urgencyLevel,
          message: contactForm.message
        })
      });

      if (response.ok) {
        alert('✅ Contact request sent successfully!');
        setShowContactModal(false);
        fetchDonors(); // Refresh donor list
      } else {
        const errorData = await response.json();
        alert(errorData.error || '❌ Failed to send contact request');
      }
    } catch (error) {
      console.error('Error sending contact request:', error);
      alert('⚠️ Error sending contact request');
    } finally {
      setSubmitting(false);
    }
  };

  const getDonationStatus = (lastDonationDate) => {
    const today = new Date();
    const lastDonation = new Date(lastDonationDate);
    const daysSinceLastDonation = Math.floor((today - lastDonation) / (1000 * 60 * 60 * 24));
    
    if (daysSinceLastDonation < 90) {
      return { status: 'Recent', color: 'text-green-600 bg-green-100' };
    } else if (daysSinceLastDonation < 180) {
      return { status: 'Eligible', color: 'text-blue-600 bg-blue-100' };
    } else {
      return { status: 'Due Soon', color: 'text-orange-600 bg-orange-100' };
    }
  };

  const getDistanceColor = (distance) => {
    if (distance <= 10) return 'text-green-600';
    if (distance <= 25) return 'text-yellow-600';
    if (distance <= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[#ef4444] mx-auto"></div>
          <p className="mt-4 text-[var(--text-secondary)]">Loading donor records...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-24 w-24 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Error Loading Donors</h3>
          <p className="text-[var(--text-secondary)] mb-4">{error}</p>
          <button
            onClick={fetchDonors}
            className="bg-[#ef4444] text-white px-4 py-2 rounded-lg hover:bg-[#ef4444]/90 transition-colors font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] py-8">
      <div className="container mx-auto px-4 max-w-7xl">
          {/* Header Section */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <Users className="h-8 w-8 text-[#ef4444]" />
                <h1 className="text-3xl font-bold text-[var(--text-primary)]">Donor Management</h1>
              </div>
              <p className="text-[var(--text-secondary)]">
                Filter and manage donor records within {maxDistance}km radius
                {bloodBankLocation && (
                  <span className="ml-2 text-sm font-medium">
                    📍 {bloodBankLocation.name}
                  </span>
                )}
              </p>
            </div>
            
            <button
              onClick={refreshDonors}
              disabled={refreshing}
              className="flex items-center space-x-2 bg-[#ef4444] text-white px-4 py-2 rounded-lg hover:bg-[#ef4444]/90 transition-colors disabled:opacity-50 font-medium"
              title="Refresh donor list"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Statistics Overview */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
            <div className="bg-[var(--card-background)] p-6 rounded-lg border border-[var(--border-color)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--text-secondary)]">Total Donors</p>
                  <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{donors.length}</p>
                </div>
                <Users className="h-8 w-8 text-[#ef4444]" />
              </div>
            </div>
            
            <div className="bg-[var(--card-background)] p-6 rounded-lg border border-[var(--border-color)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--text-secondary)]">Critical Ready</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">
                    {donors.filter(d => d.is_critical_ready).length}
                  </p>
                </div>
                <Shield className="h-8 w-8 text-red-600" />
              </div>
            </div>
            
            <div className="bg-[var(--card-background)] p-6 rounded-lg border border-[var(--border-color)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--text-secondary)]">Active Donors</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">
                    {donors.filter(d => d.status === 'Active').length}
                  </p>
                </div>
                <Heart className="h-8 w-8 text-green-600" />
              </div>
            </div>
            
            <div className="bg-[var(--card-background)] p-6 rounded-lg border border-[var(--border-color)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--text-secondary)]">Average Distance</p>
                  <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">
                    {donors.length > 0 
                      ? Math.round((donors.reduce((sum, d) => sum + d.distance, 0) / donors.length) * 10) / 10
                      : 0
                    } km
                  </p>
                </div>
                <Navigation className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            
            <div className="bg-[var(--card-background)] p-6 rounded-lg border border-[var(--border-color)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--text-secondary)]">Total Donations</p>
                  <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">
                    {donors.reduce((sum, donor) => sum + (donor.total_donations || 0), 0)}
                  </p>
                </div>
                <Droplet className="h-8 w-8 text-[#ef4444]" />
              </div>
            </div>
          </div>

          {/* Filters Section */}
          <div className="bg-[var(--card-background)] p-6 rounded-lg border border-[var(--border-color)] mb-6">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Search & Filter Options
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div className="lg:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[var(--text-secondary)]" />
                  <input
                    type="text"
                    placeholder="Search by name, email, phone, or address..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-[var(--border-color)] rounded-lg bg-[var(--background)] text-[var(--text-primary)] focus:ring-2 focus:ring-[#ef4444] focus:border-transparent transition"
                  />
                </div>
              </div>
              
              <div>
                <select
                  value={bloodTypeFilter}
                  onChange={(e) => setBloodTypeFilter(e.target.value)}
                  className="w-full p-2 border border-[var(--border-color)] rounded-lg bg-[var(--background)] text-[var(--text-primary)] focus:ring-2 focus:ring-[#ef4444] focus:border-transparent transition"
                >
                  <option value="">All Blood Types</option>
                  {bloodTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full p-2 border border-[var(--border-color)] rounded-lg bg-[var(--background)] text-[var(--text-primary)] focus:ring-2 focus:ring-[#ef4444] focus:border-transparent transition"
                >
                  <option value="">All Status</option>
                  {statusOptions.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Maximum Distance: {maxDistance} km
                </label>
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="5"
                  value={maxDistance}
                  onChange={(e) => setMaxDistance(parseInt(e.target.value))}
                  className="w-full cursor-pointer"
                />
                <div className="flex justify-between text-xs text-[var(--text-secondary)] mt-1">
                  <span>5 km</span>
                  <span>100 km</span>
                </div>
              </div>

              <div className="flex items-end">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={criticalOnly}
                    onChange={(e) => setCriticalOnly(e.target.checked)}
                    className="rounded border-[var(--border-color)] text-[#ef4444] focus:ring-[#ef4444]"
                  />
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    Show Critical Ready Only
                  </span>
                  <Shield className="h-4 w-4 text-red-600 ml-1" />
                </label>
              </div>
            </div>
          </div>

          {/* Donors Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDonors.map(donor => {
              const donationStatus = getDonationStatus(donor.last_donation_date);
              const distanceColor = getDistanceColor(donor.distance);
              
              return (
                <div key={donor._id} className="bg-[var(--card-background)] p-6 rounded-lg border border-[var(--border-color)] hover:shadow-lg transition-shadow">
                  {/* Donor Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-[#ef4444]/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="h-6 w-6 text-[#ef4444]" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-lg font-semibold text-[var(--text-primary)]">{donor.name}</h3>
                          {donor.is_critical_ready && (
                            <Shield className="h-4 w-4 text-red-600" title="Critical Ready Donor" />
                          )}
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          <Droplet className="h-4 w-4 text-[#ef4444]" />
                          <span className="text-lg font-bold text-[#ef4444]">{donor.blood_type}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col space-y-1">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium text-center ${donationStatus.color}`}>
                        {donationStatus.status}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium text-center ${
                        donor.status === 'Active' ? 'text-green-600 bg-green-100' : 'text-gray-600 bg-gray-100'
                      }`}>
                        {donor.status}
                      </span>
                    </div>
                  </div>

                  {/* Donor Details */}
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 text-sm text-[var(--text-secondary)]">
                      <Navigation className="h-4 w-4 flex-shrink-0" />
                      <span className={`font-semibold ${distanceColor}`}>
                        {donor.distance} km away
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-sm text-[var(--text-secondary)]">
                      <Mail className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate" title={donor.email}>{donor.email}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2 text-sm text-[var(--text-secondary)]">
                      <Phone className="h-4 w-4 flex-shrink-0" />
                      <span>{donor.mobile_number}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2 text-sm text-[var(--text-secondary)]">
                      <MapPin className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate" title={donor.address}>{donor.address}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2 text-sm text-[var(--text-secondary)]">
                      <Calendar className="h-4 w-4 flex-shrink-0" />
                      <span>Last donation: {formatDate(donor.last_donation_date)}</span>
                    </div>
                  </div>

                  {/* Additional Stats */}
                  <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
                    <div className="flex justify-between items-center">
                      <div className="text-sm">
                        <span className="text-[var(--text-secondary)]">Donations: </span>
                        <span className="font-semibold text-[var(--text-primary)]">{donor.total_donations || 0}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-[var(--text-secondary)]">Age: </span>
                        <span className="font-semibold text-[var(--text-primary)]">{donor.age || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="mt-4">
                    <button
                      onClick={() => handleContactDonor(donor)}
                      disabled={donor.status !== 'Active'}
                      className="w-full bg-[#ef4444] text-white py-2 px-4 rounded-lg hover:bg-[#ef4444]/90 transition-colors text-sm flex items-center justify-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      title={donor.status !== 'Active' ? 'Can only contact active donors' : 'Send contact request to donor'}
                    >
                      <Phone className="h-4 w-4" />
                      <span>Contact Donor</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty State */}
          {filteredDonors.length === 0 && !loading && (
            <div className="text-center py-12">
              <Users className="h-24 w-24 text-[var(--text-secondary)] mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">No Donors Found</h3>
              <p className="text-[var(--text-secondary)] mb-6">
                {searchTerm || bloodTypeFilter || statusFilter
                  ? "Try adjusting your search criteria or filters" 
                  : criticalOnly 
                    ? `No critical-ready donors available within ${maxDistance} km`
                    : `No donors available within ${maxDistance} km`
                }
              </p>
              {(searchTerm || bloodTypeFilter || statusFilter) && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setBloodTypeFilter('');
                    setStatusFilter('');
                  }}
                  className="mt-2 text-[#ef4444] hover:underline font-medium"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          )}

        {/* Contact Donor Modal */}
        {showContactModal && selectedDonor && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-[var(--card-background)] rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-[var(--text-primary)] mb-4 flex items-center justify-between">
                <span>Contact {selectedDonor.name}</span>
                {selectedDonor.is_critical_ready && (
                  <span className="text-red-600 text-lg" title="Critical Ready">⚡</span>
                )}
              </h3>
              
              <div className="space-y-4">
                {/* Urgency Level */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Urgency Level *
                  </label>
                  <select
                    value={contactForm.urgencyLevel}
                    onChange={(e) => setContactForm({...contactForm, urgencyLevel: e.target.value})}
                    className="w-full p-2 border border-[var(--border-color)] rounded-lg bg-[var(--background)] text-[var(--text-primary)] focus:ring-2 focus:ring-[#ef4444] focus:border-transparent"
                  >
                    <option value="Low">Low Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="High">High Priority</option>
                    <option value="Critical">Critical/Emergency</option>
                  </select>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Message (Optional)
                  </label>
                  <textarea
                    value={contactForm.message}
                    onChange={(e) => setContactForm({...contactForm, message: e.target.value})}
                    placeholder="Add context or specific request for the donor..."
                    rows={3}
                    maxLength={500}
                    className="w-full p-2 border border-[var(--border-color)] rounded-lg bg-[var(--background)] text-[var(--text-primary)] focus:ring-2 focus:ring-[#ef4444] focus:border-transparent"
                  />
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    {contactForm.message.length}/500 characters
                  </p>
                </div>

                {/* Donor Summary */}
                <div className="bg-[var(--background)] p-4 rounded-lg border border-[var(--border-color)]">
                  <h4 className="font-semibold text-[var(--text-primary)] mb-2 text-sm">Donor Summary</h4>
                  <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                    <p>
                      <span className="font-medium">Blood Type:</span> <span className="font-bold text-[#ef4444]">{selectedDonor.blood_type}</span>
                    </p>
                    <p>
                      <span className="font-medium">Distance:</span> <span className={`font-semibold ${getDistanceColor(selectedDonor.distance)}`}>
                        {selectedDonor.distance} km away
                      </span>
                    </p>
                    <p>
                      <span className="font-medium">Last Donation:</span> {formatDate(selectedDonor.last_donation_date)}
                    </p>
                    {selectedDonor.is_critical_ready && (
                      <p className="text-red-600 font-medium text-xs">
                        ⚡ Critical Ready Donor - Prioritize!
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6 pt-4 border-t border-[var(--border-color)]">
                <button
                  onClick={() => setShowContactModal(false)}
                  className="flex-1 bg-[var(--background)] border border-[var(--border-color)] text-[var(--text-primary)] py-2 px-4 rounded-lg hover:bg-[var(--card-background)] transition-colors font-medium"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  onClick={submitContactRequest}
                  disabled={submitting}
                  className="flex-1 bg-[#ef4444] text-white py-2 px-4 rounded-lg hover:bg-[#ef4444]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {submitting ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ViewDonors;
