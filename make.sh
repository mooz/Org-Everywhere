#!/bin/sh

appname=org-everywhere

cp buildscript/makexpi.sh ./
./makexpi.sh $appname version=0
rm ./makexpi.sh

