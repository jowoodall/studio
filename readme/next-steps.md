
# Next Steps for Development

This document outlines the key features and improvements to focus on next for the RydzConnect application.

### 1. Refine the Ryd Request & Fulfillment Flow
The core user journey of requesting and offering a ryd needs to be polished.
- **Group Ryd Requests:** Allow a parent or student to select multiple managed students when creating a single ryd request.
- **Driver Information:** When a driver views a ryd request, provide them with an estimated route or distance to help them decide if they can fulfill it.
- **UI Clarity:** Enhance the "Upcoming Rydz" page to clearly differentiate between rydz the user is driving versus those they are a passenger in.

### 2. Build Out Core Group Functionality
Groups are central to the app, and their functionality needs to be completed.
- **Private Rydz:** Allow a driver to offer a ryd that is only visible to members of a specific, selected group.
- **Member Management:** Implement the server logic for a user to leave a group, and for a group admin to remove a member.
- **Invitation System:** Create a notification for users when they are invited to join a group, which they can accept or decline.

### 3. Implement Real-Time Messaging
The messaging UI is currently static. The next steps are to make it functional.
- **Ryd-Specific Chat:** Automatically create a temporary message channel for the driver and all confirmed passengers of an active ryd.
- **Real-Time Updates:** Use Firestore listeners to update chat messages in real-time without needing to refresh the page.
- **Unread Indicators:** Add UI elements to show when a user has unread messages.

### 4. Enhance the Dashboard and Live Tracking
Improve the main dashboard and make the tracking page dynamic.
- **"My Next Ryd" Logic:** Implement the logic for the dashboard card to find and display the user's most imminent ryd, whether they are the driver or a passenger.
- **Live Driver Location:** On the `/rydz/tracking/[rideId]` page, replace the static map with one that can show a driver's live location. This will require a mechanism for the driver's app to periodically send their coordinates.

### 5. Implement a Notification System
The current notifications page is static. It needs to be made dynamic and integrated throughout the app.
- **Centralized Notification Feed:** Build the `/notifications` page to display a real-time feed of events relevant to the user (e.g., ryd requests, approvals, group invites, event reminders).
- **Unread Indicators:** Add a badge or indicator to the main navigation to show when a user has unread notifications.
- **Email/Push Notifications (Future):** Lay the groundwork for sending out-of-app notifications for critical events, like a ryd starting soon or a last-minute cancellation.
