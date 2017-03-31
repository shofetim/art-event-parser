FROM mhart/alpine-node

MAINTAINER Jordan Schatz jordan@noionlabs.com

WORKDIR /app
ADD . .
RUN npm install -g nodemon
RUN npm install

EXPOSE 8080
CMD [ "npm", "start" ]