"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  Plus,
  MoreVertical,
  Eye,
  Edit2,
  Ban,
  Shield,
  Building2,
  Droplet,
  Users as UsersIcon,
  LoaderCircle,
} from "lucide-react";

// Mock Users Data (FALLBACK - Nếu API fail hoặc offline)
const mockUsersDataFallback = [
  {
    _id: "1",
    name: "Nguyễn Văn Admin",
    email: "admin@rareblood.com",
    role: "admin",
    bloodType: null,
    status: "active",
    createdAt: "2025-06-15",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=admin",
  },
  {
    _id: "2",
    name: "Cho Ray Hospital",
    email: "choray@hospital.com",
    role: "hospital",
    bloodType: null,
    status: "active",
    createdAt: "2025-08-20",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=hospital1",
  },
  {
    _id: "3",
    name: "Central Blood Bank",
    email: "bloodbank@center.com",
    role: "bloodbank_admin",
    bloodType: null,
    status: "active",
    createdAt: "2025-09-10",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=bloodbank",
  },
  {
    _id: "4",
    name: "Trần Thị Donation",
    email: "donation.tran@gmail.com",
    role: "user",
    bloodType: "O+",
    status: "active",
    createdAt: "2025-10-05",
    verification_status: "VERIFIED",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=donor1",
  },
  {
    _id: "5",
    name: "Phạm Văn Hiến",
    email: "pham.hien@email.com",
    role: "user",
    bloodType: "AB-",
    status: "pending",
    createdAt: "2025-11-02",
    verification_status: "PENDING",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=donor2",
  },
  {
    _id: "6",
    name: "Võ Thị Banned",
    email: "banned.user@email.com",
    role: "user",
    bloodType: "B+",
    status: "banned",
    createdAt: "2025-07-15",
    verification_status: "VERIFIED",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=donor3",
  },
];

// Helper: Format date
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
};

// Helper: Get role label and color
const getRoleConfig = (role) => {
  const configs = {
    admin: { label: "Admin", bgColor: "bg-red-100", textColor: "text-red-800", icon: Shield },
    hospital: { label: "Hospital", bgColor: "bg-blue-100", textColor: "text-blue-800", icon: Building2 },
    bloodbank_admin: { label: "Blood Bank", bgColor: "bg-purple-100", textColor: "text-purple-800", icon: Droplet },
    user: { label: "Donor", bgColor: "bg-green-100", textColor: "text-green-800", icon: UsersIcon },
  };
  return configs[role] || configs.user;
};

// Helper: Get status label and color
const getStatusConfig = (status) => {
  const configs = {
    active: { label: "Active", bgColor: "bg-green-100", textColor: "text-green-800" },
    pending: { label: "Pending", bgColor: "bg-yellow-100", textColor: "text-yellow-800" },
    banned: { label: "Banned", bgColor: "bg-red-100", textColor: "text-red-800" },
  };
  return configs[status] || configs.pending;
};

// View Profile Modal Component
const ViewProfileModal = ({ isOpen, onClose, user }) => {
  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--card-background)] rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-4 mb-6">
          <img
            src={user.avatar}
            alt={user.name}
            className="w-16 h-16 rounded-full"
          />
          <div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">
              {user.name}
            </h2>
            <p className="text-[var(--text-secondary)]">{user.email}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-[var(--text-secondary)] mb-1">Role</p>
            <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getRoleConfig(user.role).bgColor} ${getRoleConfig(user.role).textColor}`}>
              {getRoleConfig(user.role).label}
            </div>
          </div>

          {user.bloodType && (
            <div>
              <p className="text-sm text-[var(--text-secondary)] mb-1">Blood Type</p>
              <p className="text-lg font-bold text-[#ef4444]">{user.bloodType}</p>
            </div>
          )}

          <div>
            <p className="text-sm text-[var(--text-secondary)] mb-1">Status</p>
            <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusConfig(user.status).bgColor} ${getStatusConfig(user.status).textColor}`}>
              {getStatusConfig(user.status).label}
            </div>
          </div>

          {user.verification_status && (
            <div>
              <p className="text-sm text-[var(--text-secondary)] mb-1">Verification Status</p>
              <p className="font-medium text-[var(--text-primary)]">{user.verification_status}</p>
            </div>
          )}

          <div>
            <p className="text-sm text-[var(--text-secondary)] mb-1">Joined Date</p>
            <p className="font-medium text-[var(--text-primary)]">{formatDate(user.createdAt)}</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-6 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition"
        >
          Close
        </button>
      </div>
    </div>
  );
};

