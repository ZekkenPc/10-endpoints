# Imagen ligera de Node.js (la 18 ya no tiene soporte)
FROM node:20-alpine

# Directorio de trabajo dentro del contenedor
WORKDIR /usr/src/app

# Copia los archivos de paquetes
COPY package*.json ./

# Instala solo dependencias de producción (sin jest ni supertest)
RUN npm ci --omit=dev

# Copia el código fuente
COPY . .

# Puerto que usa Express
EXPOSE 80

# Inicia la aplicación
CMD ["node", "index.js"]