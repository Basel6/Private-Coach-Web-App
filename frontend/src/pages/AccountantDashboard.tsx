// src/pages/AccountantDashboard.tsx
import React, { useMemo, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { useCoaches, useClients } from "@/hooks";
import { useAllPayments, useExportPaymentsCSV } from "@/hooks/usePayments";
import CollapsiblePanel from "@/components/ui/CollapsiblePanel";
import AddPaymentModal from "@/components/AddPaymentModal";
import ClientDetailsModal from "@/components/ClientDetailsModal";
import { formatCurrencyILS } from "@/lib/format";

/* UI primitives */
const Card: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ className = "", children }) => (
  <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>
);
const StatNumber: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="text-3xl font-semibold text-slate-900 tracking-tight">{children}</div>
);
const StatLabel: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="text-sm text-slate-500">{children}</div>
);
const IconCircle: React.FC<{ children: React.ReactNode; tone?: "primary" | "accent" | "neutral" }> = ({
  children,
  tone = "primary",
}) => {
  const tones: Record<string, string> = {
    primary: "bg-[rgba(74,144,226,0.12)] text-[#4A90E2]",
    accent: "bg-[rgba(255,209,102,0.18)] text-[#B68B00]",
    neutral: "bg-slate-100 text-slate-600",
  };
  return <div className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${tones[tone]}`}>{children}</div>;
};

/* inline icons (fixed-size) */
const UsersIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const CoachIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
    <circle cx="12" cy="7" r="4" />
    <path d="M5.5 22a6.5 6.5 0 0 1 13 0" />
  </svg>
);
const WalletIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M16 12h.01" />
  </svg>
);
const SubIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M4 8h16M4 16h16" />
    <rect x="4" y="4" width="16" height="16" rx="4" />
  </svg>
);
const ChevronDownIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6 9l6 6 6-6" />
  </svg>
);



const PageSkeleton = () => (
  <div className="min-h-screen bg-[#FAFAFA]">
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4 h-9 w-72 animate-pulse rounded-lg bg-slate-200" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={`skeleton-card-${i}`} className="h-28 animate-pulse rounded-2xl bg-slate-200" />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="h-48 animate-pulse rounded-2xl bg-slate-200 lg:col-span-2" />
        <div className="h-48 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    </div>
  </div>
);

/* display row types */
type CoachRow = { id: number; name: string; email: string; activeClients: number };
type ClientRow = { 
  id: number; 
  username: string; 
  email: string; 
  coach: string; 
  hasActiveSubscription: boolean;
  subscriptionEndDate: string | null;
  hasIncompleteProfile: boolean;
  client: any; // Full client object for modal
};

type RevenuePeriod = 
  | 'total' 
  | 'thisMonth' 
  | 'lastMonth' 
  | 'thisYear'
  | '2025-01' | '2025-02' | '2025-03' | '2025-04' | '2025-05' | '2025-06'
  | '2025-07' | '2025-08' | '2025-09' | '2025-10' | '2025-11' | '2025-12'
  | '2024-01' | '2024-02' | '2024-03' | '2024-04' | '2024-05' | '2024-06'
  | '2024-07' | '2024-08' | '2024-09' | '2024-10' | '2024-11' | '2024-12';

const periodOptions = [
  { value: 'total', label: 'All Time', group: 'Summary' },
  { value: 'thisMonth', label: 'This Month (Oct 2025)', group: 'Summary' },
  { value: 'lastMonth', label: 'Last Month (Sep 2025)', group: 'Summary' },
  { value: 'thisYear', label: 'This Year (2025)', group: 'Summary' },
  
  // 2025 months
  { value: '2025-01', label: 'January 2025', group: '2025' },
  { value: '2025-02', label: 'February 2025', group: '2025' },
  { value: '2025-03', label: 'March 2025', group: '2025' },
  { value: '2025-04', label: 'April 2025', group: '2025' },
  { value: '2025-05', label: 'May 2025', group: '2025' },
  { value: '2025-06', label: 'June 2025', group: '2025' },
  { value: '2025-07', label: 'July 2025', group: '2025' },
  { value: '2025-08', label: 'August 2025', group: '2025' },
  { value: '2025-09', label: 'September 2025', group: '2025' },
  { value: '2025-10', label: 'October 2025', group: '2025' },
  { value: '2025-11', label: 'November 2025', group: '2025' },
  { value: '2025-12', label: 'December 2025', group: '2025' },
  
  // 2024 months
  { value: '2024-01', label: 'January 2024', group: '2024' },
  { value: '2024-02', label: 'February 2024', group: '2024' },
  { value: '2024-03', label: 'March 2024', group: '2024' },
  { value: '2024-04', label: 'April 2024', group: '2024' },
  { value: '2024-05', label: 'May 2024', group: '2024' },
  { value: '2024-06', label: 'June 2024', group: '2024' },
  { value: '2024-07', label: 'July 2024', group: '2024' },
  { value: '2024-08', label: 'August 2024', group: '2024' },
  { value: '2024-09', label: 'September 2024', group: '2024' },
  { value: '2024-10', label: 'October 2024', group: '2024' },
  { value: '2024-11', label: 'November 2024', group: '2024' },
  { value: '2024-12', label: 'December 2024', group: '2024' },
] as const;

const getSelectedLabel = (period: RevenuePeriod): string => {
  const option = periodOptions.find(opt => opt.value === period);
  return option?.label || 'All Time';
};

export default function AccountantDashboard() {
  const { user, logout } = useAuthStore();
  const [revenuePeriod, setRevenuePeriod] = useState<RevenuePeriod>('total');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [showClientDetails, setShowClientDetails] = useState(false);

  const { data: coaches, isLoading: coachesLoading, error: coachesError } = useCoaches();
  const { data: clients, isLoading: clientsLoading, error: clientsError } = useClients();
  const { data: allPayments, isLoading: paymentsLoading, error: paymentsError } = useAllPayments();
  
  const exportCSV = useExportPaymentsCSV();

  // Handler functions
  const handleAddPayment = () => {
    setShowPaymentModal(true);
  };

  const handleExportCSV = () => {
    exportCSV.mutate({});
  };

  // Calculate filtered revenue based on selected period
  const filteredRevenue = useMemo(() => {
    if (!allPayments) return 0;
    
    const now = new Date();
    const paidPayments = allPayments.filter((p: any) => p.status === 'PAID');
    
    let filteredPayments = paidPayments;
    
    if (revenuePeriod === 'total') {
      filteredPayments = paidPayments;
    } else if (revenuePeriod === 'thisMonth') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      filteredPayments = paidPayments.filter(p => 
        p.paid_at && new Date(p.paid_at) >= startOfMonth
      );
    } else if (revenuePeriod === 'lastMonth') {
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      filteredPayments = paidPayments.filter(p => 
        p.paid_at && 
        new Date(p.paid_at) >= startOfLastMonth && 
        new Date(p.paid_at) <= endOfLastMonth
      );
    } else if (revenuePeriod === 'thisYear') {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      filteredPayments = paidPayments.filter(p => 
        p.paid_at && new Date(p.paid_at) >= startOfYear
      );
    } else if (revenuePeriod.includes('-')) {
      // Handle specific month/year format like "2025-01"
      const [year, month] = revenuePeriod.split('-').map(Number);
      const startOfTargetMonth = new Date(year, month - 1, 1);
      const endOfTargetMonth = new Date(year, month, 0, 23, 59, 59);
      
      filteredPayments = paidPayments.filter(p => {
        if (!p.paid_at) return false;
        const paymentDate = new Date(p.paid_at);
        return paymentDate >= startOfTargetMonth && paymentDate <= endOfTargetMonth;
      });
    }
    
    return filteredPayments.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);
  }, [allPayments, revenuePeriod]);

  const processedCoaches: CoachRow[] = useMemo(() => {
    if (!coaches || !clients) return [];
    
    // Debug info can be removed for production
    
    return coaches.map((coach: any, index: number) => {
      // Get coach display info
      
      // Count clients for this specific coach - use username since ID is undefined
      let assignedClients = [];
      
      // Match by assigned_coach.username (since IDs are undefined)
      assignedClients = clients.filter((cl: any) => {
        return cl.assigned_coach?.username === coach?.username;
      });
      
      // If no matches, try Strategy 2: Match by assigned_coach containing coach data
      if (assignedClients.length === 0) {
        assignedClients = clients.filter((cl: any) => {
          // Check if assigned_coach object contains this coach's info
          return cl.assigned_coach && (
            cl.assigned_coach.first_name === coach?.first_name &&
            cl.assigned_coach.last_name === coach?.last_name
          );
        });
      }
      
      // Try different name fields and handle undefined coaches
      const displayName = coach?.username || 
                         coach?.full_name || 
                         (coach?.first_name && coach?.last_name ? `${coach.first_name} ${coach.last_name}` : null) ||
                         coach?.email?.split('@')[0] || 
                         `Coach ${coach?.id || 'Unknown'}`;
                         
      const displayEmail = coach?.email || (coach?.username ? coach.username + '@example.com' : 'No email');
      
      return { 
        id: coach?.id || index + 1, // Use index as fallback ID
        name: displayName,
        email: displayEmail, 
        activeClients: assignedClients.length
      };
    });
  }, [coaches, clients]);

  const processedClients: ClientRow[] = useMemo(() => {
    if (!clients || !allPayments) return [];
    
    return clients.map((cl: any) => {
      // Find active subscription for this client
      const now = new Date();
      const activeSubscription = allPayments
        .filter((payment: any) => 
          payment.client_id === cl.id &&
          payment.status === 'PAID' && 
          payment.active_until && 
          new Date(payment.active_until) > now
        )
        .sort((a: any, b: any) => new Date(b.active_until!).getTime() - new Date(a.active_until!).getTime())[0];

      return {
        id: cl.id,
        username: cl.username,
        email: cl.email,
        coach: cl.assigned_coach?.username || "—",
        hasActiveSubscription: !!activeSubscription,
        subscriptionEndDate: activeSubscription?.active_until || null,
        hasIncompleteProfile: !cl.first_name || !cl.last_name || !cl.phone,
        client: cl // Store full client object for modal
      };
    });
  }, [clients, allPayments]);

  // Calculate stats based on processed data
  const stats = useMemo(() => {
    const totalCoaches = processedCoaches.length;
    const totalClients = processedClients.length;
    const activeSubscriptions = processedClients.filter(client => client.hasActiveSubscription).length;

    return {
      totalCoaches,
      totalClients,
      activeSubscriptions,
      monthlyRevenue: filteredRevenue,
    };
  }, [processedCoaches.length, processedClients, filteredRevenue]);

  if (coachesLoading || clientsLoading || paymentsLoading) return <PageSkeleton />;

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-800">
      {/* Top nav */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Private Coach Logo" className="h-10 w-10 rounded-xl object-contain" />
            <h1 className="text-lg font-semibold tracking-tight">
              Private Coach <span className="text-slate-400">·</span> <span className="text-[#4A90E2]">Accountant</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-sm text-slate-600">
              Welcome, <span className="font-medium">{user?.username}</span>
            </div>
            <button
              onClick={() => window.location.href = '/'}
              className="rounded-lg bg-[#4A90E2] text-white px-3 py-1.5 text-sm hover:bg-[#357ABD] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2]"
            >
              Home
            </button>
            <button
              onClick={logout}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2]"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Errors */}
      {(coachesError || clientsError || paymentsError) && (
        <div className="mx-auto max-w-6xl px-4 pt-4">
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {String(coachesError || clientsError || paymentsError)}
          </div>
        </div>
      )}

      {/* Content */}
      <main className="mx-auto max-w-6xl px-4 py-6">
        {/* Stats */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <IconCircle><UsersIcon /></IconCircle>
              <span className="text-xs font-medium text-slate-500">Overview</span>
            </div>
            <div className="mt-4">
              <StatNumber>{stats.totalCoaches}</StatNumber>
              <StatLabel>Total Coaches</StatLabel>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <IconCircle tone="accent"><CoachIcon /></IconCircle>
              <span className="text-xs font-medium text-slate-500">Today</span>
            </div>
            <div className="mt-4">
              <StatNumber>{stats.totalClients}</StatNumber>
              <StatLabel>Total Clients</StatLabel>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <IconCircle tone="neutral"><SubIcon /></IconCircle>
              <span className="text-xs font-medium text-slate-500">Active</span>
            </div>
            <div className="mt-4">
              <StatNumber>{stats.activeSubscriptions}</StatNumber>
              <StatLabel>Active Subscriptions</StatLabel>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <IconCircle><WalletIcon /></IconCircle>
              <div className="relative">
                <select
                  value={revenuePeriod}
                  onChange={(e) => setRevenuePeriod(e.target.value as RevenuePeriod)}
                  className="appearance-none bg-transparent text-xs font-medium text-slate-500 pr-6 cursor-pointer focus:outline-none max-w-[120px]"
                >
                  {/* Group options by category */}
                  <optgroup label="Summary">
                    {periodOptions
                      .filter(opt => opt.group === 'Summary')
                      .map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))
                    }
                  </optgroup>
                  <optgroup label="2025 Months">
                    {periodOptions
                      .filter(opt => opt.group === '2025')
                      .map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))
                    }
                  </optgroup>
                  <optgroup label="2024 Months">
                    {periodOptions
                      .filter(opt => opt.group === '2024')
                      .map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))
                    }
                  </optgroup>
                </select>
                <div className="absolute right-0 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <ChevronDownIcon />
                </div>
              </div>
            </div>
            <div className="mt-4">
              <StatNumber>{formatCurrencyILS(stats.monthlyRevenue)}</StatNumber>
              <StatLabel>Revenue ({getSelectedLabel(revenuePeriod)})</StatLabel>
            </div>
          </Card>
        </section>

        {/* Quick actions */}
        <section className="mt-6">
          <Card className="p-4 max-w-md">
            <div className="text-base font-semibold text-slate-900">Quick Actions</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button 
                onClick={handleAddPayment}
                className="rounded-xl bg-[#4A90E2] px-3 py-2 text-sm font-medium text-white hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2]"
              >
                Add Payment
              </button>
              <button 
                onClick={handleExportCSV}
                disabled={exportCSV.isPending}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:opacity-50"
              >
                {exportCSV.isPending ? 'Exporting...' : 'Export CSV'}
              </button>
            </div>
          </Card>
        </section>

        {/* Panels */}
        <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CollapsiblePanel title="Coaches" count={processedCoaches.length}>
            {processedCoaches.length === 0 ? (
              <div className="text-sm text-slate-500">No coaches found.</div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <ul className="divide-y divide-slate-100">
                  {processedCoaches.map((c) => (
                    <li key={`coach-${c.id}-${c.name}`} className="flex items-center justify-between rounded-lg px-2 py-3 hover:bg-slate-50">
                      <div>
                        <div className="text-sm font-medium text-slate-900">{c.name || 'Unknown Coach'}</div>
                        <div className="text-xs text-slate-500">{c.email || 'No email'}</div>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                        Active clients: <span className="font-medium">{c.activeClients}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CollapsiblePanel>

          <CollapsiblePanel title="Clients" count={processedClients.length}>
            {processedClients.length === 0 ? (
              <div className="text-sm text-slate-500">No clients found.</div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <ul className="divide-y divide-slate-100">
                  {processedClients.map((u) => (
                    <li 
                      key={u.id} 
                      className="flex items-center justify-between rounded-lg px-2 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedClient(u.client);
                        setShowClientDetails(true);
                      }}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-slate-900">{u.username}</div>
                          {u.hasActiveSubscription && (
                            <span className="inline-flex h-2 w-2 rounded-full bg-green-500" title="Active Subscription"></span>
                          )}
                          {u.hasIncompleteProfile && (
                            <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-red-500 text-white text-xs" title="Incomplete Profile">!</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">{u.email}</div>
                        {u.subscriptionEndDate && (
                          <div className="text-xs text-green-600 mt-1">
                            Subscription until {new Date(u.subscriptionEndDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">Coach: {u.coach}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CollapsiblePanel>
        </section>
      </main>

      {/* Add Payment Modal */}
      <AddPaymentModal 
        isOpen={showPaymentModal} 
        onClose={() => setShowPaymentModal(false)} 
      />

      {/* Client Details Modal */}
      <ClientDetailsModal 
        isOpen={showClientDetails}
        onClose={() => setShowClientDetails(false)}
        client={selectedClient}
        allPayments={allPayments || []}
      />
    </div>
  );
}