// Edit Role Modal Component
const EditRoleModal = ({ isOpen, onClose, user, onSubmit }) => {
  const [newRole, setNewRole] = useState(user?.role || "user");

  if (!isOpen || !user) return null;

  const handleSubmit = () => {
    onSubmit(user._id, newRole);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--card-background)] rounded-lg max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">
          Edit User Role
        </h2>
        <p className="text-[var(--text-secondary)] mb-4">
          Changing role for: <span className="font-semibold text-[var(--text-primary)]">{user.name}</span>
        </p>

        <div className="mb-6">
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
            Select New Role
          </label>
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            className="w-full px-4 py-2 border border-[var(--border-color)] rounded-lg bg-[var(--background-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="admin">Admin</option>
            <option value="hospital">Hospital</option>
            <option value="bloodbank_admin">Blood Bank</option>
            <option value="user">Donor</option>
          </select>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] hover:bg-[var(--background-color)] transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition"
          >
            Update Role
          </button>
        </div>
      </div>
    </div>
  );
};

// Ban User Modal Component
const BanUserModal = ({ isOpen, onClose, user, onSubmit }) => {
  if (!isOpen || !user) return null;

  const handleBan = () => {
    onSubmit(user._id);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--card-background)] rounded-lg max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Ban User</h2>
        <p className="text-[var(--text-secondary)] mb-4">
          Are you sure you want to ban <span className="font-semibold text-[var(--text-primary)]">{user.name}</span>?
        </p>
        <p className="text-sm text-red-600 mb-6 bg-red-50 p-3 rounded">
          ⚠️ This user will lose access to their account and all associated services.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] hover:bg-[var(--background-color)] transition"
          >
            Cancel
          </button>
          <button
            onClick={handleBan}
            className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition"
          >
            Ban User
          </button>
        </div>
      </div>
    </div>
  );
};

