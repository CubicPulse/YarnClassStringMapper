#!/bin/bash

MC_VERSION=$1

cd yarn || exit 1
git checkout $MC_VERSION || exit 1

./gradlew mapNamedJar

cd .. || exit 1

bun run index.ts $MC_VERSION
mv YarnStringMapper.java YarnStringMapper_${MC_VERSION//./_}.java

echo "Generated YarnStringMapper_${MC_VERSION//./_}.java"
