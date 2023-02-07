#!/bin/bash

while getopts n: flag
do
    case "${flag}" in
        n) network=${OPTARG};;
    esac
done

if [[ $network == apothem ]] || [[ $network == mainnet ]]; then
    ./node_modules/.bin/truffle migrate --clean -f 1 --to 1 --network $network && \
    node scripts/1_fulfillment.js && \
    ./node_modules/.bin/truffle migrate --clean -f 2 --to 2 --network $network --compile-none && \
    node scripts/2_approvePLI.js && \
    node scripts/3_transferPLI.js && \
    node scripts/4_requestData.js && \
    rm -rf ./build
    exit 0
else
    echo "missing correct flag, either '-n apothem' or '-n mainnet' is accepted, one only."
    exit 1
fi