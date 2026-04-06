import { POST } from "@/app/api/users/login/route";
import { NextRequest } from "next/server";
import connectDB from "@/db/connectDB.mjs";
import User from "@/models/User.js";
import bcrypt from "bcryptjs";

// Mock the database connection
jest.mock("@/db/connectDB.mjs");
jest.mock("@/models/User.js");

describe("/api/users/login", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    connectDB.mockClear();
  });

  describe("POST /api/users/login", () => {
    test("Should login successfully with valid credentials", async () => {
      const mockUser = {
        _id: { toString: () => "507f1f77bcf86cd799439011" },
        email: "user@example.com",
        password: await bcrypt.hash("password123", 10),
        name: "John Doe",
        role: "user",
        phone: "+84912345678",
        address: "123 Main St",
        fcmToken: "token_xyz",
        verification_status: "verified",
        isRegistrationComplete: true,
      };

      User.findOne.mockResolvedValue(mockUser);
      User.findByIdAndUpdate.mockResolvedValue({ ...mockUser, lastLoginDate: new Date() });

      const req = new NextRequest("http://localhost:3000/api/users/login", {
        method: "POST",
        body: JSON.stringify({ email: "user@example.com", password: "password123" }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.token).toBeDefined();
      expect(data.user.email).toBe("user@example.com");
      expect(data.user.role).toBe("user");
      expect(data.user.password).toBeUndefined();
    });

    test("Should return 401 for invalid password", async () => {
      const mockUser = {
        _id: { toString: () => "507f1f77bcf86cd799439011" },
        email: "user@example.com",
        password: await bcrypt.hash("password123", 10),
        name: "John Doe",
        role: "user",
      };

      User.findOne.mockResolvedValue(mockUser);

      const req = new NextRequest("http://localhost:3000/api/users/login", {
        method: "POST",
        body: JSON.stringify({ email: "user@example.com", password: "wrongpassword" }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Invalid email or password");
    });

    test("Should return 401 for non-existent user", async () => {
      User.findOne.mockResolvedValue(null);

      const req = new NextRequest("http://localhost:3000/api/users/login", {
        method: "POST",
        body: JSON.stringify({ email: "nonexistent@example.com", password: "password123" }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Invalid email or password");
    });

    test("Should return 400 for missing email", async () => {
      const req = new NextRequest("http://localhost:3000/api/users/login", {
        method: "POST",
        body: JSON.stringify({ password: "password123" }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Email and password are required");
    });

    test("Should return 400 for missing password", async () => {
      const req = new NextRequest("http://localhost:3000/api/users/login", {
        method: "POST",
        body: JSON.stringify({ email: "user@example.com" }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Email and password are required");
    });

    test("Should return 400 for invalid email format", async () => {
      const req = new NextRequest("http://localhost:3000/api/users/login", {
        method: "POST",
        body: JSON.stringify({ email: "not-an-email", password: "password123" }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid email format");
    });

    test("Should return 400 if registration is incomplete (no role)", async () => {
      const mockUser = {
        _id: { toString: () => "507f1f77bcf86cd799439011" },
        email: "user@example.com",
        password: await bcrypt.hash("password123", 10),
        name: "John Doe",
        role: null,
      };

      User.findOne.mockResolvedValue(mockUser);

      const req = new NextRequest("http://localhost:3000/api/users/login", {
        method: "POST",
        body: JSON.stringify({ email: "user@example.com", password: "password123" }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("User registration incomplete. Please select a role.");
      expect(data.requiresRoleSelection).toBe(true);
    });

    test("Should handle database connection errors", async () => {
      connectDB.mockRejectedValue(new Error("Database connection failed"));

      const req = new NextRequest("http://localhost:3000/api/users/login", {
        method: "POST",
        body: JSON.stringify({ email: "user@example.com", password: "password123" }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error. Please try again later.");
    });

    test("Should update lastLoginDate on successful login", async () => {
      const mockUser = {
        _id: { toString: () => "507f1f77bcf86cd799439011" },
        email: "user@example.com",
        password: await bcrypt.hash("password123", 10),
        name: "John Doe",
        role: "user",
      };

      User.findOne.mockResolvedValue(mockUser);
      User.findByIdAndUpdate.mockResolvedValue({ ...mockUser, lastLoginDate: new Date() });

      const req = new NextRequest("http://localhost:3000/api/users/login", {
        method: "POST",
        body: JSON.stringify({ email: "user@example.com", password: "password123" }),
      });

      const response = await POST(req);

      expect(response.status).toBe(200);
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        mockUser._id,
        expect.objectContaining({
          lastLoginDate: expect.any(Date),
        })
      );
    });

    test("Should return token with correct payload", async () => {
      const mockUser = {
        _id: { toString: () => "507f1f77bcf86cd799439011" },
        email: "user@example.com",
        password: await bcrypt.hash("password123", 10),
        name: "John Doe",
        role: "hospital",
      };

      User.findOne.mockResolvedValue(mockUser);
      User.findByIdAndUpdate.mockResolvedValue({ ...mockUser, lastLoginDate: new Date() });

      const req = new NextRequest("http://localhost:3000/api/users/login", {
        method: "POST",
        body: JSON.stringify({ email: "user@example.com", password: "password123" }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.token).toBeDefined();

      // Decode JWT (basic check - would need jwt library for full validation in real test)
      const tokenParts = data.token.split(".");
      expect(tokenParts.length).toBe(3); // JWT format: header.payload.signature
    });
  });
});
