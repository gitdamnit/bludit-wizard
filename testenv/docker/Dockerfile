# Isolated Bludit 3.22.0 test image for the Bludit Wizard plugin.
#
# The CORE build arg selects which upstream tree is copied to the document root:
#   testenv/upstream/bludit-community   (Bludit Community 3.22.0)
#   testenv/upstream/bludit-pro         (Bludit Pro 3.22.0, build 20260510)
#
# NOTE: line below raises error_reporting to E_ALL in the *test* copy of the
# Bludit core so that PHP notices/warnings emitted by the plugin are written to
# the error log and can be scanned by the test suite. display_errors stays off,
# so API responses remain clean JSON. This is test instrumentation only and is
# never applied to the plugin source or to any production installation.
FROM php:8.2-apache

ARG CORE=testenv/upstream/bludit-community

RUN apt-get update && apt-get install -y --no-install-recommends \
        libpng-dev libjpeg62-turbo-dev libfreetype6-dev libzip-dev libonig-dev \
        unzip curl ca-certificates \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" gd mbstring zip exif \
    && a2enmod rewrite headers proxy proxy_http \
    && rm -rf /var/lib/apt/lists/*

COPY testenv/docker/php.ini /usr/local/etc/php/conf.d/zz-bw-test.ini
COPY testenv/docker/mockai-proxy.conf /etc/apache2/conf-enabled/zz-bw-mockai-proxy.conf

COPY ${CORE}/ /var/www/html/
COPY wizard/ /var/www/html/bl-plugins/wizard/

# Test-only: surface every PHP diagnostic in the error log.
RUN sed -i 's/error_reporting(E_ERROR);/error_reporting(E_ALL);/' /var/www/html/bl-kernel/boot/init.php \
    && chown -R www-data:www-data /var/www/html

EXPOSE 80
