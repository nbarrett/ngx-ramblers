# Use the official Node.js image as the base image
FROM node:20.11.0

# Define build arguments
ARG CHROME_VERSION
ARG CHROMEDRIVER_VERSION

# Install dependencies for Chrome installation
RUN apt-get update && apt-get install -y wget curl unzip gnupg2 ca-certificates

# Add Google Chrome repository
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
RUN sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list'
RUN apt-get update && apt-get install -y google-chrome-stable

# Download the specified version of Chrome for Testing and its Chromedriver
RUN curl -Lo /tmp/chrome.zip "https://storage.googleapis.com/chrome-for-testing-public/${CHROME_VERSION}/linux64/chrome-linux64.zip" && \
    curl -Lo /tmp/chromedriver.zip "https://storage.googleapis.com/chrome-for-testing-public/${CHROMEDRIVER_VERSION}/linux64/chromedriver-linux64.zip" && \
    unzip /tmp/chrome.zip -d /usr/local/ && \
    unzip /tmp/chromedriver.zip -d /usr/local/bin/ && \
    rm /tmp/chrome.zip /tmp/chromedriver.zip

# Add Chrome to PATH
ENV CHROME_BIN=/usr/local/chrome-linux64/chrome

# Set CHROMEDRIVER_PATH environment variable
ENV CHROMEDRIVER_PATH=/usr/local/bin/chromedriver

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

WORKDIR /usr/src/app
# Define the command to run the server application
CMD ["npm", "run", "server", "--prefix", "server"]
