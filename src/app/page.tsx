import { redirect } from 'next/navigation';

export default function HomePage() {
  // Redirect to the dashboard, which will handle authentication.
  redirect('/dashboard');
}
