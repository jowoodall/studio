
import Link from 'next/link';

export default function HomePage() {
  return (
    <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1>Welcome to MyRydz</h1>
      <p>If you can see this, the basic routing is working.</p>
      <p>This is a temporary, simplified homepage to diagnose the 404 error.</p>
      <div style={{ marginTop: '20px' }}>
        <Link href="/dashboard" style={{ marginRight: '10px', color: 'blue' }}>
          Go to Dashboard
        </Link>
        <Link href="/login" style={{ color: 'blue' }}>
          Go to Login
        </Link>
      </div>
    </div>
  );
}
