"use client"
import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Heart, MapPin, Phone, Mail, User, Building, Calendar, Droplet, Users } from 'lucide-react';
import { toast } from 'react-toastify';

// Geolocation Hook
const useGeolocation = () => {
  const [location, setLocation] = useState({ latitude: null, longitude: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getCurrentLocation = () => {
    setLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setLoading(false);
      },
      (error) => {
        setError('Unable to retrieve your location');
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return { location, loading, error, getCurrentLocation };
};

// Donor Form Component
const DonorForm = ({ onSubmit, loading }) => {
  const { data: session } = useSession();
  const { location, loading: locationLoading, error: locationError, getCurrentLocation } = useGeolocation();
  const [formData, setFormData] = useState({
    name: session?.user?.name || '',
    dateOfBirth: '',
    gender: '',
    age: '',
    weight: '',
    blood_type: '',
    mobile_number: '',
    email: session?.user?.email || '',
    emergency_contact_mobile: '',
    address: '',
    latitude: '',
    longitude: '',
    medicalProof: null
  });
  const [weightError, setWeightError] = useState('');

  useEffect(() => {
    if (location.latitude && location.longitude) {
      setFormData(prev => ({
        ...prev,
        latitude: location.latitude.toString(),
        longitude: location.longitude.toString()
      }));
    }
  }, [location]);

  const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Clear weight error when weight is being changed
    if (name === 'weight') {
      setWeightError('');
    }
    
    // Auto-calculate age when dateOfBirth changes
    if (name === 'dateOfBirth' && value) {
      const birthDate = new Date(value);
      const today = new Date();
      let calculatedAge = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      // Adjust age if birthday hasn't occurred yet this year
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        calculatedAge--;
      }
      
      setFormData(prev => ({
        ...prev,
        [name]: value,
        age: calculatedAge.toString()
      }));
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setFormData(prev => ({
      ...prev,
      medicalProof: file
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate weight
    if (parseFloat(formData.weight) < 50) {
      setWeightError('You must weigh at least 50kg to be eligible as a donor.');
      return;
    }
    
    // Create FormData for file upload
    const submitData = new FormData();
    Object.keys(formData).forEach(key => {
      if (formData[key] !== null && formData[key] !== '') {
        submitData.append(key, formData[key]);
      }
    });
    
    onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
            <User className="inline w-4 h-4 mr-2" />
            Full Name *
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md focus:outline-none focus:ring-2 focus:ring-[#ef4444] bg-[var(--card-background)] text-[var(--text-primary)]"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
            <Calendar className="inline w-4 h-4 mr-2" />
            Date of Birth *
          </label>
          <input
            type="text"
            name="dateOfBirth"
            placeholder="YYYY-MM-DD"
            value={formData.dateOfBirth}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md focus:outline-none focus:ring-2 focus:ring-[#ef4444] bg-[var(--card-background)] text-[var(--text-primary)]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
            👤 Gender *
          </label>
          <select
            name="gender"
            value={formData.gender}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md focus:outline-none focus:ring-2 focus:ring-[#ef4444] bg-[var(--card-background)] text-[var(--text-primary)]"
          >
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
            <Calendar className="inline w-4 h-4 mr-2" />
            Age *
          </label>
          <input
            type="number"
            name="age"
            value={formData.age}
            onChange={handleChange}
            required
            min="18"
            max="65"
            className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md focus:outline-none focus:ring-2 focus:ring-[#ef4444] bg-[var(--card-background)] text-[var(--text-primary)]"
          />
        </div>
        
        {/* New Weight Field */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
            <Droplet className="inline w-4 h-4 mr-2" />
            Weight (kg) *
          </label>
          <input
            type="number"
            name="weight"
            value={formData.weight}
            onChange={handleChange}
            required
            min="0"
            step="0.1"
            className={`w-full px-3 py-2 border ${weightError ? 'border-red-500' : 'border-[var(--border-color)]'} rounded-md focus:outline-none focus:ring-2 focus:ring-[#ef4444] bg-[var(--card-background)] text-[var(--text-primary)]`}
          />
          {weightError && (
            <p className="mt-1 text-red-500 text-sm">{weightError}</p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
            <Droplet className="inline w-4 h-4 mr-2" />
            Blood Type *
          </label>
          <select
            name="blood_type"
            value={formData.blood_type}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md focus:outline-none focus:ring-2 focus:ring-[#ef4444] bg-[var(--card-background)] text-[var(--text-primary)]"
          >
            <option value="">Select Blood Type</option>
            {bloodTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
            <Phone className="inline w-4 h-4 mr-2" />
            Mobile Number *
          </label>
          <input
            type="tel"
            name="mobile_number"
            value={formData.mobile_number}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md focus:outline-none focus:ring-2 focus:ring-[#ef4444] bg-[var(--card-background)] text-[var(--text-primary)]"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
            <Mail className="inline w-4 h-4 mr-2" />
            Email *
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md focus:outline-none focus:ring-2 focus:ring-[#ef4444] bg-[var(--card-background)] text-[var(--text-primary)]"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
            <Users className="inline w-4 h-4 mr-2" />
            Emergency Contact *
          </label>
          <input
            type="tel"
            name="emergency_contact_mobile"
            value={formData.emergency_contact_mobile}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md focus:outline-none focus:ring-2 focus:ring-[#ef4444] bg-[var(--card-background)] text-[var(--text-primary)]"
          />
        </div>
      </div>

      {/* Location Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-[var(--text-primary)]">Location Information</h3>
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
            <MapPin className="inline w-4 h-4 mr-2" />
            Address *
          </label>
          <textarea
            name="address"
            value={formData.address}
            onChange={handleChange}
            required
            rows="3"
            placeholder="Enter your full address"
            className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md focus:outline-none focus:ring-2 focus:ring-[#ef4444] bg-[var(--card-background)] text-[var(--text-primary)]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
            Current Location
          </label>
          <button
            type="button"
            onClick={getCurrentLocation}
            disabled={locationLoading}
            className={`px-4 py-2 rounded-md text-white text-sm font-medium transition-colors ${
              locationLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            📍 {locationLoading ? 'Getting Location...' : 'Get Current Location'}
          </button>
          {locationError && (
            <p className="text-red-500 text-sm mt-2">{locationError}</p>
          )}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <input
              type="number"
              name="latitude"
              value={formData.latitude}
              onChange={handleChange}
              placeholder="Latitude"
              step="any"
              required
              className="px-3 py-2 border border-[var(--border-color)] rounded-md focus:outline-none focus:ring-2 focus:ring-[#ef4444] bg-[var(--card-background)] text-[var(--text-primary)]"
            />
            <input
              type="number"
              name="longitude"
              value={formData.longitude}
              onChange={handleChange}
              placeholder="Longitude"
              step="any"
              required
              className="px-3 py-2 border border-[var(--border-color)] rounded-md focus:outline-none focus:ring-2 focus:ring-[#ef4444] bg-[var(--card-background)] text-[var(--text-primary)]"
            />
          </div>
        </div>
      </div>

      {/* Medical Proof Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-[var(--text-primary)]">Medical Proof</h3>
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
            Blood Type Certificate or Medical Report *
          </label>
          <div className="border-2 border-dashed border-[var(--border-color)] rounded-lg p-6 text-center hover:border-[#ef4444] transition-colors">
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileChange}
              required
              className="hidden"
              id="medicalProof"
            />
            <label htmlFor="medicalProof" className="cursor-pointer">
              <div className="flex flex-col items-center">
                <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm text-[var(--text-primary)] mb-2">
                  {formData.medicalProof ? formData.medicalProof.name : 'Click to upload or drag and drop'}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Supported formats: Images (JPG, PNG, etc.) or PDF
                </p>
              </div>
            </label>
          </div>
          {formData.medicalProof && (
            <p className="text-sm text-green-600 mt-2">
              File selected: {formData.medicalProof.name}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-sm text-blue-700">
          <strong>Note:</strong> To be eligible as a donor, you must weigh at least 50kg for your health and safety.
        </p>
      </div>

      <button
        type="submit"
        disabled={loading}
        className={`w-full py-3 px-4 rounded-md text-white font-medium transition-colors ${
          loading
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-[#ef4444] hover:bg-[#ef4444]/90'
        }`}
      >
        {loading ? 'Registering...' : 'Complete Registration'}
      </button>
    </form>
  );
};

/* Blood Bank registration form removed per product decision - self-registration disabled. */

// Hospital Form Component (similar to Blood Bank)

// Hospital Form Component (similar to Blood Bank)
const HospitalForm = ({ onSubmit, loading }) => {
  const { data: session } = useSession();
  const { location, loading: locationLoading, error: locationError, getCurrentLocation } = useGeolocation();
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    contact_number: '',
    email: session?.user?.email || '',
    password: '',
    latitude: '',
    longitude: '',
    hospital_license: null
  });

  useEffect(() => {
    if (location.latitude && location.longitude) {
      setFormData(prev => ({
        ...prev,
        latitude: location.latitude.toString(),
        longitude: location.longitude.toString()
      }));
    }
  }, [location]);

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setFormData(prev => ({
      ...prev,
      hospital_license: file
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.latitude || !formData.longitude) {
      alert('Location is required for hospitals. Please get your current location.');
      return;
    }
    
    // Create FormData for file upload
    const submitData = new FormData();
    Object.keys(formData).forEach(key => {
      if (formData[key] !== null && formData[key] !== '') {
        submitData.append(key, formData[key]);
      }
    });
    
    onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
            <Building className="inline w-4 h-4 mr-2" />
            Hospital Name *
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md focus:outline-none focus:ring-2 focus:ring-[#ef4444] bg-[var(--card-background)] text-[var(--text-primary)]"
          />
        </div>
        
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
            <MapPin className="inline w-4 h-4 mr-2" />
            Address *
          </label>
          <textarea
            name="address"
            value={formData.address}
            onChange={handleChange}
            required
            rows="3"
            className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md focus:outline-none focus:ring-2 focus:ring-[#ef4444] bg-[var(--card-background)] text-[var(--text-primary)]"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
            <Phone className="inline w-4 h-4 mr-2" />
            Contact Number *
          </label>
          <input
            type="tel"
            name="contact_number"
            value={formData.contact_number}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md focus:outline-none focus:ring-2 focus:ring-[#ef4444] bg-[var(--card-background)] text-[var,--text-primary)]"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
            <Mail className="inline w-4 h-4 mr-2" />
            Email *
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md focus:outline-none focus:ring-2 focus:ring-[#ef4444] bg-[var(--card-background)] text-[var,--text-primary)]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
            <User className="inline w-4 h-4 mr-2" />
            Account Password *
          </label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md focus:outline-none focus:ring-2 focus:ring-[#ef4444] bg-[var(--card-background)] text-[var(--text-primary)]"
            placeholder="Choose a secure password"
          />
        </div>

        {/* Hospital License Upload */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-3">
            <Building className="inline w-4 h-4 mr-2" />
            Hospital License Certificate * (Image or PDF)
          </label>
          <div className="border-2 border-dashed border-[var(--border-color)] rounded-lg p-6 text-center hover:border-[#ef4444]/50 transition-colors cursor-pointer relative group">
            <input
              type="file"
              name="hospital_license"
              onChange={handleFileChange}
              accept="image/*,.pdf"
              required
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="pointer-events-none">
              <svg className="mx-auto h-12 w-12 text-[var(--text-secondary)] group-hover:text-[#ef4444]/60 transition-colors" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v24a4 4 0 004 4h24a4 4 0 004-4V20m-14-8l4 4m0 0l4-4m-4 4v12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">
                {formData.hospital_license ? formData.hospital_license.name : 'Click to upload or drag file'}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">PNG, JPG, GIF up to 10MB or PDF</p>
            </div>
          </div>
          {formData.hospital_license && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-green-700">{formData.hospital_license.name}</span>
            </div>
          )}
        </div>
        
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
            <MapPin className="inline w-4 h-4 mr-2" />
            Location (Required) *
          </label>
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={getCurrentLocation}
              disabled={locationLoading}
              className={`px-4 py-2 rounded-md text-white text-sm font-medium transition-colors ${
                locationLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              {locationLoading ? 'Getting Location...' : 'Get Current Location'}
            </button>
          </div>
          {locationError && (
            <p className="text-red-500 text-sm mb-2">{locationError}</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              name="latitude"
              value={formData.latitude}
              onChange={handleChange}
              placeholder="Latitude"
              step="any"
              required
              className="px-3 py-2 border border-[var(--border-color)] rounded-md focus:outline-none focus:ring-2 focus:ring-[#ef4444] bg-[var(--card-background)] text-[var(--text-primary)]"
            />
            <input
              type="number"
              name="longitude"
              value={formData.longitude}
              onChange={handleChange}
              placeholder="Longitude"
              step="any"
              required
              className="px-3 py-2 border border-[var(--border-color)] rounded-md focus:outline-none focus:ring-2 focus:ring-[#ef4444] bg-[var(--card-background)] text-[var,--text-primary)]"
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className={`w-full py-3 px-4 rounded-md text-white font-medium transition-colors ${
          loading
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-[#ef4444] hover:bg-[#ef4444]/90'
        }`}
      >
        {loading ? 'Registering...' : 'Complete Registration'}
      </button>
    </form>
  );
};

// Main Form Container
const RegistrationForm = ({ role, session: propSession }) => {
  const [loading, setLoading] = useState(false);
  const { data: sessionData } = useSession(); // Get session from hook as fallback
  
  // Use passed session prop if available, otherwise use session hook data
  const session = propSession || sessionData;
  
  // Debug: Log immediately when component renders
  console.log('🔵 RegistrationForm rendered');
  console.log('🔵 propSession (from page):', propSession);
  console.log('🔵 sessionData (from hook):', sessionData);
  console.log('🔵 Final session being used:', session);
  console.log('🔵 session?.user:', session?.user);
  console.log('🔵 session?.user?.id:', session?.user?.id);
  
  const router = useRouter();

  const getRoleTitle = () => {
    switch (role) {
      case 'user': return 'Blood Donor Registration';
      case 'hospital': return 'Hospital Registration';
      default: return 'Registration';
    }
  };

  const handleSubmit = async (formData) => {
    setLoading(true);
    try {
      let endpoint, body;
      
      console.log('🔵 Session in form:', session);
      console.log('🔵 session?.user:', session?.user);
      console.log('🔵 session?.user?.id:', session?.user?.id);
      console.log('🔵 formData:', formData);
      
      // Check if user has userId from session
      const userId = session?.user?.id;
      
      // Step 1: Set role if not already set
      if (session?.user?.role !== role) {
        console.log('🔵 Step 1: Setting role to:', role);
        console.log('🔵 Session user ID:', session?.user?.id);
        const setRoleResponse = await fetch('/api/auth/set-role', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ role }),
        });

        console.log('🔵 Set role response status:', setRoleResponse.status);
        
        if (!setRoleResponse.ok) {
          let roleError = { error: 'Failed to set role' };
          const responseText = await setRoleResponse.text();
          
          console.log('🔵 Response status:', setRoleResponse.status);
          console.log('🔵 Response text:', responseText);
          
          try {
            if (responseText) {
              roleError = JSON.parse(responseText);
              console.log('🔵 Parsed JSON error:', roleError);
            }
          } catch (parseError) {
            console.error('❌ Failed to parse error response:', parseError);
            roleError = { 
              error: `API error: ${setRoleResponse.status} ${setRoleResponse.statusText || 'Unknown Error'}. Response: ${responseText || 'Empty'}` 
            };
          }
          
          console.error('❌ Failed to set role - Final error object:', roleError);
          alert(roleError.error || 'Failed to set role');
          setLoading(false);
          return;
        }
        console.log('✅ Role set successfully');
      }
      
      if (role === 'user') {
        endpoint = '/api/donors/register';
        // Include userId from session for authentication
        if (formData instanceof FormData) {
          // For FormData, append additional fields
          formData.append('role', role);
          formData.append('userId', userId || '');
          body = formData;
        } else {
          body = { ...formData, role, userId };
        }
      } else if (role === 'hospital') {
        // Use hospital-specific endpoint with FormData support
        endpoint = '/api/hospitals';
        if (formData instanceof FormData) {
          // For FormData, just send as-is
          body = formData;
        } else {
          // Map contact_number to mobile_number if needed
          const mapped = { ...formData, role, userId };
          if (mapped.contact_number && !mapped.mobile_number) {
            mapped.mobile_number = mapped.contact_number;
            delete mapped.contact_number;
          }
          body = mapped;
        }
      }
      
      console.log('🔵 Body being sent:', body);
      console.log('🔵 Body keys:', body instanceof FormData ? 'FormData' : Object.keys(body));
      
      const headers = body instanceof FormData ? {} : { 'Content-Type': 'application/json' };
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          ...headers,
        },
        credentials: 'include',
        body: body instanceof FormData ? body : JSON.stringify(body),
      });

      // Parse body robustly: handle JSON, empty, or HTML/error text
      const raw = await response.text();
      let result = {};
      try {
        result = raw ? JSON.parse(raw) : {};
      } catch (parseErr) {
        // Not JSON (could be an HTML error page); keep raw text as the error
        result = { error: raw };
      }

      console.log('Response:', response.status, result, 'raw:', raw);

      if (response.ok) {
        console.log("Registration successful!");
        toast.success('Registration successful!');
        
        // Set flag and force complete page reload to dashboard
        localStorage.setItem('registrationCompleted', 'true');
        localStorage.setItem('userRole', role);
        
        // Small delay to ensure database update completes
        setTimeout(() => {
          window.location.href = role === 'user' ? '/dashboard/donor' : '/dashboard/hospital';
        }, 500);
        
        return;
      } else {
        console.error('Registration failed:', response.status, result);
        alert(`Registration failed: ${result.error || 'Unknown error'} (status ${response.status})`);
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert('Network error: Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };


  const renderForm = () => {
    switch (role) {
      case 'user':
        return <DonorForm onSubmit={handleSubmit} loading={loading} />;
      case 'hospital':
        return <HospitalForm onSubmit={handleSubmit} loading={loading} />;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
      <h2 className="text-2xl font-extrabold text-center text-[var(--text-primary)] mb-8">
        {getRoleTitle()}
      </h2>
      
      {renderForm()}
      
      <div className="mt-8 text-center">
        <p className="text-sm text-[var(--text-secondary)]">
          Already registered?{' '}
          <a href="/login" className="text-[#ef4444] font-medium">
            Login here
          </a>
        </p>
      </div>
    </div>
  );
};

export default RegistrationForm;
