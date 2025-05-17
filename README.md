#     <p align="center">BeMazady 🧠🛒 </p>

![Logo](extra/logo.jpg)

**BeMazady** is an AI-enhanced online auction and e-commerce backend system. It enables buyers and sellers to interact in real-time auctions or traditional purchases, supported by intelligent recommendations and automated content verification.

---

## 🚀 Features

- 🛍️ Full e-commerce & auction support
- 🤖 Hybrid AI system with:
  - **Recommendation engine**
  - **Auto-enlisting validator** using **NLP** + **CNN**
- 📦 Modular REST API structure with well-separated routes
- 🔐 JWT-based authentication with role support (Admin, Seller, Buyer)
- 📬 Email integration and real-time notifications
- 💳 Payment gateway via Stripe
- ☁️ Image handling via Cloudinary
- 📊 Analytics routes for users, sellers, and admins

---

## 🛠️ Tech Stack

- **Backend:** Node.js, Express.js
- **Database:** MongoDB (Atlas)
- **AI:** Hybrid Recommendation System, CNN/NLP for item validation
- **Auth:** JWT
- **Payment:** Stripe
- **Storage:** Cloudinary
- **Containerization:** Docker (local, optional)

---

## 📁 API Endpoints Overview

All APIs are prefixed with `/api`. Key routes include:

- `/categories` — Item categories
- `/subcategories` — Nested subcategories
- `/items` — CRUD for store items
- `/auctions` — Auction creation & participation
- `/reverseauctions` — Reverse auction logic
- `/recommendations` — AI-powered suggestions
- `/auth` — Register/login/logout
- `/users` — User profiles and roles
- `/cart` — Shopping cart operations
- `/orders` — Order placement & history
- `/payments` — Stripe integration
- `/notifications` — User alerts & updates
- `/messages` — Messaging between users
- `/analytics` — Metrics dashboard for admins & sellers

Root Route:  
```bash
GET /
Response: "Api is running ya tohamy"
```
---

## 🛡️ Authentication & Roles

- JWT Auth with token expiry
- Roles:
  - **Admin** – full access
  - **Seller** – manage auctions/items
  - **Buyer** – place bids & orders

---

## 📦 Getting Started

### Prerequisites

- Node.js v18+
- MongoDB Atlas (or local instance)
- A `.env` file (see `.env.example`)
- Cloudinary & Stripe accounts

---

### 🧪 Installation

```bash
git clone https://github.com/yourusername/BeMazady2.git
cd BeMazady2
npm install
```

### 🔐 Environment Variables

Copy `.env.example` to `.env` and fill in your secrets.

---

### 📄 `.env.example`

```env
PORT=3000
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=1d

MAILER_HOST=smtp.gmail.com
MAILER_PORT=465
MAILER_EMAIL=your_email@gmail.com
MAILER_PASSWORD=your_email_app_password

Stripe_API_KEY=your_Stripe_api_key
Stripe_INTEGRATION_ID=your_integration_id
Stripe_IFRAME_ID=your_iframe_id
Stripe_HMAC_SECRET=your_hmac_secret

CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret
```

### 🚀 Run the App

```bash
npm start
```

---

## 📂 Folder Structure

Each module (e.g., `Auction`, `User`, `Recommend`, etc.) is organized in its own route/controller/model structure, ensuring clean separation of concerns.


## 📧 Contact

Have questions or want to collaborate?  
📬 [youssef.hussain9000@gmail.com](mailto:youssef.hussain9000@gmail.com)

---

## 📄 License

This project is licensed for academic/demo use. For commercial use, please contact the author.
