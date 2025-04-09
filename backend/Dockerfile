# Use official Node.js image
FROM node:20-slim

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy the rest of your backend code
COPY . .

# Set environment variables (optional defaults)
ENV PORT=8080

# Expose the port Cloud Run will use
EXPOSE 8080

# Start your app (you can change to "npm run start" if you use scripts)
CMD ["npm", "run", "start"]
