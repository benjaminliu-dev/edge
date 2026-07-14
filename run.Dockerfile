FROM node:slim

WORKDIR /app

COPY . /app/

RUN npm i

ENTRYPOINT [ "npx", "tsx", "src/index.ts" ]