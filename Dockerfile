# Usa una imagen ligera de Node.js
FROM node:18-alpine

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /usr/src/app

# Copia los archivos de configuración de paquetes
COPY package*.json ./

# Instala las dependencias
RUN npm install

# Copia todo el código fuente de la aplicación
COPY . .

# Expone el puerto 80 (El que indicamos en Express)
EXPOSE 80

# Comando para iniciar la aplicación
CMD ["node", "index.js"]