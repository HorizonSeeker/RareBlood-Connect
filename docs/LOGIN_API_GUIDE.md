# Login API Testing Guide

## Endpoint: `POST /api/users/login`

Login endpoint for user authentication with JWT token generation.

---

## Request Format

```json
{
  "email": "user@example.com",
  "password": "YourPassword123"
}
```

---

## Success Response (200 OK)

```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "phone": "+84912345678",
    "address": "123 Main St",
    "fcmToken": "token_xyz",
    "verification_status": "verified",
    "isRegistrationComplete": true
  }
}
```

---

## Error Responses

### 1. Invalid Email or Password (401 Unauthorized)
```json
{
  "error": "Invalid email or password"
}
```

### 2. Missing Required Fields (400 Bad Request)
```json
{
  "error": "Email and password are required"
}
```

### 3. Invalid Email Format (400 Bad Request)
```json
{
  "error": "Invalid email format"
}
```

### 4. Registration Incomplete (400 Bad Request)
```json
{
  "error": "User registration incomplete. Please select a role.",
  "userId": "507f1f77bcf86cd799439011",
  "requiresRoleSelection": true
}
```

### 5. Internal Server Error (500)
```json
{
  "error": "Internal server error. Please try again later."
}
```

---

## cURL Examples

### Valid Login
```bash
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "YourPassword123"
  }'
```

### Missing Password
```bash
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": ""
  }'
```

### Wrong Email
```bash
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nonexistent@example.com",
    "password": "SomePassword123"
  }'
```

### Invalid Email Format
```bash
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "not-an-email",
    "password": "YourPassword123"
  }'
```

---

## Using JWT Token

After successful login, use the token in subsequent requests:

```bash
curl -X GET http://localhost:3000/api/some-protected-route \
  -H "Authorization: Bearer $TOKEN"
```

Or in JavaScript:

```javascript
const response = await fetch('/api/users/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    email: 'user@example.com', 
    password: 'password123' 
  })
});

const data = await response.json();
if (data.success) {
  localStorage.setItem('token', data.token);
  // Use token for authenticated requests
  const authResponse = await fetch('/api/protected-route', {
    headers: { 'Authorization': `Bearer ${data.token}` }
  });
}
```

---

## Features

✅ **Email & Password Validation** - Checks required fields and email format  
✅ **Secure Password Comparison** - Uses bcrypt to compare hashed passwords  
✅ **JWT Token Generation** - Token expires in 7 days  
✅ **Last Login Tracking** - Updates `lastLoginDate` on successful login  
✅ **Registration Status Check** - Ensures user has selected a role  
✅ **Secure Error Messages** - No password leaking in responses  
✅ **Logging** - Logs successful/failed login attempts  
✅ **Database Connection** - Auto-connects to MongoDB  

---

## Security Considerations

1. **Password Hashing**: Passwords are never returned in responses
2. **Email Case-Insensitive**: Emails are converted to lowercase for consistency
3. **Generic Error Messages**: "Invalid email or password" doesn't reveal which is wrong
4. **JWT Expiration**: Tokens expire after 7 days
5. **HTTPS Only**: Should be used with HTTPS in production
6. **Rate Limiting**: Consider adding rate limiting to prevent brute force attacks

---

## Related Endpoints

- `POST /api/users/register` - User registration
- `POST /api/auth/signin` - NextAuth signin
- `POST /api/auth/refresh` - Token refresh
- `POST /api/users/logout` - User logout (if implemented)
- `POST /api/users/reset-password` - Password reset (if implemented)

---

## Environment Variables Required

Make sure these variables are set in `.env.local`:

```
NEXTAUTH_SECRET=your_jwt_secret_key
MONGODB_URI=your_mongodb_connection_string
NODE_ENV=development
```

The JWT will use `NEXTAUTH_SECRET` for signing. If not provided, it defaults to 'your_jwt_secret_key'.
