import { redirect } from 'next/navigation';

export default function HomePage() {
  // Redirect to the login page as the app does not have a public landing page.
  redirect('/login');
}
