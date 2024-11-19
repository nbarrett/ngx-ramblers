# Use the official Node.js image as the base image
FROM node:20.11.0

# Define build arguments
ARG CHROME_VERSION

# Install dependencies for Chrome installation
RUN apt-get update && apt-get install -y wget curl unzip gnupg2 ca-certificates

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
RUN npx ng build --project ngx-ramblers --progress --configuration production

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

# Update the Serenity BDD dependencies so it doesn't have to run in the step before serenity is run
RUN npm run serenity-bdd-update

# Set environment variables for Chrome and Chromedriver
ENV CHROME_BIN=/usr/src/app/server/chrome/linux-${CHROME_VERSION}/chrome-linux64/chrome
ENV CHROMEDRIVER_PATH=/usr/src/app/server/chromedriver/linux-${CHROME_VERSION}/chromedriver-linux64/chromedriver

# Install Chrome and Chromedriver
RUN npx @puppeteer/browsers install chrome@${CHROME_VERSION} --install-deps
RUN chmod +x /usr/src/app/server/chrome
RUN npx @puppeteer/browsers install chromedriver@${CHROME_VERSION} --install-deps
RUN chmod +x /usr/src/app/server/chromedriver

# Expose the port the application will run on
EXPOSE 5001

WORKDIR /usr/src/app

# Define the command to run the server application
CMD ["npm", "run", "server", "--prefix", "server"]
