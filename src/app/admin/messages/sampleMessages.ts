/**
 * Sample messages and threads for #ops-inbox when database is empty.
 * Slack-style: B2B (designer/retail) and B2C (residential) threads.
 */

export interface SampleMessageRow {
  thread_id: string;
  sender_name: string;
  sender_type: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

const now = new Date();
const hour = (h: number, m: number) => {
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

export const SAMPLE_MESSAGES: SampleMessageRow[] = [
  // Thread 1: Designer inquiry
  {
    thread_id: "thread-design-inquiry-001",
    sender_name: "Sarah Chen",
    sender_type: "client",
    content: "Hi! We have a 12-piece install going in next Tuesday at 245 Avenue Rd. Can you confirm availability?",
    is_read: false,
    created_at: hour(9, 15),
  },
  {
    thread_id: "thread-design-inquiry-001",
    sender_name: "J. Oche",
    sender_type: "admin",
    content: "Hi Sarah — Yes, we have capacity. I'll assign Team A. Confirming 9am window?",
    is_read: true,
    created_at: hour(9, 32),
  },
  {
    thread_id: "thread-design-inquiry-001",
    sender_name: "Sarah Chen",
    sender_type: "client",
    content: "9am works. Client will have keys ready. Thanks!",
    is_read: false,
    created_at: hour(9, 45),
  },
  // Thread 2: Residential move
  {
    thread_id: "thread-residential-002",
    sender_name: "Mike Torres",
    sender_type: "client",
    content: "Our move got pushed to Friday — is that still ok? Same addresses.",
    is_read: false,
    created_at: hour(10, 5),
  },
  {
    thread_id: "thread-residential-002",
    sender_name: "J. Oche",
    sender_type: "admin",
    content: "No problem, Mike. I've updated the schedule. Team B will be there Friday 8–12.",
    is_read: true,
    created_at: hour(10, 18),
  },
  // Thread 3: Retail partner
  {
    thread_id: "thread-retail-003",
    sender_name: "West Elm Toronto",
    sender_type: "client",
    content: "URGENT: 3 white-glove deliveries tomorrow. Can we add one more to the route?",
    is_read: false,
    created_at: hour(14, 22),
  },
  {
    thread_id: "thread-retail-003",
    sender_name: "J. Oche",
    sender_type: "admin",
    content: "Checking crew capacity — will confirm within 30 min.",
    is_read: true,
    created_at: hour(14, 35),
  },
  // Thread 4: Gallery
  {
    thread_id: "thread-gallery-004",
    sender_name: "Bau-Xi Gallery",
    sender_type: "client",
    content: "Feinstein exhibition install — we need art handlers for Mar 1. Can you quote?",
    is_read: true,
    created_at: hour(11, 0),
  },
  // Thread 5: Realtor referral
  {
    thread_id: "thread-realtor-005",
    sender_name: "Jennifer Park",
    sender_type: "client",
    content: "New referral: 123 Oak St, closing March 15. Client needs full-service move + storage.",
    is_read: false,
    created_at: hour(15, 50),
  },
];
