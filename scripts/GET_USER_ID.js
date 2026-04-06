#!/usr/bin/env node

/**
 * Get Test User ID
 */

import connectDB from './db/connectDB.mjs';
import User from './models/User.js';

try {
  await connectDB();
  const user = await User.findOne({ email: 'emergency@test.com' });
  if (user) {
    console.log('User ID:', user._id.toString());
    process.exit(0);
  } else {
    console.log('User not found');
    process.exit(1);
  }
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
