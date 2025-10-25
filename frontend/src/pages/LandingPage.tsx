// src/pages/LandingPage.tsx
import { Link } from "react-router-dom";
import { useAuthStore } from '@/store/authStore';
import { useMemberStats } from '@/hooks/useUsers';

export default function LandingPage() {
  const { isAuthenticated, user } = useAuthStore();
  const { data: memberStats } = useMemberStats();

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-200 via-white to-indigo-200">
      {/* Top nav (simple brand) */}
      <header className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Private Coach Logo" className="h-8 w-8 rounded-xl object-contain" />
          <span className="text-sm font-semibold text-slate-800 tracking-tight">
            Private Coach
          </span>
        </div>
        <nav className="hidden sm:flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <span className="text-sm text-slate-600">
                Welcome, {user?.username}
              </span>
              <Link
                to="/dashboard"
                className="bg-[#4A90E2] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#357ABD] transition duration-200"
              >
                Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm font-medium text-slate-700 hover:text-slate-900"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="text-sm font-medium text-slate-700 hover:text-slate-900"
              >
                Register
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-6xl px-4">
        <section className="grid grid-cols-1 items-center gap-8 py-10 sm:py-16 lg:grid-cols-2">
          {/* Copy */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-[#4A90E2]" />
              Join as a client
            </div>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
              Transform your fitness with personal training
            </h1>

            <p className="mt-4 max-w-prose text-slate-600">
              Book sessions with professional trainers, track your progress, and manage your fitness journey.
              Simple, secure, and designed for your success.
            </p>

            {/* Only show registration buttons for non-authenticated users */}
            {!isAuthenticated && (
              <>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Link
                    to="/register"
                    className="inline-flex items-center justify-center rounded-xl bg-[#4A90E2] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2]"
                  >
                    Join as a client
                  </Link>
                  <Link
                    to="/login"
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                  >
                    I already have an account
                  </Link>
                </div>

                <p className="mt-3 text-xs text-slate-500">
                  By continuing you agree to our Terms & Privacy. 
                  <br />
                  <em>Trainers are added by our team - contact us to join as a trainer.</em>
                </p>
              </>
            )}

            {/* Show welcome message for authenticated users */}
            {isAuthenticated && (
              <div className="mt-6">
                <p className="text-lg text-slate-700">
                  Welcome back! Continue managing your fitness journey.
                </p>
                <div className="mt-4">
                  <Link
                    to="/dashboard"
                    className="inline-flex items-center justify-center rounded-xl bg-[#4A90E2] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2]"
                  >
                    Go to Dashboard
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Visual / “app card” */}
          <div className="relative">
            <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-tr from-[#4A90E2]/20 via-transparent to-[#FFD166]/30 blur-2xl" />
            <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-xl backdrop-blur">
              <div className="rounded-2xl border border-slate-100 bg-white p-4">
                {/* Member Statistics */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 p-4 text-center">
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Members</div>
                    <div className="mt-2 text-2xl font-bold text-slate-900">
                      {memberStats?.total_members || '—'}
                    </div>
                    <div className="mt-1 text-xs text-slate-600">Registered users</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4 text-center">
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Active Members</div>
                    <div className="mt-2 text-2xl font-bold text-green-600">
                      {memberStats?.active_members || '—'}
                    </div>
                    <div className="mt-1 text-xs text-slate-600">With subscriptions</div>
                  </div>
                  <div className="col-span-2 rounded-xl border border-slate-200 p-4">
                    <div className="mb-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Opening Hours</div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-700">Monday - Sunday</span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Morning</span>
                          <span className="text-slate-600">8:00 AM - 12:00 PM</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 italic">Lunch Break</span>
                          <span className="text-slate-500 italic">12:00 PM - 2:00 PM</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Afternoon</span>
                          <span className="text-slate-600">2:00 PM - 10:00 PM</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link 
                    to="/coaches"
                    className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600 text-center hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Coaches
                  </Link>
                  <Link
                    to="/workout-templates"
                    className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600 text-center hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Workouts
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature bullets */}
        <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Feature
            title="Smart Scheduling"
            text="Simple booking flows with automatic conflict checks."
            Icon={() => (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            )}
          />
          <Feature
            title="Workout Builder"
            text="Create and share plans with progress tracking."
            Icon={() => (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M6 6h12v12H6z" />
                <path d="M9 9h6v6H9z" />
              </svg>
            )}
          />
          <Feature
            title="Integrated Payments"
            text="Collect securely and see revenue in real time."
            Icon={() => (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <path d="M16 12h.01" />
              </svg>
            )}
          />
        </section>

        {/* Mobile CTA */}
        <section className="pb-12 text-center sm:hidden">
          <Link
            to="/register"
            className="inline-flex items-center justify-center rounded-xl bg-[#4A90E2] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-95"
          >
            Join as a client
          </Link>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white/60">
        <div className="mx-auto max-w-6xl px-4 py-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <img src="/logo.png" alt="Private Coach Logo" className="h-4 w-4 rounded object-contain" />
          © {new Date().getFullYear()} Private Coach — All rights reserved.
        </div>
      </footer>
    </div>
  );
}

/* Small feature item */
function Feature({
  title,
  text,
  Icon,
}: {
  title: string;
  text: string;
  Icon: React.FC;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(74,144,226,0.12)] text-[#4A90E2]">
          <Icon />
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="text-xs text-slate-600">{text}</div>
        </div>
      </div>
    </div>
  );
}