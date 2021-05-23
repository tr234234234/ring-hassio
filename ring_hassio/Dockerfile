ARG BUILD_FROM
FROM $BUILD_FROM

# Add env
ENV LANG C.UTF-8

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
EXPOSE 3000/tcp

RUN apk add --no-cache \
    nodejs \
    fonts-ubuntu \
    npm \
    ffmpeg \
    git && \
    cd / && \
    git clone https://github.com/tr234234234/ring-hassio && \
    cd ring-hassio/ring_hassio && \
    npm install --unsafe-perm && \
    chmod a+x run.sh && \
    cp ffmpeg node_modules/ffmpeg-for-homebridge/

CMD [ "/ring-hassio/ring_hassio/run.sh" ]
