# NOTE: 
    #If building on M1/M2 Mac, always build with --platform linux/amd64 for AWS Fargate compatibility


# Use the official Node.js 20 image.
FROM node:18-alpine

# Set the working directory.
WORKDIR /app

# Copy package.json and package-lock.json to the working directory.
COPY package*.json ./

# 
# Install the dependencies.
RUN npm install

ENV NODE_ENV=production

# Copy the rest of the application code.
COPY .env .env
COPY . .

# Expose the port the app runs on.
EXPOSE 3000

# Define the command to run the app.
CMD ["node", "index.js"]
