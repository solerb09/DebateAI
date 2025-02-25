

### Backend Setup
```bash
cd backend
npm install
npm run dev  # Start with nodemon for development
# or
npm start    # Start for production
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev  # Start development server
# or
npm run build  # Build for production
```

Create a .env file in the backend directory with the following:
```
PORT=5080
CLIENT_URL=http://localhost:5173
NODE_ENV=development 
```