# Private Coach — Personal Trainer Web App

**A comprehensive full-stack web application connecting personal trainers with clients through intelligent scheduling, payment processing, and workout management.**

[![React](https://img.shields.io/badge/React-18.0-blue?logo=react)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green?logo=fastapi)](https://fastapi.tiangolo.com/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.0-blue?logo=tailwindcss)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-orange?logo=mysql)](https://www.mysql.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

![Private Coach Logo](./docs/images/logo.png)

## Overview

**Private Coach** is a modern, full-stack web application designed to revolutionize the personal training industry by providing a seamless platform for trainers, clients, and business administrators (e.g. Accountant/Business Owner) to manage their fitness journey together.

The application addresses the common challenges in personal training businesses: complex scheduling, payment tracking, client management, and workout coordination. With our intelligent scheduling system powered by Google OR-Tools optimization, automated PayPal payment processing, and role-based dashboards, Private Coach eliminates administrative overhead and enhances the fitness experience.

Whether for a personal trainer who is looking to streamline his client management, a fitness enthusiast seeking personalized training, or a business owner managing multiple coaches, Private Coach provides the tools and insights needed to achieve their goals efficiently.

---

## About our Fitness Studio

## Before You Watch The Videos

To make the most of these demo videos, here is a quick overview of how our fitness studio operates:  

At `Private Coach` we open 7 days a week,  
our morning shift is from 8:00am till 12pm, and evening shift is from 2:00pm till 10:00pm, our lunch break is since 12:00pm till 2:00pm.
we have multiple coaches at our studio, currently at 6, some of them work a morning shifts only, some evening shifts only, all coaches are working 7 days a week.  
Each client can be assigned to coach, he can book a session only when his coach is working (both manual booking and AI-suggestions shows only available times for his coach).  
A session is 1 hour long, and the capacity of our studio is 10 people at the same hour, so if there are 10 booked clients in this hour, it will be unavailable for further bookings.  
Now enjoy `Private Coach` in action :D

NOTE: this is all interchangable depending on the fitness studio who is using the app.

## Demo

Below is a  preview of the `Private Coach` web app in action:  

- For your convenience, I've split the demonstration into 3 focused segments covering each user role.

Note: Some dropdown menus and UI elements were not captured properly in the screen recording, so i have included screenshots below each demo section to show these missing components.

### Part 1 - Client

[![Client Demo](./docs/videos/GifDemo-1.gif)](https://youtu.be/_ulIpijx6fI)  
*Click the GIF above to watch the full Client Demo on YouTube*

**Here are the un-displayed parts:**  

- if we hold on the red dot on top of the `Profile` button, it will show a messege:
![CompleteYourProfile](docs/screenshots/CompleteYourProfile.jpg)  

- here is the drop down table to choose how many ai-suggested sessions you want to book:
![SessionsToBook](docs/screenshots/SessionsToBook.png)  

**And here we can see the database changes:**  

- The Demo client was saved to `Users` table  
![DemoClient-DB](docs/screenshots/DemoClientDB.png)  

- The 3 bookings were saved to `Bookings` table (Coach ID: 35, Client ID: 36)  
![BookingsDB](docs/screenshots/BookingsDB.png)  

- The payment got recorded in the database (Payment ID: 49) in `Payments` table  
![PaymentDB](docs/screenshots/PaymentDB.png)  

- The coach-client relationship also got documented in `coach_clients` table (last one)  
![relationDB](docs/screenshots/relationDB.png)

### Part 2 - Coach

[![Coach Demo](./docs/videos/GifDemo-2.gif)](https://youtu.be/kTFCgvwl1TA)  
*Click the GIF above to watch the full Coach Demo on YouTube*  

**Here are the un-displayed parts:**  

- when a coach approve to assign a workout-plan for a client, he have to choose 1 of these  
![PlanTypesCoach](docs/screenshots/PlanTypesCoach.png)  

- a coach can filter his client sessions by status, (e.g. pending or confirmed)  
![StatusFilteringCoach](docs/screenshots/StatusFilteringCoach.png)  

**And here we can see the database changes:**  

- The approved plan for the Demo client appeared in `client_plans` table (last one)  
![clientPlanDB](docs/screenshots/clientPlanDB.png)

### Part 3 - Accountant

[![Accountant Demo](./docs/videos/GifDemo-3.gif)](https://youtu.be/k5CxWVs1wCs)  
*Click the GIF above to watch the full Accountant Demo on YouTube*  

**Here are the un-displayed parts:**  

- The accountant can filter the revuene by date  
![RevunueFiltering](docs/screenshots/RevunueFiltering.png)  

- accountant can export the CSV. file, for some reason it didint appear in the video, so here is example of what it look like  
![CSVfile](docs/screenshots/CSVfile.png)  

**And here we can see the database changes:**  

- We can see the manual payment added here in `Payments` table  
![manualplanDB1](docs/screenshots/manualplanDB1.png)

---

### Key Features

#### **Client Features**

- **Subscription Management** - Choose from monthly, quarterly, or yearly plans with secure PayPal integration
- **Coach Selection** - Browse available coaches, view their schedules, and select the perfect trainer for your goals
- **Plan Requests** - Request personalized workout plans from your assigned coach (AB, ABC, PPL, or 5-day programs)
- **Smart Booking System** - Book sessions manually or use AI-powered suggestions for optimal scheduling
- **Profile Management** - Complete profile setup with time preferences, contact information, and fitness goals
- **Payment Processing** - Secure subscription payments and transaction history tracking
- **Session Tracking** - View upcoming bookings, session history, and training progress

#### **Coach Features**

- **Client Management** - View and manage your assigned clients with detailed information
- **Workout Plan Assignment** - Create and assign personalized training plans (AB, ABC, PPL, 5-day split programs)
- **Booking Management** - Accept or decline pending session requests from clients
- **Schedule Optimization** - Manage your availability and working hours (morning/evening shifts)
- **Client Progress Tracking** - Monitor client attendance, progress, and training consistency
- **Session Oversight** - View upcoming sessions, confirmed bookings, and client interaction history
- **Profile Completion** - Maintain professional profile

#### **Accountant Features**

- **Revenue Analytics** - financial tracking with monthly, quarterly, and yearly insights
- **Coach Performance Monitoring** - Track each coachs active client count and revenue generation
- **Client Payment History** - Detailed view of all client subscriptions, payments, and transaction records
- **Business Intelligence** - Export financial data, generate reports, and analyze business metrics
- **User Management** - track all system users including clients, coaches, and their account statuses
- **Payment Oversight** - Monitor subscription statuses, manual payments, and revenue trends
- **Data Export** - Generate CSV reports for external analysis and accounting purposes

### Built With

**Frontend:**

- React 18 with TypeScript - Component-based UI framework
- Vite - development server
- TailwindCSS - CSS framework
- React Router - Client-side routing

**Backend:**

- FastAPI (Python) - Web framework for building APIs
- SQLAlchemy - Connects Python code to MySQL database
- Alembic - Adds new tables/columns to existing database without losing data
- Uvicorn - Backend server that runs our FastAPI application
- JWT Authentication - Secure user login system

**Database:**

- MySQL 8.0 - Stores all application data

**External APIs:**

- PayPal - Handles payments and subscriptions
- Google OR-Tools - AI scheduling optimization

---

### Application Flow

**How the application works:**

1. **User Interaction**: User clicks a button or submits a form on the React frontend
2. **API Request**: Frontend sends HTTP request to FastAPI backend endpoint
3. **Authentication Check**: Backend verifies JWT token to ensure user is logged in
4. **Database Operation**: Backend uses SQLAlchemy to query or update MySQL database
5. **Response**: Backend sends data back to frontend as JSON
6. **UI Update**: React updates the interface to show the new information

**External Services:**

- **PayPal Integration**:
  - Handles subscription payments and transaction processing
  - Uses PayPal webhooks to receive real-time payment notifications
  - We use ngrok to create a secure tunnel from PayPal's servers to our localhost
  - This allows PayPal to send webhook events (payment confirmations, subscription updates) directly to our local environment

- **Google OR-Tools (AI Scheduling)**:
  - Powers the intelligent session booking suggestions
  - Uses constraint programming to find optimal time slots
  - Key constraints include: coach availability, client time preferences, studio capacity (max 10 people per hour), existing bookings, and business hours
  - The AI considers all these factors to suggest the best possible booking times for each client

---

### Security Features

- **User Login System** - Secure login tokens that keep you logged in safely
- **Permission Control** - Each user type (client, coach, accountant) can only access their own features
- **Password Protection** - Passwords are encrypted (hashed then saved to the database) and you can show/hide them when typing
- **Profile Checks** - System warns you if important profile information is missing
- **Safe Payments** - All payments go through PayPal's secure payment system

---

## Setup - How to Start the App

Before running the application, make sure you have these installed:

- **Python 3.12+** - Backend programming language
- **Node.js 18+** and npm - Frontend development tools
- **MySQL 8.0** - Database server
- **Git** - Version control
- **ngrok** - Tunneling tool for PayPal webhooks (download from ngrok.com) - needed only for smooth payments

### Installation Steps

#### Step 1: Get the Code

```bash
git clone https://github.com/Basel6/Private-Coach.git
cd Private-Coach
```

#### Step 2: Setup Backend (Python/FastAPI)

```bash
# Create a virtual environment (keeps Python packages separate)
python -m venv .venv

# Activate the virtual environment
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # macOS/Linux

# Install all required Python packages
pip install -r requirements.txt

# Create environment file with your settings
# Create a new file called .env in the root directory
# Add your database and PayPal credentials (see Environment Configuration section below)

# Create database tables
alembic upgrade head
```

#### Step 3: Setup Frontend (React/Vite)

```bash
# Go to frontend folder
cd frontend

# Install all required Node.js packages
npm install
```

#### Step 4: Setup ngrok (PayPal Webhook Tunnel) - safe to ignore if you dont want to test payments deeply

- Download ngrok from <https://ngrok.com/>
- Extract to a folder (example: C:\ngrok\)
- This creates a secure tunnel so PayPal can send payment notifications to your local computer

### Running the Application

**Important: You need 3 terminals running at the same time**  

#### Terminal 1: Start Backend Server

```bash
# Make sure you're in the main project folder and virtual environment is active
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

![uvicornTerminal](docs/screenshots/uvicornTerminal.png)  

#### Terminal 2: Start Frontend Server

```bash
# Go to frontend folder
cd frontend

# Start the React development server
npm run dev
```

![ViteTerminal](docs/screenshots/ViteTerminal.png)

#### Terminal 3: Start ngrok Tunnel

```bash
# Replace C:\ngrok\ with your actual ngrok installation path
C:\ngrok\ngrok.exe http 8000 --host-header=localhost:8000
```

![ngrok](docs/screenshots/ngrok.png)

**Note:** The ngrok path (C:\ngrok\) might be different on your computer. Use the path where you extracted ngrok.

### Access Your Application

Once all 3 terminals are running, you can access:

- **Frontend (Main App)**: <http://localhost:5173>
- **Backend API**: <http://localhost:8000>
- **API Documentation**: <http://localhost:8000/docs> (was used for backend testing before building the frontend)
- **ngrok Public URL**: Check your ngrok terminal for the public URL (used for PayPal webhooks)

### Environment Configuration

Create a `.env` file in the root directory with:

```env
# Database Configuration
DATABASE_URL=mysql+pymysql://username:password@localhost/private_coach

# JWT Security
JWT_SECRET=your-super-secret-jwt-key
JWT_ALGORITHM=HS256
JWT_EXPIRATION_SECONDS=3600

# PayPal Integration
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret
PAYPAL_MODE=sandbox  # or 'live' for production

# Application URLs
FRONTEND_SUCCESS_URL=http://localhost:5173/dashboard?payment=success
FRONTEND_CANCEL_URL=http://localhost:5173/dashboard?payment=cancelled
```

## Author

**Basel Shaer**  

## Supervised by

**Prof. Roi Poranne**  

---
