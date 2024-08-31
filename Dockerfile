# Stage 1: Build Angular Application
FROM node:20.11.0 AS builder

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and install dependencies
COPY package*.json ./
COPY angular.json ./
COPY custom-webpack.config.js ./
COPY ts*.json ./

# Install Angular CLI dependencies
RUN npm install

# Copy the Angular application code to the working directory
COPY projects/ngx-ramblers /usr/src/app/projects/ngx-ramblers

# Build the Angular application using the locally installed Angular CLI
RUN npx ng build --project ngx-ramblers --build-optimizer --progress --configuration production

# Stage 2: Build and run the server application
FROM node:20.11.0

# Set the working directory for the server
WORKDIR /usr/src/app/server

# Copy server-specific files
COPY server/package*.json ./
COPY server/ts*.json ./
COPY server/lib* ./
COPY server/serenity-js ./
COPY server/.mocharc.yml ./
COPY server/protractor.conf.js ./

# Install server dependencies
RUN npm install

# Copy built Angular app from builder stage
COPY --from=builder /usr/src/app/dist /usr/src/app/dist

# Copy the server application code
COPY server /usr/src/app/server

# Define the command to run the server application
CMD ["npm", "run", "server", "--prefix", "server"]
