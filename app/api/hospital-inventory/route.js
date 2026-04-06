import { NextResponse } from "next/server";
import connectDB from "@/db/connectDB.mjs";
import HospitalInventory from "@/models/HospitalInventory.js";
import HospitalInventoryLog from "@/models/HospitalInventoryLog.js";
import User from "@/models/User.js";
import { ensureHospitalVerified } from "@/lib/roleAuth";
import { getAuthToken } from "@/lib/authMiddleware";

// POST - Add new inventory item or update existing
export async function POST(req) {
  try {
    await connectDB();
    
    const token = await getAuthToken(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized - Please login or provide Bearer token' }, { status: 401 });
    }

    const userId = token.userId || token.sub;
    
    // Verify user is a hospital
    const user = await User.findById(userId);
    if (!user || user.role !== 'hospital') {
      return NextResponse.json({ error: 'Access denied. Hospital role required.' }, { status: 403 });
    }

    // Ensure hospital is verified per SOP12
    const hv = await ensureHospitalVerified(userId);
    if (!hv.success) {
      return NextResponse.json({ error: hv.error, verification_status: hv.verification_status, notes: hv.notes }, { status: hv.status });
    }

    const data = await req.json();
    const { 
      blood_type, 
      units_available, 
      expiry_date, 
      batch_number,
      minimum_stock_level,
      maximum_capacity,
      action = 'received'
    } = data;

    // Convert empty strings to null for ObjectId fields
    const cleanBatchNumber = batch_number && batch_number.trim() !== '' ? batch_number : null;

    // Validate required fields
    if (!blood_type || units_available === undefined || !expiry_date) {
      return NextResponse.json({ 
        error: 'Missing required fields: blood_type, units_available, expiry_date' 
      }, { status: 400 });
    }

    // Validate units is a non-negative number
    if (units_available < 0) {
      return NextResponse.json({ error: "Units available must be a non-negative number" }, { status: 400 });
    }

    // Validate expiry date is in the future
    const expiryDateObj = new Date(expiry_date);
    if (isNaN(expiryDateObj) || expiryDateObj <= new Date()) {
      return NextResponse.json({ error: "Expiry date must be a valid future date" }, { status: 400 });
    }

    // Check if inventory item already exists for this blood type
    const existingItem = await HospitalInventory.findOne({
      hospital_id: userId,
      blood_type,
      batch_number: cleanBatchNumber,
      status: 'available'
    });

    let inventoryItem;
    let logAction = action;
    let unitsChanged = parseInt(units_available);
    let unitsBefore = 0;

    if (existingItem) {
      // Update existing item
      unitsBefore = existingItem.units_available;
      existingItem.units_available += parseInt(units_available);
      
      if (minimum_stock_level !== undefined) {
        existingItem.minimum_stock_level = minimum_stock_level;
      }
      if (maximum_capacity !== undefined) {
        existingItem.maximum_capacity = maximum_capacity;
      }
      
      inventoryItem = await existingItem.save();
      logAction = 'received';
    } else {
      // Create new inventory item
      inventoryItem = await HospitalInventory.create({
        hospital_id: userId,
        blood_type,
        units_available: parseInt(units_available),
        expiry_date: expiryDateObj,
        batch_number,
        minimum_stock_level: minimum_stock_level || 5,
        maximum_capacity: maximum_capacity || 100
      });
    }

    // Log the inventory change
    await HospitalInventoryLog.create({
      hospital_id: userId,
      blood_type,
      action: logAction,
      units_changed: unitsChanged,
      units_before: unitsBefore,
      units_after: inventoryItem.units_available,
      batch_number,
      expiry_date: expiryDateObj,
      performed_by: userId,
      notes: `${logAction === 'received' ? 'Added' : 'Updated'} inventory via hospital management`
    });

    return NextResponse.json({
      success: true,
      message: existingItem ? 'Inventory updated successfully' : 'Inventory item added successfully',
      item: inventoryItem
    });

  } catch (error) {
    console.error("Error managing hospital inventory:", error);
    return NextResponse.json({ error: 'Failed to manage inventory' }, { status: 500 });
  }
}

