# MyRydz Application Testing Scripts

This document outlines a series of user stories and test cases to manually verify the core functionality of the MyRydz application.

---

## 1. User Authentication

### Story 1.1: New Parent Signup
- **As a** new user,
- **I want to** sign up for a Parent account,
- **So that** I can start managing my students' rydz.

**Steps to Test:**
1. Navigate to the `/signup` page.
2. Enter a full name, a new email address, and a password (at least 8 characters).
3. Select "Parent or Guardian" from the role dropdown.
4. Click "Create Account".

**Expected Result:**
- The user is successfully authenticated.
- A new user document is created in the `users` collection in Firestore with `role: 'parent'`.
- The user is redirected to the `/dashboard`.

---

### Story 1.2: New Student Signup
- **As a** new user,
- **I want to** sign up for a Student account,
- **So that** I can request and join rydz.

**Steps to Test:**
1. Navigate to the `/signup` page.
2. Enter a full name, a new email address, and a password (at least 8 characters).
3. Select "Student" from the role dropdown.
4. Click "Create Account".

**Expected Result:**
- The user is successfully authenticated.
- A new user document is created in the `users` collection in Firestore with `role: 'student'`.
- The user is redirected to the `/dashboard`.

---

### Story 1.3: User Login
- **As an** existing user,
- **I want to** log in,
- **So that** I can access my account.

**Steps to Test:**
1. Navigate to the `/login` page.
2. Enter the email and password for a pre-existing account.
3. Click "Log In".

**Expected Result:**
- The user is successfully logged in and redirected to the `/dashboard`.

---

## 2. Parent-Student Association

### Story 2.1: Parent Associates a Student
- **As a** Parent,
- **I want to** link my student's account to mine,
- **So that** I can manage their ryd approvals.

**Setup:**
- A Parent account exists.
- A Student account exists with a different email.

**Steps to Test:**
1. Log in as the Parent.
2. Navigate to the `/profile` page.
3. In the "Manage My Students" section, enter the Student's email address.
4. Click "Add Student".

**Expected Result:**
- A toast notification confirms the student has been linked.
- The student's name appears in the "My Managed Students" list.
- In Firestore, the parent's `managedStudentIds` array should contain the student's UID.
- The student's `associatedParentIds` array should contain the parent's UID.

---

### Story 2.2: Student Associates a Parent
- **As a** Student,
- **I want to** link my parent's account to mine,
- **So that** they can approve my rydz.

**Setup:**
- A Parent account exists.
- A Student account exists with a different email.

**Steps to Test:**
1. Log in as the Student.
2. Navigate to the `/profile` page.
3. In the "My Parents/Guardians" section, enter the Parent's email address.
4. Click "Add Parent/Guardian".

**Expected Result:**
- A toast notification confirms the parent has been linked.
- The parent's name appears in the "My Associated Parents/Guardians" list.
- In Firestore, the student's `associatedParentIds` array should contain the parent's UID.
- The parent's `managedStudentIds` array should contain the student's UID.

---

## 3. Core Ryd Lifecycle

### Story 3.1: Requesting a Ryd
- **As a** Student,
- **I want to** request a ryd for an event,
- **So that** a driver can offer to take me.

**Setup:**
- A Student account exists.
- An Event exists (e.g., "School Science Fair").

**Steps to Test:**
1. Log in as the Student.
2. Navigate to the `/rydz/request` page.
3. Select the event from the dropdown. The destination and time should pre-fill.
4. Enter a pickup location.
5. Click "Submit Ryd Request".

**Expected Result:**
- A toast confirms the request was submitted.
- The user is redirected to the `/rydz/upcoming` page.
- The new request appears in the "My Pending Requests" section.
- A new document is created in the `rydz` collection in Firestore.

---

### Story 3.2: Fulfilling a Ryd Request
- **As a** Driver,
- **I want to** offer to fulfill a ryd request,
- **So that** I can give a student a ride.

**Setup:**
- A Ryd Request exists from Story 3.1.
- A Driver account exists (canDrive: true).

**Steps to Test:**
1. Log in as the Driver.
2. Navigate to the `/events/[eventId]/rydz` page for the relevant event.
3. Find the pending request from the Student.
4. Click "Offer to Fulfill (New Ryd)".
5. Fill out the "Offer Drive" form with vehicle details and available seats.
6. Click "Submit Ryd Offer".

**Expected Result:**
- A toast confirms the offer was submitted.
- The user is redirected to the event rydz page.
- A new `activeRydz` document is created in Firestore.
- The original `rydz` document status is updated to `driver_assigned`.
- The Student's pending request on the `/rydz/upcoming` page should now show the driver's name.

---

### Story 3.3: Parent Approval Flow
- **As a** Parent,
- **I want to** approve a ryd for my student with an unapproved driver,
- **So that** my child can safely get a ride.

**Setup:**
- A Parent and Student are linked.
- A Driver account exists that is **not** on the Parent's approved list.
- The Driver has offered a ryd for an event.

**Steps to Test:**
1. Log in as the Parent.
2. On behalf of the student, navigate to the event page and request to join the Driver's ryd.
3. A message should indicate that parental approval is required.
4. Navigate to `/parent/approvals`.
5. The request should be visible in the "Pending Requests" list.
6. Click "Approve & Add to List".

**Expected Result:**
- The request disappears from the parent's approval queue.
- The driver is added to the parent's `approvedDrivers` list in Firestore.
- The driver receives a notification that a new passenger has requested to join their ryd.
