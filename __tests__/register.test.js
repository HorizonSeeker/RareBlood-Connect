import { POST } from "@/app/api/users/register/route"; // Gọi hàm xử lý của API
import { createMocks } from "node-mocks-http";
import User from "@/models/User";

// Giả lập (Mock) database để không kết nối vào DB thật khi test
jest.mock("@/db/connectDB", () => jest.fn());
jest.mock("@/models/User");

describe("Register API Unit Test", () => {
  
  // Test case 1: Kiểm tra lỗi khi thiếu thông tin (Validation)
  it("Nên trả về lỗi 400 nếu thiếu mật khẩu", async () => {
    // 1. Giả lập dữ liệu gửi lên bị thiếu password
    const body = {
      name: "Test User",
      email: "test@gmail.com",
      role: "user"
      // Cố tình không điền password
    };

    const req = {
      json: async () => body,
    };

    // 2. Gọi hàm POST
    const res = await POST(req);
    
    // 3. Mong đợi kết quả là lỗi 400
    expect(res.status).toBe(400);
  });

  // Test case 2: Kiểm tra đăng ký thành công
  it("Nên trả về 201 nếu đăng ký thành công", async () => {
    // 1. Giả lập dữ liệu đầy đủ
    const body = {
      name: "Unit Test User",
      age: 20,
      blood_type: "O+",
      mobile_number: "0999888777",
      email: "unit@test.com",
      role: "user",
      password: "password123",
    };

    // Giả lập database trả về kết quả tốt
    User.findOne.mockResolvedValue(null); // Chưa có ai trùng email
    User.create.mockResolvedValue(body);  // Tạo thành công

    const req = {
      json: async () => body,
    };

    // 2. Gọi hàm POST
    const res = await POST(req);

    // 3. Mong đợi kết quả là 201 (Created)
    expect(res.status).toBe(201);
  });
});