# Use the official Node.js image as the base image
# Sync with frontend/server engines (Node 22)
FROM node:22.19.0

# Define build arguments
ARG CHROME_VERSION

# Install dependencies for Chrome installation and sharp
RUN apt-get update && apt-get install -y wget curl unzip gnupg2 ca-certificates libvips-dev build-essential

ARG MONGOSH_VERSION=2.2.7
ARG DBTOOLS_VERSION=100.9.4
RUN curl -fsSL https://pgp.mongodb.com/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg \
  && echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg arch=amd64 ] https://repo.mongodb.org/apt/debian bookworm/mongodb-org/7.0 main" > /etc/apt/sources.list.d/mongodb-org-7.0.list \
  && apt-get update \
  && apt-get install -y mongodb-mongosh mongodb-database-tools \
  && mongosh --version \
  && mongodump --version \
  && mongorestore --version
RUN curl -fsSL https://fly.io/install.sh | FLYCTL_INSTALL=/usr/local sh \
  && ln -sf /usr/local/bin/flyctl /usr/bin/flyctl \
  && flyctl version

# Install OpenJDK 21 JRE manually
RUN wget https://download.java.net/java/GA/jdk21.0.2/f2283984656d49d69e91c558476027ac/13/GPL/openjdk-21.0.2_linux-x64_bin.tar.gz -O /tmp/openjdk-21.tar.gz \
  && mkdir -p /usr/local/openjdk-21 \
  && tar -xzf /tmp/openjdk-21.tar.gz -C /usr/local/openjdk-21 --strip-components=1 \
  && rm /tmp/openjdk-21.tar.gz \
  && ln -s /usr/local/openjdk-21/bin/java /usr/bin/java

# Verify Java installation
RUN java -version && echo "Java installed successfully"

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Copy fly.toml for deployment configuration
COPY fly.toml ./

# Copy Angular configuration files
COPY angular.json ./
COPY ts*.json ./
COPY tools /usr/src/app/tools

# Copy the Angular application code to the working directory
COPY projects/ngx-ramblers /usr/src/app/projects/ngx-ramblers

# Install the dependencies (respect legacy peer deps)
RUN npm ci

# Build the Angular application using the locally installed Angular CLI
RUN npx ng build --project ngx-ramblers --progress --configuration production

# Copy the server application code to the working directory
WORKDIR /usr/src/app/server

COPY server/package*.json ./
COPY server/ts*.json ./
COPY server/lib* ./
COPY server/.mocharc.json ./
COPY server/wdio.conf.ts ./
COPY server /usr/src/app/server

# Install server dependencies with explicit sharp installation
RUN npm install --include=optional sharp
RUN npm ci

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
