FROM node:20-alpine

# Ferramentas de rede necessárias para diagnósticos
RUN apk add --no-cache \
    iputils \
    traceroute \
    bind-tools \
    curl

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]
