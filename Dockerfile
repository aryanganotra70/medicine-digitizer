FROM node:20-alpine

# Install OpenSSL, Python, and Pillow dependencies
RUN apk add --no-cache \
    openssl \
    libc6-compat \
    python3 \
    py3-pip \
    py3-pillow \
    jpeg-dev \
    zlib-dev

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

RUN npx prisma generate

# Set dummy DATABASE_URL for build (not used, just to satisfy Prisma)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
