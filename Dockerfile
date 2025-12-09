FROM nginx:1.27-alpine

# Set working directory
WORKDIR /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static assets
COPY index.html ./ 
COPY css ./css
COPY src ./src
COPY examples ./examples

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
