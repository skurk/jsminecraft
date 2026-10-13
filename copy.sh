#!/bin/sh

SRC=/var/www/html/jsminecraft

cd src
cp -va $SRC/src/* .
cd ..
cp -v $SRC/jsminecraft-standalone.html .
