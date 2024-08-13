# Use the official Node.js image as the base image
FROM node:20.16.0

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Copy Angular configuration files
COPY angular.json ./
COPY custom-webpack.config.js ./
COPY ts*.json ./

# Copy the Angular application code to the working directory
COPY projects/ngx-ramblers /usr/src/app/projects/ngx-ramblers

# Install the dependencies
RUN npm install

# Build the Angular application using the locally installed Angular CLI
RUN npx ng build --project ngx-ramblers --build-optimizer --progress --configuration production

# Copy the server application code to the working directory
WORKDIR /usr/src/app/server
COPY server/package*.json ./
COPY server/ts*.json ./
COPY server/lib* ./
COPY server/serenity-js ./
COPY server/.mocharc.yml ./
COPY server/protractor.conf.js ./
COPY server /usr/src/app/server

# Install server dependencies (postinstall will run automatically)
RUN npm install

# Expose the port the application will run on
EXPOSE 5000

# Define the command to run the server application
CMD ["npm", "run", "server", "--prefix", "server"]
