FROM node:slim

WORKDIR /app

COPY package*.json ./
RUN npm install
RUN apt update && apt install tree
COPY . .

ENTRYPOINT [ "npx", "ts-node", "src/server.ts" ]