
This process has a few moving parts: the user interface for the parent, the data we need to show them, and the back-end logic to handle the approval itself.

Let's start with the user's experience:

1. Where does a parent go to see these approvals? I see we have a "Parental Controls" link in the sidebar that goes to /parent/approvals. My assumption is that we should build a page there that shows a list of drivers who are awaiting approval for one of the parent's students. Is that your vision as well?
I would expect that the parent will have a list of requsted approvals and a record of past approvals in the profile.  I would also expect a page under "My Rydz" called Requested approvals.

2. What triggers an approval request? How does a driver end up on this approval list? Does this happen automatically when one of your students tries to join a ryd with a new, unapproved driver?
An approval request would be initiated when the student requests a ryd with an unapproved driver or when an unappproved driver offers a ryd to their student.
Note: A parent should be able to add any user to the approved driver list without a request.
Note: When a parent approves a request, they can either approve it just for the one ryd or they can add the driver to the approved driver list.

4. What information does the parent need to see to make an informed decision? For each driver in the list, I imagine the parent would need to see:

The driver's name and photo.
The driver's overall rating and number of completed rydz.
Which of their students this approval is for.
Buttons to "Approve for this ryd", "Add driver to approved list" or "Reject for this ryd".
How does this initial breakdown sound? Once we're clear on the user experience, we can discuss how to best store this approval data in our Firestore database.
