"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Heart, Calendar, Clock, Building2, Loader, ArrowLeft } from "lucide-react";
import { useToast } from "@/context/ToastContext";

export default function DonationRequestPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { success, error } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bloodbanks, setBloodbanks] = useState([]);
  const [formData, setFormData] = useState({
    bloodbank_id: "",
    appointment_date: "",
    appointment_time: ""
  });

  // Available time slots (9 AM to 6 PM, 30-minute intervals)
  const timeSlots = [
    "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
    "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00"
  ];

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      error("Please login first");
      router.push("/login");
    }
  }, [status, router, error]);

  // Fetch bloodbanks on mount
  useEffect(() => {
    const fetchBloodbanks = async () => {
      try {
        const response = await fetch("/api/donation-requests");
        if (!response.ok) throw new Error("Failed to fetch bloodbanks");
        
        const data = await response.json();
        setBloodbanks(data.bloodbanks || []);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching bloodbanks:", err);
        error("Failed to load blood banks");
        setLoading(false);
      }
    };

    if (status === "authenticated") {
      fetchBloodbanks();
    }
  }, [status, error]);

  // Get minimum date (today)
  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form
    if (!formData.bloodbank_id || !formData.appointment_date || !formData.appointment_time) {
      error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/donation-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to book appointment");
      }

      success("Appointment booked successfully! Awaiting blood bank approval.");
      
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);

    } catch (err) {
      console.error("Error booking appointment:", err);
      error(err.message || "Failed to book appointment");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <div className="rounded-full h-16 w-16 border-b-2 border-[#ef4444] mx-auto mb-4"></div>
          <p className="text-[var(--text-secondary)]">Loading...</p>
        </div>
      </main>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return (
    <main className="min-h-screen bg-[var(--background)] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-[#ef4444] hover:text-[#ef4444]/80 font-medium mb-6 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-[#ef4444]/10 rounded-lg">
              <Heart className="h-8 w-8 text-[#ef4444]" fill="currentColor" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)]">
              Book Donation Appointment
            </h1>
          </div>
          <p className="text-[var(--text-secondary)] mt-2">
            Schedule your blood donation at your preferred blood bank
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-[var(--card-background)] rounded-xl shadow-lg border border-[var(--border-color)] p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Blood Bank Selection */}
            <div>
              <label className="flex items-center gap-2 text-lg font-semibold text-[var(--text-primary)] mb-3">
                <Building2 className="h-5 w-5 text-[#ef4444]" />
                Select Blood Bank *
              </label>
              <select
                name="bloodbank_id"
                value={formData.bloodbank_id}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg bg-[var(--input-background)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#ef4444] transition-all"
                required
              >
                <option value="">Choose a blood bank...</option>
                {bloodbanks.map(bank => (
                  <option key={bank._id} value={bank._id}>
                    {bank.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-[var(--text-secondary)] mt-2">
                Select the blood bank where you'd like to donate
              </p>
            </div>

            {/* Date Selection */}
            <div>
              <label className="flex items-center gap-2 text-lg font-semibold text-[var(--text-primary)] mb-3">
                <Calendar className="h-5 w-5 text-[#ef4444]" />
                Appointment Date *
              </label>
              <input
                type="date"
                name="appointment_date"
                value={formData.appointment_date}
                onChange={handleChange}
                min={getMinDate()}
                className="w-full px-4 py-3 rounded-lg bg-[var(--input-background)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#ef4444] transition-all"
                required
              />
              <p className="text-xs text-[var(--text-secondary)] mt-2">
                Please select a date at least 1 day in advance
              </p>
            </div>

            {/* Time Selection */}
            <div>
              <label className="flex items-center gap-2 text-lg font-semibold text-[var(--text-primary)] mb-3">
                <Clock className="h-5 w-5 text-[#ef4444]" />
                Appointment Time *
              </label>
              <select
                name="appointment_time"
                value={formData.appointment_time}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg bg-[var(--input-background)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#ef4444] transition-all"
                required
              >
                <option value="">Choose a time slot...</option>
                {timeSlots.map(time => (
                  <option key={time} value={time}>
                    {time} - {new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit',
                      hour12: true 
                    })}
                  </option>
                ))}
              </select>
              <p className="text-xs text-[var(--text-secondary)] mt-2">
                Operating hours: 9:00 AM - 6:00 PM
              </p>
            </div>

            {/* Important Information */}
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-8">
              <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-2">
                <Heart className="h-4 w-4" fill="currentColor" />
                Before Your Appointment
              </h3>
              <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                <li>✓ Get adequate sleep the night before</li>
                <li>✓ Eat a healthy meal 2-3 hours before donation</li>
                <li>✓ Drink plenty of water</li>
                <li>✓ Bring a valid ID and proof of registration</li>
                <li>✓ Avoid strenuous exercise on donation day</li>
              </ul>
            </div>

            {/* Form Actions */}
            <div className="flex gap-3 pt-6 border-t border-[var(--border-color)]">
              <Link
                href="/dashboard"
                className="flex-1 px-4 py-3 rounded-lg border border-[var(--border-color)] text-[var(--text-primary)] font-semibold hover:bg-[var(--input-background)] transition-colors text-center"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-4 py-3 rounded-lg bg-[#ef4444] text-white font-semibold hover:bg-[#ef4444]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader className="h-4 w-4" />
                    Booking...
                  </>
                ) : (
                  <>
                    <Heart className="h-4 w-4" fill="currentColor" />
                    Book Appointment
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Why Regular Donations Matter */}
        <div className="mt-12 bg-gradient-to-r from-[#ef4444]/5 to-[#ef4444]/10 rounded-xl p-8 border border-[#ef4444]/20">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">
            Why Regular Donations Matter
          </h2>
          <div className="grid md:grid-cols-2 gap-6 text-[var(--text-secondary)]">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)] mb-2">🎯 Consistent Supply</h3>
              <p>Regular donations help blood banks maintain a stable inventory of all blood types, ensuring emergency supplies are always available.</p>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--text-primary)] mb-2">❤️ Lifesaving Impact</h3>
              <p>One donation can save up to 3 lives. By donating regularly, you create a network of safety for your community.</p>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--text-primary)] mb-2">💪 Health Benefits</h3>
              <p>Blood donation helps reduce iron levels and promotes cardiovascular health while giving back to society.</p>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--text-primary)] mb-2">🌍 Community Support</h3>
              <p>Your donations support patients in accidents, surgeries, cancer treatments, and other critical situations.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
