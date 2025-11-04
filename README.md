# Admin Dashboard

A modern admin dashboard built with React (frontend) and Node.js/Express (backend), integrated with Supabase for database and authentication.

## 🚀 Features

- **Authentication**: Secure login/signup using Supabase Auth
- **User Management**: Full CRUD operations for managing users
- **Dashboard Analytics**: Overview of key metrics and statistics
- **Responsive Design**: Beautiful UI that works on all devices
- **REST API**: Express backend with RESTful endpoints
- **Real-time Data**: Integration with Supabase for real-time updates

## 📁 Project Structure

```
ADMIN-CLEANBOX/
├── frontend/          # React application (Vite)
│   ├── src/
│   │   ├── api/      # API client configuration
│   │   ├── components/  # Reusable components
│   │   ├── config/   # Configuration files (Supabase)
│   │   ├── pages/    # Page components
│   │   ├── App.jsx   # Main app component
│   │   └── main.jsx  # Entry point
│   ├── .env          # Frontend environment variables
│   └── package.json
│
└── backend/          # Node.js/Express API
    ├── server.js     # Main server file
    ├── .env          # Backend environment variables
    └── package.json
```

## 🛠️ Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Supabase account

### 1. Clone and Setup

```bash
cd ADMIN-CLEANBOX
```

### 2. Configure Supabase

1. Go to [Supabase](https://supabase.com) and create a new project
2. Copy your project URL and API keys
3. Set up your database schema (example below)

#### Example Supabase Schema

```sql
-- Create users table
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to read
CREATE POLICY "Allow authenticated read access" ON users
  FOR SELECT USING (auth.role() = 'authenticated');

-- Create policy to allow service role full access
CREATE POLICY "Allow service role full access" ON users
  FOR ALL USING (auth.role() = 'service_role');
```

### 3. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Configure environment variables
# Edit the .env file with your Supabase credentials
```

**Backend `.env` file:**

```env
PORT=3001
NODE_ENV=development

# Get these from your Supabase project settings
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

FRONTEND_URL=http://localhost:5173
```

**Start the backend server:**

```bash
npm run dev
# Server will run on http://localhost:3001
```

### 4. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment variables
# Edit the .env file with your Supabase credentials
```

**Frontend `.env` file:**

```env
# Get these from your Supabase project settings
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

VITE_API_URL=http://localhost:3001
```

**Start the frontend development server:**

```bash
npm run dev
# App will run on http://localhost:5173
```

## 🔐 Getting Your Supabase Keys

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. Copy the following:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_KEY` (⚠️ Keep this secret!)

## 📚 API Endpoints

### Health Check

```
GET /api/health
```

### Users

```
GET    /api/users       # Get all users
GET    /api/users/:id   # Get user by ID
POST   /api/users       # Create new user
PUT    /api/users/:id   # Update user
DELETE /api/users/:id   # Delete user
```

## 🎨 Frontend Pages

- **Login (`/login`)**: Authentication page
- **Dashboard (`/`)**: Main dashboard with statistics
- **Users (`/users`)**: User management interface

## 🚀 Deployment

### Backend Deployment (e.g., Railway, Render, Heroku)

1. Set environment variables on your hosting platform
2. Deploy the `backend` directory
3. Update `FRONTEND_URL` to your production frontend URL

### Frontend Deployment (e.g., Vercel, Netlify)

1. Set environment variables on your hosting platform
2. Deploy the `frontend` directory
3. Update `VITE_API_URL` to your production backend URL

## 🔧 Available Scripts

### Backend

- `npm start` - Start production server
- `npm run dev` - Start development server with auto-reload

### Frontend

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🆘 Troubleshooting

### Common Issues

1. **"Missing Supabase configuration"**

   - Make sure all environment variables are set correctly in your `.env` files
   - Restart both servers after changing `.env` files

2. **CORS errors**

   - Ensure `FRONTEND_URL` in backend `.env` matches your frontend URL
   - Check that both servers are running

3. **Authentication not working**

   - Verify Supabase keys are correct
   - Check browser console for errors
   - Ensure Row Level Security policies are set up correctly

4. **Database errors**
   - Make sure you've created the required tables in Supabase
   - Check that your service role key has proper permissions

## 📞 Support

For issues and questions, please create an issue in the repository.

