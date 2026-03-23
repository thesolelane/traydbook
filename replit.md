# Traydbook

The professional network for the construction trades. Post work, find jobs, submit bids, and build your verified reputation — all in one place built exclusively for contractors, tradespeople, and design professionals.

## Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Routing:** React Router v6
- **Icons:** Lucide React
- **Styling:** Pure CSS custom properties (no CSS framework)

## Project Structure

```
src/
  components/
    Navbar.tsx       - Sticky top navigation with search
    PostCard.tsx     - Social feed post with like/comment/share
    JobCard.tsx      - Job listing card with bid action
    UserCard.tsx     - Professional profile card
    BidModal.tsx     - Bid submission modal
  pages/
    Feed.tsx         - Social feed with post composer + sidebar
    Jobs.tsx         - Job board with search and filters
    Network.tsx      - Professional directory with filters
    Bids.tsx         - My bids tracker with status
    Profile.tsx      - User profile page
  data/
    mockData.ts      - All mock data (users, jobs, posts, bids)
  App.tsx            - Router setup
  main.tsx           - Entry point
  index.css          - Global styles + CSS custom properties
```

## Running the App

- **Dev:** `npm run dev` → http://localhost:5000
- **Build:** `npm run build`
- **Workflow:** "Start application" on port 5000

## Deployment

Configured as a static site:
- Build: `npm run build`
- Serve: `dist/` directory

## Design

- Brand color: `#E85D26` (warm orange)
- Clean, professional UI with a trades-focused aesthetic
- Responsive layout (mobile nav collapses at 768px)
- No external CSS frameworks — pure CSS custom properties

## Key Features

- **Feed** — Social posts with like/comment/share, post composer, suggested connections sidebar
- **Job Board** — Searchable/filterable job listings with bid modal
- **Network** — Professional directory with trade and search filters
- **My Bids** — Track submitted bids with status (pending, shortlisted, accepted, rejected)
- **Profile** — Verified profile with stats, skills, licenses, and posts
