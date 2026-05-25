FROM nginx:stable-alpine

ENV NGINX_ENVSUBST_OUTPUT_DIR=/etc/nginx

COPY docker-entrypoint.d/05-nginx-env.envsh /docker-entrypoint.d/05-nginx-env.envsh
COPY nginx.conf.template /etc/nginx/templates/nginx.conf.template

RUN chmod +x /docker-entrypoint.d/05-nginx-env.envsh

EXPOSE 80 443
