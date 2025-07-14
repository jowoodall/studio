# MyRydz Notification System

This document outlines all the automated user notifications within the MyRydz application, detailing what triggers them and who receives them. All notifications are sent in-app and can be viewed on the `/notifications` page.

## Ryd Lifecycle Notifications

These notifications are related to the process of requesting, joining, and completing a ryd.

---

### 1. New Ryd Request (to Driver)

-   **Title**: `New Ryd Request`
-   **Recipient**: The Driver of an `ActiveRyd`.
-   **Trigger**: A passenger requests to join the driver's ryd offer, and the request does **not** require parental approval first.
-   **Message**: `[Passenger Name] has requested to join your ryd.`

---

### 2. Parental Approval Required (to Parent)

-   **Title**: `Ryd Approval Required`
-   **Recipient**: The managing Parent of a Student.
-   **Trigger**: A student requests to join a ryd with a driver who is not on the parent's pre-approved list.
-   **Message**: `Your approval is required for [Student Name] to join a ryd.`

---

### 3. Ryd Request Approved by Parent (to Driver)

-   **Title**: `New Ryd Request`
-   **Recipient**: The Driver of an `ActiveRyd`.
-   **Trigger**: A parent approves their student's request to join the ryd. The request is then forwarded to the driver.
-   **Message**: `[Student Name] has requested to join your ryd for "[Event Name]" (approved by parent).`

---

### 4. Your Ryd Request Status Update (to Passenger)

-   **Title**: `Your Ryd Request was [approved/rejected]`
-   **Recipient**: The Passenger who requested to join a ryd.
-   **Trigger**: A driver either approves or rejects the passenger's join request.
-   **Message**: `[Driver Name] has [approved/rejected] your request to join the ryd for "[Event Name]".`

---

### 5. Passenger Cancels Their Spot (to Driver)

-   **Title**: `Passenger Cancelled`
-   **Recipient**: The Driver of an `ActiveRyd`.
-   **Trigger**: A passenger who was on the manifest (either pending or confirmed) cancels their spot.
-   **Message**: `[Passenger Name] has cancelled their spot for the ryd to "[Event Name]".`

---

### 6. Ryd Has Started (to Passengers)

-   **Title**: `Your Ryd has Started!`
-   **Recipient**: All confirmed passengers of an `ActiveRyd`.
-   **Trigger**: The driver clicks the "Start Ryd" button.
-   **Message**: `[Driver Name] has started the ryd to "[Event Name]" and is on their way.`

---

### 7. Ryd Is Cancelled by Driver (to Passengers)

-   **Title**: `Ryd Cancelled by Driver`
-   **Recipient**: All passengers on the manifest of an `ActiveRyd`.
-   **Trigger**: The driver clicks the "Cancel This Entire Ryd" button.
-   **Message**: `The ryd to "[Event Name]" by [Driver Name] has been cancelled. Please make other arrangements.`

---

### 8. Ryd Is Completed (to Passengers)

-   **Title**: `Ryd Completed!`
-   **Recipient**: All passengers who were on board an `ActiveRyd`.
-   **Trigger**: The driver clicks the "Complete Ryd" button after dropping everyone off.
-   **Message**: `Your ryd to "[Event Name]" is complete. Please rate your driver, [Driver Name].`

---

## Group & Family Management Notifications

### 1. Group Invitation

-   **Title**: `Group Invitation`
-   **Recipient**: The User being invited.
-   **Trigger**: A group admin adds a user to the group's member list by email.
-   **Message**: `You have been invited to join the group "[Group Name]".`

---

### 2. Added to Family

-   **Title**: `You were added to a family`
-   **Recipient**: The User being added.
-   **Trigger**: A family admin adds a user to the family's member list by email.
-   **Message**: `[Admin's Name] has added you to the family "[Family Name]".`

---

## Event Notifications

### 1. New Event Created for Group

-   **Title**: `Event Created`
-   **Recipient**: All members of groups associated with a new event (except the creator).
-   **Trigger**: An event manager creates a new event and associates it with one or more groups.
-   **Message**: `The event "[Event Name]" which is associated with one of your groups has been created.`

---

### 2. Event Updated for Group

-   **Title**: `Event Updated`
-   **Recipient**: All members of groups associated with an updated event (except the editor).
-   **Trigger**: An event manager updates an existing event that is associated with one or more groups.
-   **Message**: `The event "[Event Name]" which is associated with one of your groups has been updated.`