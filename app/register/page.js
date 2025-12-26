"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart } from "lucide-react";

const RegisterPage = () => {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    age: "",
    blood_type: "O+",
    mobile_number: "",
    email: "",
    password: "",
    role: "user", // Default role
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Registration failed");
      }

      // Success -> Redirect to login
      alert("Registration successful! Please log in.");
      router.push("/login");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4">
      <div className="w-full max-w-md bg-[var(--card-background)] p-8 rounded-xl shadow-md border border-[var(--border-color)]">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Heart className="h-8 w-8 text-[#ef4444]" fill="currentColor" />
            <h1 className="text-2xl font-bold text-[#ef4444]">BloodBond</h1>
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Create an account</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Join us to save lives</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)]">Full Name</label>
            <input 
              name="name" 
              type="text" 
              placeholder="John Doe"
              required 
              className="mt-1 block w-full p-2.5 border border-[var(--border-color)] rounded-md bg-[var(--input-background)] text-[var(--text-primary)] focus:ring-2 focus:ring-[#ef4444] focus:border-transparent outline-none transition-all" 
              onChange={handleChange} 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)]">Age</label>
              <input 
                name="age" 
                type="number" 
                placeholder="20"
                required 
                className="mt-1 block w-full p-2.5 border border-[var(--border-color)] rounded-md bg-[var(--input-background)] text-[var(--text-primary)] focus:ring-2 focus:ring-[#ef4444] focus:border-transparent outline-none transition-all" 
                onChange={handleChange} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)]">Blood Type</label>
              <select 
                name="blood_type" 
                className="mt-1 block w-full p-2.5 border border-[var(--border-color)] rounded-md bg-[var(--input-background)] text-[var(--text-primary)] focus:ring-2 focus:ring-[#ef4444] focus:border-transparent outline-none transition-all" 
                onChange={handleChange}
              >
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)]">Mobile Number</label>
            <input 
              name="mobile_number" 
              type="tel" 
              placeholder="0909..."
              required 
              className="mt-1 block w-full p-2.5 border border-[var(--border-color)] rounded-md bg-[var(--input-background)] text-[var(--text-primary)] focus:ring-2 focus:ring-[#ef4444] focus:border-transparent outline-none transition-all" 
              onChange={handleChange} 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)]">Email Address</label>
            <input 
              name="email" 
              type="email" 
              placeholder="name@example.com"
              required 
              className="mt-1 block w-full p-2.5 border border-[var(--border-color)] rounded-md bg-[var(--input-background)] text-[var(--text-primary)] focus:ring-2 focus:ring-[#ef4444] focus:border-transparent outline-none transition-all" 
              onChange={handleChange} 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)]">Password</label>
            <input 
              name="password" 
              type="password" 
              placeholder="••••••••"
              required 
              className="mt-1 block w-full p-2.5 border border-[var(--border-color)] rounded-md bg-[var(--input-background)] text-[var(--text-primary)] focus:ring-2 focus:ring-[#ef4444] focus:border-transparent outline-none transition-all" 
              onChange={handleChange} 
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#ef4444] hover:bg-[#dc2626] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#ef4444] disabled:opacity-50 transition-colors"
          >
            {loading ? "Creating account..." : "Register"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <p className="text-[var(--text-secondary)]">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-[#ef4444] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;