export interface User {
  id: string;
  name: string;
  title: string;
  company?: string;
  location: string;
  trade: string;
  avatar?: string;
  initials: string;
  avatarColor: string;
  verified: boolean;
  rating: number;
  reviewCount: number;
  jobsCompleted: number;
  yearsExp: number;
  bio: string;
  skills: string[];
  isFollowing?: boolean;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  companyInitials: string;
  companyColor: string;
  location: string;
  type: 'Full-time' | 'Contract' | 'Per-diem' | 'Subcontract';
  trade: string;
  description: string;
  budget?: string;
  postedAt: string;
  skills: string[];
  bidsCount: number;
  isNew?: boolean;
  isFeatured?: boolean;
}

export type PostType = 'project_update' | 'job_post' | 'bid_post' | 'trade_tip' | 'safety_alert' | 'referral' | 'story'

export interface Post {
  id: string;
  author: User;
  post_type: PostType;
  content: string;
  images?: string[];
  tags: string[];
  likes: number;
  comments: number;
  shares: number;
  postedAt: string;
  isLiked?: boolean;
  is_urgent?: boolean;
  is_boosted?: boolean;
}

export interface Bid {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string;
  amount: string;
  status: 'pending' | 'accepted' | 'rejected' | 'shortlisted';
  submittedAt: string;
}

export const currentUser: User = {
  id: 'current',
  name: 'Marcus Rivera',
  title: 'Master Electrician',
  company: 'Rivera Electric LLC',
  location: 'Austin, TX',
  trade: 'Electrical',
  initials: 'MR',
  avatarColor: '#E85D26',
  verified: true,
  rating: 4.9,
  reviewCount: 87,
  jobsCompleted: 214,
  yearsExp: 12,
  bio: 'Licensed Master Electrician with 12 years of commercial and residential experience. Specializing in new construction, panel upgrades, and smart home systems. IBEW member.',
  skills: ['Residential Wiring', 'Commercial Electrical', 'Panel Upgrades', 'Smart Home', 'Code Compliance', 'Project Management'],
};

export const users: User[] = [
  {
    id: 'u1',
    name: 'Sarah Chen',
    title: 'Licensed General Contractor',
    company: 'Chen Construction Co.',
    location: 'Austin, TX',
    trade: 'General Contractor',
    initials: 'SC',
    avatarColor: '#2563EB',
    verified: true,
    rating: 4.8,
    reviewCount: 142,
    jobsCompleted: 389,
    yearsExp: 15,
    bio: 'Licensed GC specializing in commercial tenant improvements and ground-up construction. Over 15 years building relationships and quality projects.',
    skills: ['Commercial Construction', 'Project Management', 'Tenant Improvements', 'Estimating', 'Scheduling'],
    isFollowing: true,
  },
  {
    id: 'u2',
    name: 'Darius Washington',
    title: 'Master Plumber',
    company: 'Washington Plumbing & Mechanical',
    location: 'Houston, TX',
    trade: 'Plumbing',
    initials: 'DW',
    avatarColor: '#059669',
    verified: true,
    rating: 4.7,
    reviewCount: 93,
    jobsCompleted: 276,
    yearsExp: 18,
    bio: 'Master Plumber licensed in TX and LA. Commercial & residential, new construction and service/repair. Quick response times, clean work.',
    skills: ['Commercial Plumbing', 'Residential Plumbing', 'Gas Lines', 'Water Heaters', 'Backflow Prevention'],
    isFollowing: false,
  },
  {
    id: 'u3',
    name: 'Angela Torres',
    title: 'Structural Engineer & Designer',
    company: 'Torres Design Build',
    location: 'San Antonio, TX',
    trade: 'Engineering',
    initials: 'AT',
    avatarColor: '#7C3AED',
    verified: true,
    rating: 5.0,
    reviewCount: 58,
    jobsCompleted: 124,
    yearsExp: 10,
    bio: 'PE and licensed architect. Specializing in custom residential and light commercial design. From concept to permit-ready drawings.',
    skills: ['Structural Engineering', 'Architectural Design', 'AutoCAD', 'Revit', 'Permitting'],
    isFollowing: true,
  },
  {
    id: 'u4',
    name: 'Jake Morrison',
    title: 'HVAC Technician',
    company: 'Cool Air Solutions',
    location: 'Dallas, TX',
    trade: 'HVAC',
    initials: 'JM',
    avatarColor: '#DC2626',
    verified: false,
    rating: 4.5,
    reviewCount: 34,
    jobsCompleted: 89,
    yearsExp: 6,
    bio: 'EPA 608 certified HVAC tech. Residential and light commercial installs, service, and maintenance. Quick availability.',
    skills: ['HVAC Install', 'AC Repair', 'Heat Pumps', 'Ductwork', 'EPA 608'],
    isFollowing: false,
  },
  {
    id: 'u5',
    name: 'Linda Park',
    title: 'Interior Designer',
    company: 'Park Studio',
    location: 'Austin, TX',
    trade: 'Interior Design',
    initials: 'LP',
    avatarColor: '#D97706',
    verified: true,
    rating: 4.9,
    reviewCount: 71,
    jobsCompleted: 156,
    yearsExp: 9,
    bio: 'NCIDQ certified interior designer. Commercial and luxury residential. Full-service from space planning to FF&E procurement.',
    skills: ['Space Planning', 'FF&E', 'Commercial Design', 'CAD', 'Project Coordination'],
    isFollowing: false,
  },
];

