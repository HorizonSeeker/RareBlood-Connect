import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/db/connectDB.mjs';
import DonorContactRequest from '@/models/DonorContactRequest.js';
import Donor from '@/models/Doner.js';
import User from '@/models/User.js';
import Donation from '@/models/Donation.js';

/**
 * POST /api/donors/[id]/contact-request-action
 * 
 * Handle donor contact request actions:
 * - accept: Accept the contact request
 * - reject: Reject the contact request
 * - confirm: Confirm donation completed
 * - noshow: Mark donor as no-show
 */

export async function POST(request, { params }) {
  try {
    await connectDB();
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await request.json();
    const donorId = params.id;

    if (!['accept', 'reject', 'confirm', 'noshow'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Get requester info
    const requester = await User.findOne({ email: session.user.email });
    if (!requester) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get donor info
    const donor = await Donor.findById(donorId);
    if (!donor) {
      return NextResponse.json({ error: 'Donor not found' }, { status: 404 });
    }

    // Find the latest pending contact request from this requester to this donor
    const contactRequest = await DonorContactRequest.findOne({
      requesterId: requester._id,
      donorId: donorId,
      status: { $in: ['pending', 'accepted'] }
    }).sort({ createdAt: -1 });

    if (!contactRequest) {
      return NextResponse.json(
        { error: 'No pending contact request found' },
        { status: 404 }
      );
    }

    // Handle different actions
    let updatedRequest;
    switch (action) {
      case 'accept':
        if (contactRequest.status !== 'pending') {
          return NextResponse.json(
            { error: 'Can only accept pending requests' },
            { status: 400 }
          );
        }
        updatedRequest = await DonorContactRequest.findByIdAndUpdate(
          contactRequest._id,
          { 
            status: 'accepted',
            responseDate: new Date(),
            acceptedAt: new Date()
          },
          { new: true }
        );
        console.log(`✅ Contact request accepted for donor ${donorId}`);
        break;

      case 'reject':
        if (contactRequest.status !== 'pending') {
          return NextResponse.json(
            { error: 'Can only reject pending requests' },
            { status: 400 }
          );
        }
        updatedRequest = await DonorContactRequest.findByIdAndUpdate(
          contactRequest._id,
          { 
            status: 'rejected',
            responseDate: new Date(),
            rejectedAt: new Date()
          },
          { new: true }
        );
        console.log(`❌ Contact request rejected for donor ${donorId}`);
        break;

      case 'confirm':
        if (contactRequest.status !== 'accepted') {
          return NextResponse.json(
            { error: 'Can only confirm accepted requests' },
            { status: 400 }
          );
        }
        updatedRequest = await DonorContactRequest.findByIdAndUpdate(
          contactRequest._id,
          { 
            status: 'completed',
            completedAt: new Date()
          },
          { new: true }
        );

        // Create donation record
        try {
          const donation = await Donation.create({
            donor_id: donor._id,
            donation_date: new Date(),
            blood_type: contactRequest.bloodType,
            status: 'completed',
            units_collected: 1,
            notes: contactRequest.message || ''
          });

          // Update donor stats
          await Donor.findByIdAndUpdate(
            donorId,
            {
              $inc: { total_donations: 1, accepted_requests: 1 }
            }
          );

          console.log(`✅ Donation confirmed and recorded for donor ${donorId}`);
        } catch (donationErr) {
          console.error('⚠️ Failed to create donation record:', donationErr);
          // Continue - request marked as completed even if donation record fails
        }
        break;

      case 'noshow':
        if (contactRequest.status !== 'accepted') {
          return NextResponse.json(
            { error: 'Can only mark as no-show for accepted requests' },
            { status: 400 }
          );
        }
        updatedRequest = await DonorContactRequest.findByIdAndUpdate(
          contactRequest._id,
          { 
            status: 'no-show',
            noShowAt: new Date()
          },
          { new: true }
        );
        console.log(`⚠️ Donor marked as no-show for donor ${donorId}`);
        break;
    }

    return NextResponse.json({
      success: true,
      action: action,
      message: `Action '${action}' completed successfully`,
      request: updatedRequest
    });

  } catch (error) {
    console.error(`❌ Error handling donor action:`, error);
    return NextResponse.json(
      { error: 'Failed to process action', details: error.message },
      { status: 500 }
    );
  }
}
