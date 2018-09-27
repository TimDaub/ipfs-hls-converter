FROM ubuntu:16.04
RUN apt-get update -y && apt-get install -y ffmpeg git
RUN apt-get update -yq \
        && apt-get install curl gnupg -yq \
        && curl -sL https://deb.nodesource.com/setup_8.x | bash \
        && apt-get install nodejs -yq
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD [ "npm", "start" ]