export const jobs: Job[] = [
  {
    id: 'j1',
    title: 'Commercial Electrical Subcontractor Needed',
    company: 'Apex Building Group',
    companyInitials: 'AB',
    companyColor: '#2563EB',
    location: 'Austin, TX',
    type: 'Subcontract',
    trade: 'Electrical',
    description: 'Seeking a licensed electrical contractor for a 45,000 sq ft office build-out in downtown Austin. Scope includes full electrical rough-in, trim-out, fire alarm rough, and lighting controls. 14-week project schedule.',
    budget: '$280,000–$340,000',
    postedAt: '2 hours ago',
    skills: ['Commercial Wiring', 'Fire Alarm', 'Lighting Controls', 'Panel Installation'],
    bidsCount: 4,
    isNew: true,
    isFeatured: true,
  },
  {
    id: 'j2',
    title: 'Journeyman Plumber – Hotel Renovation',
    company: 'Lone Star Mechanical',
    companyInitials: 'LS',
    companyColor: '#059669',
    location: 'San Antonio, TX',
    type: 'Contract',
    trade: 'Plumbing',
    description: 'Looking for 2–3 journeyman plumbers for a 180-room hotel renovation. Work includes full bathroom remodels, corridor rough-in, and mechanical room upgrades. Prevailing wage project.',
    budget: '$38–$52/hr',
    postedAt: '5 hours ago',
    skills: ['Commercial Plumbing', 'Hotel/Hospitality', 'Prevailing Wage'],
    bidsCount: 9,
    isNew: true,
  },
  {
    id: 'j3',
    title: 'Concrete Subcontractor – Warehouse Foundation',
    company: 'TexBuild Partners',
    companyInitials: 'TP',
    companyColor: '#7C3AED',
    location: 'Houston, TX',
    type: 'Subcontract',
    trade: 'Concrete',
    description: 'Bidding out concrete scope for a 120,000 sq ft distribution warehouse. Scope includes foundations, slab-on-grade, tilt walls, and flatwork. Union project.',
    budget: '$850,000–$1.1M',
    postedAt: '1 day ago',
    skills: ['Foundations', 'Slab Work', 'Tilt-Up', 'Flatwork'],
    bidsCount: 6,
  },
  {
    id: 'j4',
    title: 'HVAC Service Technician – Full Time',
    company: 'AirPro Commercial Services',
    companyInitials: 'AP',
    companyColor: '#DC2626',
    location: 'Dallas, TX',
    type: 'Full-time',
    trade: 'HVAC',
    description: 'Growing HVAC company hiring experienced service tech. You will handle PM contracts and service calls on commercial equipment. Company van, tools, and benefits provided.',
    budget: '$28–$38/hr + Benefits',
    postedAt: '2 days ago',
    skills: ['HVAC Service', 'Commercial Equipment', 'EPA 608', 'Customer Service'],
    bidsCount: 11,
  },
  {
    id: 'j5',
    title: 'Roofing Subcontractor – Apartment Complex',
    company: 'Summit Development',
    companyInitials: 'SD',
    companyColor: '#D97706',
    location: 'Austin, TX',
    type: 'Subcontract',
    trade: 'Roofing',
    description: 'Need qualified roofing contractor for a 240-unit apartment complex re-roof. Approximately 180,000 sq ft of TPO roofing. Project begins Q2.',
    budget: '$1.2M–$1.5M',
    postedAt: '3 days ago',
    skills: ['TPO Roofing', 'Commercial Roofing', 'Large Scale Projects'],
    bidsCount: 3,
  },
  {
    id: 'j6',
    title: 'Carpenter – Restaurant Finish-Out',
    company: 'Hospitality Build Group',
    companyInitials: 'HB',
    companyColor: '#0891B2',
    location: 'Austin, TX',
    type: 'Contract',
    trade: 'Carpentry',
    description: 'Finish carpenter needed for a high-end restaurant build-out. Custom millwork, bar, and dining area. Attention to detail required. Photos of past work required with bid.',
    budget: '$45–$60/hr',
    postedAt: '4 days ago',
    skills: ['Finish Carpentry', 'Custom Millwork', 'Restaurant Build-out'],
    bidsCount: 7,
  },
];

