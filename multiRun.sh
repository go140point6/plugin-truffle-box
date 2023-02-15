#!/bin/bash

while getopts n:x:f: flag
do
    case "${flag}" in
        n) network=${OPTARG};;
        x) number=${OPTARG};;
        f) force=${OPTARG};;
    esac
done

re='^[0-9]+$'
if ! [[ $number =~ $re ]] || [[ $number == 0 ]]; then
    echo "The flag value for -x should be present and a whole number greater than 0."
    exit 1
elif ! [[ $network == apothem || $network == mainnet ]]; then
    echo "The flag vale for -n MUST be either apothem or mainnet, no other value allowed."
    exit 1
elif [[ $number -gt 10 ]] && ! [[ $force == true ]]; then
    echo "It is recommended to create smaller runs so they can be easily monitored. If you are sure you want to do $number consecutive runs, re-run the command and include '-f true'."
    exit 1
else
    for (( i=1; i<=$number; i++ )); do
        ./node_modules/.bin/truffle migrate --clean -f 1 --to 1 --network $network && \
        node scripts/1_df_fulfillment.js && \
        ./node_modules/.bin/truffle migrate --clean -f 2 --to 2 --network $network --compile-none && \
        node scripts/2_df_approvePLI.js && \
        node scripts/3_df_transferPLI.js && \
        node scripts/4_df_requestData.js && \
        rm -rf ./build
    done
    exit 0
fi

