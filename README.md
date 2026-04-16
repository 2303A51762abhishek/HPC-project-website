# EV Vehicle Management System

A comprehensive electric vehicle management system with MongoDB backend and React frontend.

## Features

### Admin Dashboard
- **Dashboard**: Overview of key metrics and quick actions
- **Vehicle Management**: Add, edit, delete vehicles with detailed specifications
- **Offer Management**: Create and manage promotional offers
- **Inventory Management**: Track stock levels and vehicle status
- **Customer Management**: Manage customer database and interactions
- **Inquiry Management**: Handle customer inquiries and support requests
- **Analytics**: Comprehensive reports and data visualization
- **Notifications**: System alerts and important updates
- **Settings**: Configure system preferences and options

### User Features
- Browse electric vehicles with detailed specifications
- View active offers and discounts
- Interactive vehicle comparison
- Color selection and customization
- Responsive design for all devices

## Technology Stack

### Frontend
- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- Radix UI components
- React Router for navigation
- Axios for API calls
- Recharts for data visualization

### Backend
- Node.js with Express
- MongoDB with Mongoose
- JWT authentication
- Express validation
- CORS and security middleware
- RESTful API design

## Setup Instructions

### Prerequisites
- Node.js (v18 or higher)
- MongoDB (local or cloud)
- npm or yarn

### Backend Setup

1. Navigate to the server directory:
```bash
cd EV/server
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp env.example .env
```

4. Update `.env` with your MongoDB connection string:
```
MONGODB_URI=mongodb://localhost:27017/ev_vehicles
PORT=5000
JWT_SECRET=your-secret-key
```

5. Start the server:
```bash
npm run dev
```

6. (Optional) Seed the database:
```bash
npm run seed
```

### Frontend Setup

1. Navigate to the main directory:
```bash
cd EV
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp env.example .env
```

4. Update `.env` with your API URL:
```
VITE_API_URL=http://localhost:5000/api
```

5. Start the development server:
```bash
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/profile` - Get user profile

### Vehicles
- `GET /api/vehicles` - Get all vehicles
- `POST /api/vehicles` - Create new vehicle
- `PUT /api/vehicles/:id` - Update vehicle
- `DELETE /api/vehicles/:id` - Delete vehicle
- `PATCH /api/vehicles/:id/inventory` - Update inventory

### Offers
- `GET /api/offers` - Get all offers
- `POST /api/offers` - Create new offer
- `PUT /api/offers/:id` - Update offer
- `DELETE /api/offers/:id` - Delete offer

### Customers
- `GET /api/customers` - Get all customers
- `POST /api/customers` - Create new customer
- `PUT /api/customers/:id` - Update customer
- `POST /api/customers/:id/purchases` - Add purchase record

### Analytics
- `GET /api/analytics/dashboard` - Dashboard data
- `GET /api/analytics/sales` - Sales analytics
- `GET /api/analytics/inventory` - Inventory analytics

## Database Schema

### Vehicle
- Basic info: name, brand, price, year
- Specifications: charging time, range, battery, top speed
- Inventory: stock, reserved, status
- Metadata: colors, images, tags, category

### Offer
- Vehicle reference
- Discount details
- Validity period
- Usage tracking

### Customer
- Personal information
- Contact details
- Purchase history
- Test drive history

### Inquiry
- Customer reference
- Inquiry type and priority
- Message and responses
- Status tracking

## Development

### Running Tests
```bash
# Backend tests
cd server && npm test

# Frontend tests
npm test
```

### Building for Production
```bash
# Backend
cd server && npm run build

# Frontend
npm run build
```

## Production deployment (Vercel + Render + MongoDB Atlas)

This project is tested for a production stack where the frontend is hosted on Vercel, the backend on Render, and MongoDB is hosted on MongoDB Atlas. The steps below are a minimal, repeatable guide to get the app into production. Adjust names, regions, and sizing to your needs.

1. Prepare MongoDB Atlas
	- Create a new cluster in MongoDB Atlas and whitelist your trusted IPs (or enable access from anywhere while you configure the app, then lock it down).
	- Create a database user with a strong password and copy the connection string (URI).
	- Optional: import seed data using the `/server/seed.js` script or MongoDB Compass.

2. Deploy the backend to Render
	- Create a new Web Service on Render and link the GitHub repo.
	- Set the Build Command: `npm install && npm run build`
	- Set the Start Command: `npm run start` (or `node server.js` depending on your scripts)
	- Add environment variables in Render (use the keys below). Example:
	  - `MONGODB_URI` = your Atlas connection string
	  - `PORT` = 5000
	  - `JWT_SECRET` = a secure random string
	  - `ADMIN_SECRET` = (optional) secret used when creating admin users
	  - `NODE_ENV` = production
	- Enable health checks and automatic deploys from the main branch.

3. Deploy the frontend to Vercel
	- Create a new Vercel project and link the GitHub repo.
	- Set the Build Command: `npm run build`
	- Set the Output Directory: `dist` (Vite default)
	- Add environment variables in Vercel (Environment: Production):
	  - `VITE_API_URL` = `https://your-backend-service.onrender.com/api`
	- Deploy and confirm the site loads.

4. Post-deploy checks
	- Confirm the frontend can reach the backend (open devtools, check network requests).
	- Verify CORS settings on the backend allow the Vercel origin in production. In server, the CORS policy should restrict origins except in development.
	- Seed the database if needed (use Render shell or connect via Atlas and run `node server/seed.js`).
	- Check logs on Render and Vercel for errors and fix any missing env vars.

5. Recommended production hardening
	- Ensure `NODE_ENV=production` on backend and frontend builds.
	- Use HTTPS-only connections (Vercel/Render provide this by default).
	- Rotate and store secrets in each host's environment secret manager (don't commit secrets to repo).
	- Enable rate-limiting (express-rate-limit) and security headers (helmet) on the backend.
	- Configure monitoring/alerts (Render logs, Vercel analytics, Sentry for errors).

6. Useful environment variables
	- Backend (Render): `MONGODB_URI`, `JWT_SECRET`, `ADMIN_SECRET`, `PORT`, `NODE_ENV`
	- Frontend (Vercel): `VITE_API_URL` (must point to backend /api endpoint)

If you'd like, I can create a short `deploy.md` with screenshots and example Render/Vercel settings, or generate a simple GitHub Actions workflow to automate deploys. Tell me which you'd prefer next.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please contact the development team or create an issue in the repository.