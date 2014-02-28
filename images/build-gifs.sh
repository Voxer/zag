#!/usr/bin/env bash

for gif in ./gifs/*.gif
do
  convert "$gif[0]" "${gif%.*}.png"
done