// GET - Fetch hospital inventory
export async function GET(req) {
  try {
    await connectDB();
    
    const token = await getAuthToken(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized - Please login or provide Bearer token' }, { status: 401 });
    }

    const userId = token.userId || token.sub;
    
    // Verify user is a hospital
    const user = await User.findById(userId);
    if (!user || user.role !== 'hospital') {
      return NextResponse.json({ error: 'Access denied. Hospital role required.' }, { status: 403 });
    }

    // Get all inventory items for this hospital
    const inventory = await HospitalInventory.find({ 
      hospital_id: userId,
      status: { $in: ['available', 'reserved'] }
    })
    .sort({ blood_type: 1, expiry_date: 1 });

    // Calculate summary statistics
    const summary = {
      totalUnits: 0,
      reservedUnits: 0,
      bloodTypes: {},
      lowStockAlerts: [],
      expiringItems: []
    };

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    inventory.forEach(item => {
      summary.totalUnits += item.units_available;
      summary.reservedUnits += item.units_reserved;
      
      // Group by blood type
      if (!summary.bloodTypes[item.blood_type]) {
        summary.bloodTypes[item.blood_type] = {
          available: 0,
          reserved: 0,
          items: 0
        };
      }
      
      summary.bloodTypes[item.blood_type].available += item.units_available;
      summary.bloodTypes[item.blood_type].reserved += item.units_reserved;
      summary.bloodTypes[item.blood_type].items += 1;

      // Check for low stock alerts
      if (item.units_available <= item.minimum_stock_level) {
        summary.lowStockAlerts.push({
          bloodType: item.blood_type,
          currentUnits: item.units_available,
          minimumLevel: item.minimum_stock_level,
          itemId: item._id
        });
      }

      // Check for expiring items
      if (item.expiry_date <= sevenDaysFromNow) {
        summary.expiringItems.push({
          bloodType: item.blood_type,
          units: item.units_available,
          expiryDate: item.expiry_date,
          daysUntilExpiry: Math.ceil((item.expiry_date - now) / (24 * 60 * 60 * 1000)),
          itemId: item._id
        });
      }
    });

    return NextResponse.json({
      success: true,
      inventory,
      summary
    });

  } catch (error) {
    console.error("Error fetching hospital inventory:", error);
    return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
  }
}