export const posts: Post[] = [
  {
    id: 'p1',
    author: users[0],
    post_type: 'project_update',
    content: 'Just wrapped up a 28,000 sq ft office build for a fintech startup here in Austin. 14 months from groundbreak to CO. Incredibly proud of this team — every trade showed up and delivered. This is what happens when communication is right and expectations are set early.\n\nKey takeaways: weekly all-hands, transparent budget tracking, and a solid pre-con process. Happy to share our project management approach with anyone building their own process.',
    tags: ['GeneralContracting', 'ProjectManagement', 'CommercialConstruction'],
    likes: 142,
    comments: 31,
    shares: 18,
    postedAt: '3 hours ago',
    isLiked: false,
  },
  {
    id: 'p2',
    author: users[2],
    post_type: 'trade_tip',
    content: 'Quick tip for anyone doing residential additions in Texas: ALWAYS verify the setback requirements BEFORE your client gets too excited about the design. Had two consultations this week where the homeowner already had a design in mind that was 3 feet into the required setback. Save everyone time — pull the plat and zoning ordinance on day one.',
    tags: ['Architecture', 'DesignTips', 'ZoningLaw', 'Texas'],
    likes: 89,
    comments: 14,
    shares: 22,
    postedAt: '6 hours ago',
    isLiked: true,
  },
  {
    id: 'p3',
    author: users[1],
    post_type: 'safety_alert',
    content: 'SAFETY ALERT: Had a near-miss on site today — unsecured scaffolding on the 3rd floor. Please double-check your fall protection setups at the start of every shift, no exceptions. Lives are more important than schedule. Share this with your crew.',
    tags: ['Safety', 'FallProtection', 'SiteManagement'],
    likes: 204,
    comments: 47,
    shares: 31,
    postedAt: '1 day ago',
    isLiked: false,
  },
  {
    id: 'p4',
    author: users[3],
    post_type: 'job_post',
    content: 'NOW HIRING: 2 EPA-certified HVAC technicians for commercial service contracts in the DFW area. Full-time, $32–$42/hr DOE. Company vehicle, gas card, and full benefits. Must have 3+ years commercial experience. DM me or apply at our website.',
    tags: ['HVAC', 'NowHiring', 'DFW', 'CommercialHVAC'],
    likes: 58,
    comments: 22,
    shares: 14,
    postedAt: '2 days ago',
    isLiked: false,
    is_urgent: true,
  },
  {
    id: 'p5',
    author: users[4],
    post_type: 'project_update',
    content: 'Working on a beautiful boutique hotel lobby redesign in downtown San Antonio. Sharing some early FF&E selections — love when a client trusts the process and we can really push the design. Natural materials, warm lighting, local artist feature wall. More to come as the project progresses.',
    tags: ['InteriorDesign', 'HospitalityDesign', 'SanAntonio', 'FFandE'],
    likes: 178,
    comments: 29,
    shares: 15,
    postedAt: '3 days ago',
    isLiked: false,
  },
  {
    id: 'p6',
    author: users[0],
    post_type: 'bid_post',
    content: 'Open bid on a 12-unit townhome complex in North Austin. Seeking qualified subs for: framing, MEP rough-in, exterior cladding, and finish work. Bonded GC, payment bond in place. Project starts Q3. Send your prelim numbers to bid by April 15.',
    tags: ['OpenBid', 'AustinConstruction', 'Subcontractors'],
    likes: 67,
    comments: 18,
    shares: 9,
    postedAt: '4 days ago',
    isLiked: false,
  },
];

export const myBids: Bid[] = [
  {
    id: 'b1',
    jobId: 'j2',
    jobTitle: 'Journeyman Plumber – Hotel Renovation',
    company: 'Lone Star Mechanical',
    amount: '$44/hr',
    status: 'shortlisted',
    submittedAt: '4 hours ago',
  },
  {
    id: 'b2',
    jobId: 'j4',
    jobTitle: 'HVAC Service Technician – Full Time',
    company: 'AirPro Commercial Services',
    amount: '$32/hr',
    status: 'pending',
    submittedAt: '1 day ago',
  },
  {
    id: 'b3',
    jobId: 'j6',
    jobTitle: 'Carpenter – Restaurant Finish-Out',
    company: 'Hospitality Build Group',
    amount: '$52/hr',
    status: 'rejected',
    submittedAt: '3 days ago',
  },
];

export const tradeOptions = [
  'All Trades', 'Carpentry', 'Concrete', 'Drywall', 'Electrical',
  'Engineering', 'General Contractor', 'HVAC', 'Interior Design',
  'Masonry', 'Painting', 'Plumbing', 'Roofing', 'Steel/Ironwork', 'Tile',
];

export const jobTypeOptions = ['All Types', 'Full-time', 'Contract', 'Per-diem', 'Subcontract'];
