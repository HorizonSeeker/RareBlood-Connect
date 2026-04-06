import connectDB from '@/db/connectDB.mjs';
import mongoose from 'mongoose';
import Doner from '@/models/Doner.js';
import DonorContactRequest from '@/models/DonorContactRequest.js';
import HospitalRequest from '@/models/HospitalRequest.js';
import User from '@/models/User.js';
import { NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/authMiddleware';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET - Fetch a single hospital request by ID
export async function GET(req, { params }) {
  try {
    await connectDB();
    
    const { id } = params;
    
    // Validate the ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid request ID format' },
        { status: 400 }
      );
    }

    // Fetch the specific hospital request
    const request = await HospitalRequest.findById(id)
      .populate('hospital_id', 'name email address')
      .populate('bloodbank_id', 'name email')
      .populate('responded_by', 'name email')
      .lean();

    if (!request) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      );
    }

    // Populate responders with donor details
    if (request.responders && request.responders.length > 0) {
      const populatedResponders = [];
      for (let responder of request.responders) {
        try {
          const donor = await Doner.findOne({ user_id: responder.donorId });
          const user = await User.findById(responder.donorId);
          populatedResponders.push({
            donorId: {
              _id: user?._id,
              name: user?.name,
              email: user?.email
            },
            donor: {
              blood_type: donor?.blood_type,
              phone: donor?.mobile_number
            },
            respondedAt: responder.respondedAt
          });
        } catch (responderErr) {
          console.error(`Error populating responder ${responder.donorId}:`, responderErr);
        }
      }
      request.responders = populatedResponders;
    }

    // Populate SOS donor details if available
    try {
      if (request.sos_broadcasted?.database_records_created >= 0 && 
          request.sos_broadcasted?.database_records_created > 0) {
        
        // Fetch SOS donor contact requests
        let donorContactRequests = await DonorContactRequest.find({ 
          requestId: id 
        });

        // Fallback if no direct match
        if (donorContactRequests.length === 0) {
          const broadcastTime = new Date(request.sos_broadcasted.broadcasted_at);
          const timeWindowStart = new Date(broadcastTime.getTime() - 15 * 60 * 1000); 
          const timeWindowEnd = new Date(broadcastTime.getTime() + 15 * 60 * 1000);

          donorContactRequests = await DonorContactRequest.find({
            hospitalId: request.hospital_id,
            bloodType: request.blood_type,
            createdAt: { $gte: timeWindowStart, $lte: timeWindowEnd }
          }).limit(200);
        }

        // Populate each donor
        const populatedDonors = [];
        for (let dcr of donorContactRequests) {
          try {
            const donorIdObj = dcr.donorId instanceof mongoose.Types.ObjectId ? 
              dcr.donorId : 
              new mongoose.Types.ObjectId(dcr.donorId);
            
            const donor = await Doner.findById(donorIdObj)
              .populate('user_id', 'name email phone');

            if (donor && donor.user_id) {
              populatedDonors.push({
                _id: donor._id,
                name: donor.user_id?.name || 'Unknown',
                email: donor.user_id?.email,
                phone: donor.mobile_number || donor.user_id?.phone,
                blood_type: donor.blood_type,
                response_status: dcr.status,
                contactedAt: dcr.createdAt
              });
            }
          } catch (popErr) {
            console.error(`Error populating donor ${dcr.donorId}:`, popErr.message);
          }
        }

        request.sos_donor_details = populatedDonors;
      } else {
        request.sos_donor_details = [];
      }
    } catch (sosErr) {
      console.error(`Error fetching SOS donor details for request ${id}:`, sosErr);
      request.sos_donor_details = [];
    }

    return NextResponse.json({
      success: true,
      request
    });

  } catch (error) {
    console.error(`[ERROR] Failed to fetch hospital request:`, error);
    
    if (error?.name === 'MongoNetworkError' || error?.name === 'MongoServerSelectionError') {
      return NextResponse.json(
        { 
          error: 'Database connection failed',
          errorCode: 'DB_CONNECTION_FAILED'
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to fetch request',
        errorCode: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}