// PUT - Update inventory item (use, reserve, etc.)
export async function PUT(req) {
  console.log('\n🚀 PUT /api/hospital-inventory - Request started');
  
  try {
    console.log('📡 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected');
    
    const token = await getAuthToken(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized - Please login or provide Bearer token' }, { status: 401 });
    }

    const userId = token.userId || token.sub;
    
    // Verify user is a hospital
    const user = await User.findById(userId);
    if (!user || user.role !== 'hospital') {
      return NextResponse.json({ error: 'Access denied. Hospital role required.' }, { status: 403 });
    }

    // Ensure hospital is verified per SOP12
    const hv = await ensureHospitalVerified(userId);
    if (!hv.success) {
      return NextResponse.json({ error: hv.error, verification_status: hv.verification_status, notes: hv.notes }, { status: hv.status });
    }

    const data = await req.json();
    const { 
      itemId, 
      action, 
      units, 
      patient_id, 
      notes 
    } = data;

    console.log('🔍 API PUT Hospital Inventory - Received payload:', {
      itemId,
      action,
      units,
      unitsType: typeof units,
      patient_id,
      notesPreview: notes?.substring(0, 50)
    });

    if (!itemId || !action || units === undefined || units === null) {
      console.error('❌ API PUT - Validation failed - Missing required fields');
      return NextResponse.json({ 
        error: 'Missing required fields: itemId, action, units' 
      }, { status: 400 });
    }
    
    // Convert units to number
    const unitsNumber = typeof units === 'string' ? parseInt(units, 10) : units;
    if (isNaN(unitsNumber) || unitsNumber <= 0) {
      console.error('❌ API PUT - Invalid units value:', units);
      return NextResponse.json({ 
        error: 'Units must be a positive number' 
      }, { status: 400 });
    }

    console.log('🔍 API PUT - Looking for inventory item:', { itemId, userId });
    
    const inventoryItem = await HospitalInventory.findOne({
      _id: itemId,
      hospital_id: userId
    });

    if (!inventoryItem) {
      console.error('❌ API PUT - Inventory item not found:', { itemId, userId });
      return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 });
    }
    
    console.log('✅ API PUT - Found inventory item:', {
      bloodType: inventoryItem.blood_type,
      unitsAvailable: inventoryItem.units_available,
      action: action
    });

    const unitsBefore = inventoryItem.units_available;
    const reservedBefore = inventoryItem.units_reserved;
    let unitsChanged = 0;
    let logAction = action;

    switch (action) {
      case 'use':
        console.log('⚕️ API PUT - Processing USE action:', {
          requestedUnits: unitsNumber,
          availableUnits: inventoryItem.units_available
        });
        
        if (inventoryItem.units_available < unitsNumber) {
          console.error('❌ API PUT - Insufficient units for USE action');
          return NextResponse.json({ error: 'Insufficient units available' }, { status: 400 });
        }
        inventoryItem.units_available -= unitsNumber;
        unitsChanged = -unitsNumber;
        logAction = 'used';
        console.log('✅ API PUT - Units deducted successfully:', {
          before: unitsBefore,
          after: inventoryItem.units_available,
          deducted: unitsNumber
        });
        break;

      case 'reserve':
        console.log('🔄 API PUT - Processing RESERVE action:', { requestedUnits: unitsNumber });
        if (inventoryItem.units_available < unitsNumber) {
          return NextResponse.json({ error: 'Insufficient units available for reservation' }, { status: 400 });
        }
        inventoryItem.units_available -= unitsNumber;
        inventoryItem.units_reserved += unitsNumber;
        unitsChanged = -unitsNumber;
        logAction = 'reserved';
        break;

      case 'unreserve':
        console.log('🔄 API PUT - Processing UNRESERVE action:', { requestedUnits: unitsNumber });
        if (inventoryItem.units_reserved < unitsNumber) {
          return NextResponse.json({ error: 'Insufficient reserved units' }, { status: 400 });
        }
        inventoryItem.units_reserved -= unitsNumber;
        inventoryItem.units_available += unitsNumber;
        unitsChanged = unitsNumber;
        logAction = 'unreserved';
        break;

      case 'expire':
        inventoryItem.status = 'expired';
        unitsChanged = -inventoryItem.units_available;
        inventoryItem.units_available = 0;
        logAction = 'expired';
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    console.log('💾 API PUT - Saving inventory item...');
    try {
      await inventoryItem.save();
      console.log('✅ API PUT - Inventory item saved successfully');
    } catch (saveErr) {
      console.error('❌ API PUT - Error saving inventory item:', saveErr.message);
      throw new Error(`Failed to save inventory changes: ${saveErr.message}`);
    }

    // Log the inventory change
    console.log('📝 API PUT - Creating activity log:', {
      action: logAction,
      unitsChanged: unitsChanged,
      unitsBefore: unitsBefore,
      unitsAfter: inventoryItem.units_available
    });
    
    try {
      await HospitalInventoryLog.create({
        hospital_id: userId,
        blood_type: inventoryItem.blood_type,
        action: logAction,
        units_changed: unitsChanged,
        units_before: unitsBefore,
        units_after: inventoryItem.units_available,
        patient_id,
        batch_number: inventoryItem.batch_number,
        expiry_date: inventoryItem.expiry_date,
        performed_by: userId,
        notes: notes || `${action} operation via hospital management`
      });
      console.log('✅ API PUT - Activity log created successfully');
    } catch (logErr) {
      console.error('⚠️ Warning: Failed to create activity log:', logErr.message);
      // Don't throw - inventory was already updated, just log warning
    }

    const successResponse = {
      success: true,
      message: `Inventory ${action} completed successfully`,
      item: inventoryItem
    };
    console.log('\n📤 PUT /api/hospital-inventory - Returning SUCCESS response');
    
    return NextResponse.json(successResponse, { 
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    });

  } catch (error) {
    console.error('\n❌ PUT /api/hospital-inventory - CATCH BLOCK TRIGGERED');
    console.error('Error Object:', error);
    console.error('Error Type:', typeof error);
    console.error('Error Constructor:', error?.constructor?.name);
    console.error('Error.message:', error?.message);
    console.error('Error.name:', error?.name);
    console.error('Error.stack:', error?.stack);
    
    // Extract error information with fallbacks
    let errorMessage = 'Failed to update inventory';
    let errorDetails = 'An unexpected error occurred';
    let errorType = 'UnknownError';
    let errorCode = null;
    
    // Try multiple ways to extract error message
    if (error?.message && error.message !== '') {
      errorMessage = error.message;
      errorDetails = error.message;
    } else if (error?.toString?.()) {
      const errorStr = error.toString();
      if (errorStr !== '[object Object]') {
        errorMessage = errorStr;
        errorDetails = errorStr;
      }
    } else if (typeof error === 'string') {
      errorMessage = error;
      errorDetails = error;
    }
    
    // Get error type
    if (error?.name) {
      errorType = error.name;
    } else if (error?.constructor?.name) {
      errorType = error.constructor.name;
    }
    
    // Get error code if available
    if (error?.code) {
      errorCode = error.code;
    }
    
    // Build comprehensive error response
    const errorResponse = {
      success: false,
      error: errorMessage,
      message: errorMessage,
      details: errorDetails,
      type: errorType,
      code: errorCode,
      timestamp: new Date().toISOString()
    };
    
    console.error('📤 Returning error response:', errorResponse);
    
    return NextResponse.json(errorResponse, { 
      status: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
  }
}

// DELETE - Remove inventory item
export async function DELETE(req) {
  try {
    await connectDB();
    
    const token = await getAuthToken(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized - Please login or provide Bearer token' }, { status: 401 });
    }

    const userId = token.userId || token.sub;
    
    // Verify user is a hospital
    const user = await User.findById(userId);
    if (!user || user.role !== 'hospital') {
      return NextResponse.json({ error: 'Access denied. Hospital role required.' }, { status: 403 });
    }
    // Ensure hospital is verified per SOP12
    const hv = await ensureHospitalVerified(userId);
    if (!hv.success) {
      return NextResponse.json({ error: hv.error, verification_status: hv.verification_status, notes: hv.notes }, { status: hv.status });
    }

    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get('id');

    if (!itemId) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    const inventoryItem = await HospitalInventory.findOne({
      _id: itemId,
      hospital_id: userId
    });

    if (!inventoryItem) {
      return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 });
    }

    // Log the deletion
    await HospitalInventoryLog.create({
      hospital_id: userId,
      blood_type: inventoryItem.blood_type,
      action: 'deleted',
      units_changed: -inventoryItem.units_available,
      units_before: inventoryItem.units_available,
      units_after: 0,
      batch_number: inventoryItem.batch_number,
      expiry_date: inventoryItem.expiry_date,
      performed_by: userId,
      notes: 'Inventory item deleted via hospital management'
    });

    await HospitalInventory.findByIdAndDelete(itemId);

    return NextResponse.json({
      success: true,
      message: 'Inventory item deleted successfully'
    });

  } catch (error) {
    console.error("Error deleting hospital inventory:", error);
    return NextResponse.json({ error: 'Failed to delete inventory item' }, { status: 500 });
  }
}
