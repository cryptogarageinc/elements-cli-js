# elements-cli-js
elements client for javascript

## tools

- debug_tx (debug-console.js)
  - debug tool with cfd-js.
- send-split-tx.js
  - This is a tool for splitting and sending UTXO.


### debug_tx (debug-console.js)

help: `debug_tx.sh` or `debug_tx.sh -h`

Described at a later date.

### send-split-tx.js

usage: node send-split-tx.js [subcommand] [options]

subcommand:

- help
  - usage: `node send-split-tx.js` or `node send-split-tx.js -h`
- getnewaddress
  - usage: `node send-split-tx.js getaddr [-n <network>] [-o <label name>]`
  - options
    - `-n`: network option. set to `liquidv1` or `liquidregtest`.
    - `-o`: output option. output file name is `addr-(label name or unblind address)`.
- getrawtransaction
  - usage: `node send-split-tx.js gettx [-r <rpcConfigFile>] [-n <network>] -t <txid> [-b <unblind key>] [-i <unblind index>] [-o]`
  - options
    - `-r`: rpc config file option. base file is rpc.conf.org.
      - If you do not set this field, connect to the block explorer.
    - `-n`: network option. set to `liquidv1` or `liquidregtest`.
    - `-b`: blinding key for unblind.
    - `-i`: unblind target txout index. (0 - 4294967295)
    - `-o`: output option. file name of transaction hex output is `tx-(txid)`.
- createtransaction
  - usage: `node send-split-tx.js createtx [-r <rpcConfigFile>] [-n <network>] -t <utxo txid> -v <utxo vout> -p <privkey> -b <unblind key> -f <addr file> [-a <split amount>] [-o]`
  - options
    - `-r`: rpc config file option. base file is rpc.conf.org.
      - If you do not set this field, connect to the block explorer.
    - `-n`: network option. set to `liquidv1` or `liquidregtest`.
    - `-b`: blinding key for unblind.
    - `-f`: output address list. Separate them with line breaks.
    - `-a`: Amount to split.
    - `-o`: output option. file name of transaction hex output is `tx-(txid)`.
- sendrawtransaction
  - usage: `node send-split-tx.js sendtx [-r <rpcConfigFile>] [-h <tx hex>] [-f <tx file>]`
  - options
    - `-r`: rpc config file option. base file is rpc.conf.org.
      - If you do not set this field, connect to the block explorer.
    - `-h`: transaction hex.
    - `-f`: transaction hex file name. (ex. createtx's output file)

#### sequence

1. (This tool) Call getnewaddress.
2. (Wallet) Send money to the address obtained in no.1.
3. (This tool) Use getrawtransaction to check the transaction sent in no.2.
4. (This tool) Use createtransaction to create a transaction that splits the UTXO.
5. (This tool) Just in case, check if the fee is correct.
6. (This tool) Use sendrawtransaction to broadcast the transaction.
