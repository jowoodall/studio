# MyRydz Parental Controls & Driver Approvals

This document explains how parents and students can link their accounts and how the driver approval system works to ensure student safety.

## Linking Parent and Student Accounts

For parental controls to work, a parent's account must be linked to a student's account. This can be initiated by either the parent or the student from their Profile page.

**From the Parent's Profile:**
1.  Log in as a Parent.
2.  Navigate to the `/profile` page.
3.  In the "Manage My Students" section, enter the email address of the student's MyRydz account.
4.  Click "Add Student".
5.  This sends an association request, and upon success, the student will appear in your list of managed students.

**From the Student's Profile:**
1.  Log in as a Student.
2.  Navigate to the `/profile` page.
3.  In the "My Parents/Guardians" section, enter the email address of the parent's MyRydz account.
4.  Click "Add Parent/Guardian".
5.  This links the accounts, and the parent will now be able to manage your ryd approvals.

## The Driver Approval Workflow

The core of the safety system is the driver approval workflow.

### How an Approval is Triggered

An approval request is automatically generated whenever a student attempts to join a ryd with a driver who has not been pre-approved by their linked parent.

-   **Scenario**: A student finds a ryd offer for their event and clicks "Request to Join".
-   **System Check**: The system checks if the student has a linked parent.
-   **Approval Check**: If so, it checks the parent's list of `approvedDrivers`.
-   **Action**: If the driver is NOT on the approved list, the request status becomes `PENDING_PARENT_APPROVAL`, and a notification is sent to the parent. The request does **not** go to the driver at this stage.

### How a Parent Approves or Rejects a Request

Parents manage all pending requests from the **Parental Controls** page.

1.  Navigate to `/parent/approvals`.
2.  In the "Pending Driver Requests" section, you will see a card for each request.
3.  Each card shows the Driver's name, the Student's name, and the Ryd details.
4.  You have three options:
    *   **Reject**: Declines the request for this ryd. The driver is not notified. You may also add them to a "declined" list to prevent future requests.
    *   **Approve Once**: Approves the driver for this specific ryd only. The request is then forwarded to the driver for their final confirmation.
    *   **Approve & Add**: Approves the driver for this ryd AND adds them to your permanent "Approved Drivers" list for that student. Future rydz with this driver will not require your approval.

## Managing Your Driver Lists

Parents can proactively manage their lists of approved and declined drivers without waiting for a request.

-   **Go to the Parental Controls page** (`/parent/approvals`).
-   You will see tabs for your "Approved Driver List" and "Declined Driver List".
-   You can **add a new driver** to your approved list by entering their email address.
-   You can **remove a driver** from either list at any time. Removing a driver from the approved list means that future ryd requests with them will require your manual approval again.
