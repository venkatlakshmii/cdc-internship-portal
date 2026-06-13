# HITAM CDC Internship Portal

A full-stack web application for managing student internships at Hyderabad Institute of Technology and Management (HITAM). Built for the Career Development Cell (CDC) to streamline the internship application, approval, and reporting workflow.

---

## Features

- **Student Portal** — Apply for internships, submit monthly reports, upload completion certificates, and track application status in real time
- **CDC Dashboard** — Review and approve/reject internship applications, forward to Principal, manage student communication
- **Principal Dashboard** — Final approval/rejection of CDC-forwarded applications
- **Role-Based Login** — Separate login flows for Students, CDC Faculty, and Principal using official `@hitam.org` email addresses
- **Cloud File Storage** — All uploaded documents (offer letters, joining letters, reports) stored securely via Cloudinary
- **MongoDB Atlas** — Cloud-hosted database for all users, applications, reports, and messages
- **Communication Center** — Internal messaging system between students, CDC, and Principal
- **Portal Control** — Admin controls for enabling/disabling internship submission windows

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS, Framer Motion |
| Backend | Node.js, Express.js, TypeScript |
| Database | MongoDB Atlas (Mongoose ODM) |
| File Storage | Cloudinary |
| Auth | JWT (JSON Web Tokens), bcrypt |
| Build Tool | Vite |

---

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- A MongoDB Atlas account and cluster
- A Cloudinary account

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/inderjeetkaranjaiswal/cdc.git
   cd cdc
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**

   Create a `.env` file in the root directory:
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/hitam_cdc
   JWT_SECRET=your_jwt_secret_key
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

   The app will be available at **http://localhost:3000**

---

## Project Structure

```
├── server.ts              # Express backend entry point
├── src/
│   ├── models/            # Mongoose models (User, Internship, Report, etc.)
│   ├── routes/            # API route handlers
│   ├── middleware/        # Auth middleware, file upload (Cloudinary)
│   ├── pages/             # React page components
│   ├── components/        # Shared UI components
│   └── utils/             # Helper utilities (eligibility checks, etc.)
├── public/                # Static assets
└── uploads/               # Local upload directory (dev fallback)
```

---

## User Roles

| Role | Email Format | Access |
|---|---|---|
| Student | `rollnumber@hitam.org` | Apply, report, track status |
| CDC Faculty | `cdc@hitam.org` | Review, approve, message |
| Principal | `principal@hitam.org` | Final approval decisions |

---

## License

This project is developed for internal use at HITAM. All rights reserved.
