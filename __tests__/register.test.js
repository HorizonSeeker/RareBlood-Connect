import { POST } from "@/app/api/users/register/route"; // Call API handler function
import { createMocks } from "node-mocks-http";
import User from "@/models/User";

// Mock database so tests don't hit the real DB
jest.mock("@/db/connectDB", () => jest.fn());
jest.mock("@/models/User");
jest.mock("@/models/HospitalProfile", () => ({
  findOne: jest.fn(),
  create: jest.fn()
}));


describe("Register API Unit Test", () => {
  
  // Test case 1: Check validation error when information is missing
  it("should return 400 when password is missing", async () => {
    // 1. Mock request body missing password
    const body = {
      name: "Test User",
      email: "test@gmail.com",
      role: "user"
      // Intentionally not setting password
    };

    const req = {
      json: async () => body,
    };

    // 2. Call POST handler
    const res = await POST(req);
    
    // 3. Expect a 400 error
    expect(res.status).toBe(400);
  });

  // Test case 2: Check successful registration
  it("should return 201 on successful registration", async () => {
    // 1. Mock a full request body
    const body = {
      name: "Unit Test User",
      age: 20,
      blood_type: "O+",
      mobile_number: "0999888777",
      email: "unit@test.com",
      role: "user",
      password: "password123",
    };

    // Mock database to return successful result
    User.findOne.mockResolvedValue(null); // No duplicate email user exists
    User.create.mockResolvedValue(body);  // Create successfully

    const req = {
      json: async () => body,
    };

    // Call POST handler
    const res = await POST(req);

    // Expect result to be 201 (Created)
    expect(res.status).toBe(201);
  });

  // Test case 3: Hospital registration creates user and hospital profile
  it("should create user and hospital profile when role is hospital", async () => {
    const body = {
      name: "My Hospital",
      address: "123 Street",
      latitude: "10",
      longitude: "20",
      contact_number: "012345",
      email: "hospital@test.com",
      role: "hospital",
      password: "securepass"
    };

    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({ _id: 'user123', email: body.email, role: body.role });

    const HospitalProfile = require("@/models/HospitalProfile");
    HospitalProfile.findOne.mockResolvedValue(null);
    HospitalProfile.create.mockResolvedValue({ _id: 'profile123' });

    const req = { json: async () => body };
    const res = await POST(req);

    expect(res.status).toBe(201);
  });
});