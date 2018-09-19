FROM node:8

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install
# If you are building your code for production
# RUN npm install --only=production

# Bundle app source
COPY . .

RUN apt-get update && apt-get install -y software-properties-common

# Install "ffmpeg"
RUN add-apt-repository ppa:mc3man/trusty-media
RUN apt-get update && apt-get install -y ffmpeg

# If you want to add some content to this image because the above takes a LONGGG time to build
ARG CACHEBREAK=1

EXPOSE 3000
CMD [ "npm", "start" ]
