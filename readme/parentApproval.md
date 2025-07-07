#1
This process has a few moving parts: the user interface for the parent, the data we need to show them, and the back-end logic to handle the approval itself.

Let's start with the user's experience:

1. Where does a parent go to see these approvals? I see we have a "Parental Controls" link in the sidebar that goes to /parent/approvals. My assumption is that we should build a page there that shows a list of drivers who are awaiting approval for one of the parent's students. Is that your vision as well?
I would expect that the parent will have a list of requested approvals and a record of past approvals in the profile.  I would also expect a page under "My Rydz" called Requested approvals.

2. What triggers an approval request? How does a driver end up on this approval list? Does this happen automatically when one of your students tries to join a ryd with a new, unapproved driver?
An approval request would be initiated when the student requests a ryd with an unapproved driver or when an unapproved driver offers a ryd to their student.
Note: A parent should be able to add any user to the approved driver list without a request.
Note: When a parent approves a request, they can either approve it just for the one ryd or they can add the driver to the approved driver list.

4. What information does the parent need to see to make an informed decision? For each driver in the list, I imagine the parent would need to see:

The driver's name and photo.
The driver's overall rating and number of completed rydz.
Which of their students is this approval for.
Buttons to "Approve for this ryd", "Add driver to approved list" or "Reject for this ryd".
How does this initial breakdown sound? Once we're clear on the user experience, we can discuss how to best store this approval data in our Firestore database.

#2
Based on your requirements, the most fundamental piece is storing the list of drivers a parent has permanently approved. Before we build any UI or complex logic, we need a place to save this information in our database.

My proposal is to start with this foundational data model change.

Proposed First Step: Update the User Data Structure

I will add a new field to the UserProfileData type called approvedDriverIds. This will be a simple list of driver ID strings.

File to change: src/types/index.ts
What I'll add: A new optional field approvedDriverIds?: string[] to the UserProfileData interface.
To ensure all new users have this field, I will also update the signup form to initialize this list as empty for every new user created.

File to change: src/components/auth/signup-form.tsx
What I'll add: approvedDriverIds: [] to the new user profile object.
This is a small, safe, and necessary first step. It doesn't build the UI yet, but it creates the "bucket" in our database where we will store the parents' list of trusted drivers.

Before we make changes, I want to clarify that only students require approval for a ryd and only students with an associated parent.
