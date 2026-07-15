FROM node:slim

WORKDIR /app

COPY package*.json ./
RUN npm install --production
RUN apt update && apt install tree
COPY . .

ENTRYPOINT [ "npx", "tsx", "src/server.ts" ]