// Action Dropdown Menu Component
const ActionDropdown = ({ userId, userName, user, onViewProfile, onEditRole, onBanUser }) => {
  const [isOpen, setIsOpen] = useState(false);

  const actions = [
    { icon: Eye, label: "View Profile", color: "text-blue-600", handler: () => { onViewProfile(user); setIsOpen(false); } },
    { icon: Edit2, label: "Edit Role", color: "text-orange-600", handler: () => { onEditRole(user); setIsOpen(false); } },
    { icon: Ban, label: "Ban User", color: "text-red-600", handler: () => { onBanUser(user); setIsOpen(false); } },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-[var(--background-color)] rounded-lg transition"
      >
        <MoreVertical className="w-5 h-5 text-[var(--text-secondary)]" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-[var(--card-background)] border border-[var(--border-color)] rounded-lg shadow-lg z-50">
          {actions.map((action, idx) => {
            const Icon = action.icon;
            return (
              <button
                key={idx}
                onClick={action.handler}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--background-color)] first:rounded-t-lg last:rounded-b-lg transition text-left"
              >
                <Icon className={`w-4 h-4 ${action.color}`} />
                <span className="text-sm text-[var(--text-primary)]">{action.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Add User Modal Component
const AddUserModal = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "hospital",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      alert("Passwords do not match!");
      return;
    }
    onSubmit(formData);
    setFormData({
      name: "",
      email: "",
      role: "hospital",
      password: "",
      confirmPassword: "",
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--card-background)] rounded-lg max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">
          Add New User
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              Full Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-[var(--border-color)] rounded-lg bg-[var(--background-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="John Doe"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-[var(--border-color)] rounded-lg bg-[var(--background-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="user@example.com"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              Role
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-[var(--border-color)] rounded-lg bg-[var(--background-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="hospital">Hospital</option>
              <option value="bloodbank_admin">Blood Bank</option>
            </select>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-[var(--border-color)] rounded-lg bg-[var(--background-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="••••••••"
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-[var(--border-color)] rounded-lg bg-[var(--background-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="••••••••"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] hover:bg-[var(--background-color)] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition"
            >
              Create User
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Main User Management Page
const UserManagementPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [viewProfileUser, setViewProfileUser] = useState(null);
  const [editRoleUser, setEditRoleUser] = useState(null);
  const [banUserData, setBanUserData] = useState(null);

  // Fetch users from API
  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true);
      setError(null);
      try {
        console.log("🔵 Fetching users from API...");
        const response = await fetch("/api/admin/users", {
          method: "GET",
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        console.log("✅ Users fetched successfully:", data.users?.length);
        setUsers(data.users || []);
      } catch (err) {
        console.error("❌ Error fetching users:", err);
        setError(err.message);
        // Fallback to mock data
        console.log("⚠️ Using mock data as fallback...");
        setUsers(mockUsersDataFallback);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Filter users
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesStatus = statusFilter === "all" || user.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [searchTerm, roleFilter, statusFilter, users]);

  const handleAddUser = (userData) => {
    console.log("New user created:", userData);
    alert(`User "${userData.name}" created successfully!`);
    setShowAddUserModal(false);
  };

  // Handler for View Profile
  const handleViewProfile = (user) => {
    setViewProfileUser(user);
  };

  // Handler for Edit Role
  const handleEditRole = (user) => {
    setEditRoleUser(user);
  };

  // Handler for Edit Role Submit
  const handleEditRoleSubmit = async (userId, newRole) => {
    try {
      console.log("🔵 Updating user role:", { userId, newRole });
      const response = await fetch("/api/admin/users/update-role", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId, role: newRole }),
      });

      const data = await response.json();
      if (response.ok) {
        console.log("✅ Role updated successfully");
        // Update local user data
        setUsers((prevUsers) =>
          prevUsers.map((user) =>
            user._id === userId ? { ...user, role: newRole } : user
          )
        );
        alert("User role updated successfully!");
      } else {
        alert(data.error || "Failed to update role");
      }
    } catch (err) {
      console.error("❌ Error updating role:", err);
      alert("Error updating role");
    }
    setEditRoleUser(null);
  };

  // Handler for Ban User
  const handleBanUser = (user) => {
    setBanUserData(user);
  };

  // Handler for Ban User Submit
  const handleBanUserSubmit = async (userId) => {
    try {
      console.log("🔵 Banning user:", userId);
      const response = await fetch("/api/admin/users/ban", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();
      if (response.ok) {
        console.log("✅ User banned successfully");
        // Update local user data
        setUsers((prevUsers) =>
          prevUsers.map((user) =>
            user._id === userId ? { ...user, status: "banned" } : user
          )
        );
        alert("User banned successfully!");
      } else {
        alert(data.error || "Failed to ban user");
      }
    } catch (err) {
      console.error("❌ Error banning user:", err);
      alert("Error banning user");
    }
    setBanUserData(null);
  };

  return (
    <div className="min-h-screen bg-[var(--background-color)] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
              User Management
            </h1>
            <p className="text-[var(--text-secondary)]">
              Manage all users and their roles across the platform
            </p>
          </div>
          <button 
            onClick={() => setShowAddUserModal(true)}
            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors self-start md:self-auto">
            <Plus className="w-5 h-5" />
            Add New User
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="bg-[var(--card-background)] border border-[var(--border-color)] rounded-lg p-12 flex flex-col items-center justify-center">
            <LoaderCircle className="w-12 h-12 text-red-500 animate-spin mb-4" />
            <p className="text-[var(--text-secondary)] text-lg">Loading users...</p>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <p className="text-red-700">Error loading users: {error}</p>
            <p className="text-sm text-red-600 mt-2">Showing mock data as fallback</p>
          </div>
        )}

        {/* Filters and Table - Hide during loading */}
        {!isLoading && (
          <>
        {/* Filters Section */}
        <div className="bg-[var(--card-background)] border border-[var(--border-color)] rounded-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search Bar */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Search by name or email
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-[var(--text-secondary)]" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-[var(--border-color)] rounded-lg bg-[var(--background-color)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            {/* Role Filter */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Role
              </label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full px-4 py-2 border border-[var(--border-color)] rounded-lg bg-[var(--background-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="hospital">Hospital</option>
                <option value="bloodbank_admin">Blood Bank</option>
                <option value="user">Donor</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border border-[var(--border-color)] rounded-lg bg-[var(--background-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="banned">Banned</option>
              </select>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-[var(--card-background)] border border-[var(--border-color)] rounded-lg overflow-hidden">
          {/* Table Header */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--background-color)] border-b border-[var(--border-color)]">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[var(--text-primary)]">
                    User
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[var(--text-primary)]">
                    Role
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[var(--text-primary)]">
                    Blood Type
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[var(--text-primary)]">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[var(--text-primary)]">
                    Joined Date
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-[var(--text-primary)]">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user, idx) => {
                    const roleConfig = getRoleConfig(user.role);
                    const statusConfig = getStatusConfig(user.status);
                    const RoleIcon = roleConfig.icon;

                    return (
                      <tr
                        key={user._id}
                        className={`border-b border-[var(--border-color)] hover:bg-[var(--background-color)] transition ${
                          idx % 2 === 0 ? "bg-[var(--card-background)]" : "bg-[var(--card-background)]/50"
                        }`}
                      >
                        {/* User Column */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={user.avatar}
                              alt={user.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                            <div>
                              <p className="font-semibold text-[var(--text-primary)]">
                                {user.name}
                              </p>
                              <p className="text-sm text-[var(--text-secondary)]">
                                {user.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Role Column */}
                        <td className="px-6 py-4">
                          <div
                            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${roleConfig.bgColor}`}
                          >
                            <RoleIcon className="w-4 h-4" />
                            <span className={`text-sm font-medium ${roleConfig.textColor}`}>
                              {roleConfig.label}
                            </span>
                          </div>
                        </td>

                        {/* Blood Type Column */}
                        <td className="px-6 py-4">
                          {user.role === "user" && user.bloodType ? (
                            <span className="text-sm font-semibold text-[#ef4444]">
                              {user.bloodType}
                            </span>
                          ) : (
                            <span className="text-[var(--text-secondary)]">—</span>
                          )}
                        </td>

                        {/* Status Column */}
                        <td className="px-6 py-4">
                          <div
                            className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${statusConfig.bgColor} ${statusConfig.textColor}`}
                          >
                            {statusConfig.label}
                          </div>
                        </td>

                        {/* Joined Date Column */}
                        <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">
                          {formatDate(user.createdAt)}
                        </td>

                        {/* Actions Column */}
                        <td className="px-6 py-4">
                          <div className="flex justify-center">
                            <ActionDropdown 
                              userId={user._id} 
                              userName={user.name}
                              user={user}
                              onViewProfile={handleViewProfile}
                              onEditRole={handleEditRole}
                              onBanUser={handleBanUser}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center">
                      <p className="text-[var(--text-secondary)]">
                        No users found matching your criteria.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer - Stats */}
          <div className="bg-[var(--background-color)] border-t border-[var(--border-color)] px-6 py-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Showing <span className="font-semibold">{filteredUsers.length}</span> of{" "}
              <span className="font-semibold">{users.length}</span> users
            </p>
          </div>
        </div>
          </>
        )}

        {/* Add User Modal */}
        <AddUserModal 
          isOpen={showAddUserModal}
          onClose={() => setShowAddUserModal(false)}
          onSubmit={handleAddUser}
        />

        {/* View Profile Modal */}
        <ViewProfileModal
          isOpen={!!viewProfileUser}
          onClose={() => setViewProfileUser(null)}
          user={viewProfileUser}
        />

        {/* Edit Role Modal */}
        <EditRoleModal
          isOpen={!!editRoleUser}
          onClose={() => setEditRoleUser(null)}
          user={editRoleUser}
          onSubmit={handleEditRoleSubmit}
        />

        {/* Ban User Modal */}
        <BanUserModal
          isOpen={!!banUserData}
          onClose={() => setBanUserData(null)}
          user={banUserData}
          onSubmit={handleBanUserSubmit}
        />
      </div>
    </div>
  );
};

export default UserManagementPage;
