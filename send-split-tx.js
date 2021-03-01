/* eslint-disable require-jsdoc */
// UTF-8
'use strict';
const fs = require('fs');
// const ini = require('ini')
const readline = require('readline-sync');
const zlib = require('zlib');
const needle = require('needle');
const cfdjs = require('cfd-js');
const RpcClient = require('node-json-rpc2').Client;

// -----------------------------------------------------------------------------

const checkString = function(arg, matchText, alias = undefined){
  if (arg == matchText) {
    return true
  } else if ((alias) && (arg == alias)) {
    return true
  }
  return false
}

const executeRpc = async function (client, method, params) {
  const promise = client.callPromise(method, params, 1.0);
  const res = await promise;
  if (res && ('error' in res) && (res['error'])) {
    throw Error('method: ' + res.error);
  } else return res.result;
};

/*
const createConnection = function(host, port, id, password) {
const config = {
host: host,
user: id,
password: password,
port: port,
id: 'elements-rpc',
};
return config;
};
*/

function doRequest(options, postData = undefined) {
  return new Promise(function (resolve, reject) {
    try {
      const func = function (error, res, body) {
        if (!error && res && res['statusCode'] && (res.statusCode === 200)) {
          const statusCode = res.statusCode;
          resolve({ statusCode: statusCode, data: body, headers: res });
        } else if (!error && res && body) {
          resolve({ statusCode: 299, data: body, headers: res });
        } else {
          reject(error);
        }
      };
      if (!postData) {
        needle.get(options.url, options, func);
      } else {
        needle.post(options.url, postData, options, func);
      }
    } catch (e) {
      throw e;
    }
  });
}

const callGet = async function (url, dumpName = '') {
  console.log(`url = ${ url }`);
  const reqHeaders = {
  };
  const requestOptions = {
    url: url,
    method: 'GET',
    headers: reqHeaders,
    gzip: true,
  };
  // const {statusCode, data, headers}
  const { statusCode, data } = await doRequest(requestOptions);
  console.log(`status = ${ statusCode }`);
  if ((statusCode >= 200) && (statusCode < 300)) {
    // console.log(headers = ${headers})
    let result = data;
    try {
      result = zlib.gunzipSync(data);
      if (dumpName) {
        console.log(`${ dumpName }(unzip): ${ result }`);
      }
      return result;
    } catch (error) {
      // do nothing
    }
    try {
      const jsonData = JSON.parse(data);
      if (dumpName) {
        console.log(`${ dumpName }:`, JSON.stringify(jsonData, null, 2));
      }
      return jsonData;
    } catch (error) {
      if (dumpName) {
        console.log(`${ dumpName }:`, data);
      }
      return data;
    }
  } else {
    throw new Error(`statusCode: ${ statusCode }`);
  }
};

const callPost = async function (url, formData) {
  console.log(`url = ${ url }`);
  /*
  const reqHeaders = {
  'content-type': contextType,
  };
  */
  const requestOptions = {
    url: url,
    method: 'POST',
    form: formData,
  };

  const resp = await doRequest(requestOptions, formData.tx);
  try {
    // console.log(response:, resp)
    // const {statusCode, data, headers}
    const { statusCode, data } = resp;
    console.log(`status = ${ statusCode }`);
    if ((statusCode >= 200) && (statusCode < 300)) {
      // console.log(headers = ${headers})
      const result = data;
      console.log('data =', result);
      return result;
    } else {
      throw new Error(`statusCode: ${ statusCode }`);
    }
  } catch (e) {
    console.log('post fail: ', e);
    throw e;
  }
};

const ElementsCli = function(rpcConfig) {
  const config = {
    protocol: 'http',
    method: 'POST',
    host: rpcConfig.host || rpcConfig.rpcbind,
    port: rpcConfig.port || rpcConfig.rpcport,
    user: rpcConfig.user || rpcConfig.rpcuser,
    password: rpcConfig.password || rpcConfig.rpcpassword,
  };
  const client = new RpcClient(config);

  // Blockchain
  this.getrawtransaction = async function (
    txid, verbose = false, blockHash = null) {
    return await executeRpc(client, 'getrawtransaction', [txid, verbose, blockHash]);
  };
  // Rawtransactions
  this.sendrawtransaction = async function (hexstring, allowhighfees = false) {
    return await executeRpc(client, 'sendrawtransaction', [hexstring, allowhighfees]);
  };
};

const BlockExplorerCli = function (connection) {
  this.prefix = 'liquid/api';
  this.url = 'https://blockstream.info';

  // Blockchain
  this.getrawtransaction = async function (
      txid, verbose = false, blockHash = null) {
    const url = `${this.url}/${this.prefix}/tx/${txid}/hex`;
    return await callGet(url);
  };
  // Rawtransactions
  this.sendrawtransaction = async function (hexstring, allowhighfees = false) {
    const postFormData = { tx: hexstring };
    const postUrl = `${this.url}/${this.prefix}/tx`;
    return await callPost(postUrl, postFormData);
  };
};


const getUtxoTxHex = async function (rpcInfo, utxoTxid) {
  let cli;
  if (rpcInfo) {
    cli = new ElementsCli(rpcInfo);
  } else {
    cli = new BlockExplorerCli();
  }
  return await cli.getrawtransaction(utxoTxid, false);
};

const sendTransaction = async function (rpcInfo, txHex) {
  let cli;
  if (rpcInfo) {
    cli = new ElementsCli(rpcInfo);
  } else {
    cli = new BlockExplorerCli();
  }
  return await cli.sendrawtransaction(txHex);
};

/**
 * 

- 送金ツールでやりたいこと
  - Pubkey（アドレス）/Privkey生成コマンド
    - 同時にBlindingKey情報も。
  - (block explorer or elements-cli) tx情報Get
    - 指定したTXIDのTXをファイルダンプ
  - (block explorer or elements-cli) Send Tx
    - ファイル指定で送信（broadcast）
  - Create Tx
    - 設定内容
      - UTXOを指定
      - 送金先アドレスを複数指定
      - 1つあたりの金額を指定
    - 処理内容
      - UTXOの金額から1つあたりの金額を割って、予めTxOutに設定する数を確認
      - TXを作成し、上記の数だけTxOutに設定
      - もしアドレスが足りないようなら、末尾の分を削除
      - fundrawtransactionでfeeごと一括設定
      - ファイル出力(blind/unblindそれぞれ。ファイル名は"gen_(txid)" or "gen_(txid)_unblind")
 * 
 */

const convertAddressList = function(addressFile, network) {
  const addrs = fs.readFileSync(addressFile, 'utf-8').toString().split('\n');
  const addrList = [];
  for (const addr of addrs) {
    let addrData = addr.trim();
    if (addrData) {
      let addrStr = addrData;
      try {
        const ctInfo = cfdjs.GetUnblindedAddress({confidentialAddress:addrData});
        addrStr = ctInfo.unblindedAddress;
      } catch (e) {
        // do nothing
      }
      try {
        const info = cfdjs.GetAddressInfo({address: addrStr, isElements: true});
        if (info.network == network) {
          addrList.push(addrData);
        } else if ((info.network == 'regtest') && (network.indexOf('regtest') >= 0)) {
          addrList.push(addrData);
        }
      } catch (e) {
        // do nothing
      }
    }
  }
  return addrList;
}

// -----------------------------------------------------

const getnewaddress = async function(argMap) {
  // [-n <network>][-o <label name>]
  const output = argMap['o'];
  const network = argMap['n'] || 'liquidv1';
  const mainchainNetwork = (network != 'liquidv1') ? 'regtest' : 'mainnet';
  const key = cfdjs.CreateKeyPair({network: mainchainNetwork});
  const blindKey = cfdjs.CreateKeyPair({wif: false});
  const addr = cfdjs.CreateAddress({
    network,
    isElements: true,
    hashType: 'p2wpkh',
    keyData: {
      hex: key.pubkey,
      type: 'pubkey',
    },
  });
  const ctAddr = cfdjs.GetConfidentialAddress({
    key: blindKey.pubkey,
    unblindedAddress: addr.address,
  });
  const dumpData = {
    key,
    blindKey,
    address: addr,
    confidentialAddress: ctAddr,
  };
  console.log(dumpData);
  
  if (output) {
    const outName = (typeof output == 'string') ? output : addr.address;
    const outputFile = `addr-${outName}.json`;
    console.log('File Output:', outputFile);
    if (fs.existsSync(outputFile)) throw Error('File already exists.');

    fs.writeFileSync(outputFile, JSON.stringify(dumpData, null, ' '));
  }
};

const getrawtransaction = async function(argMap) {
  // [-r <rpcConfigFile>] -t <txid> [-b <unblind key>] [-i <unblind index>] [-o]
  const rpcConf = argMap['r'];
  const network = argMap['n'] || 'liquidv1';
  const output = argMap['o'];
  const blindingKey = argMap['b'];
  const unblindIndex = argMap['i'] || '0';
  const txHex = await getUtxoTxHex(rpcConf, argMap['t']);
  const decodeTx = cfdjs.ElementsDecodeRawTransaction({hex: txHex, network});
  console.log('Tx:', JSON.stringify(decodeTx, null, ' '));

  if (blindingKey) {
    const unblindTx = cfdjs.UnblindRawTransaction({
      tx: txHex,
      txouts: [{
        blindingKey,
        index: parseInt(unblindIndex, 10),
      }],
    });
    console.log('UnblindData:', unblindTx.outputs[0]);
  }
  if (output) {
    const outputFile = `tx-${decodeTx.txid}.json`;
    console.log('File Output:', outputFile);
    if (fs.existsSync(outputFile)) throw Error('File already exists.');
    fs.writeFileSync(outputFile, txHex);
  }
};

const sendrawtransaction = async function(argMap) {
  // [-r <rpcConfigFile>] [-h <tx hex>] [-f <tx file>]
  const rpcConf = argMap['r'];
  let txHex = argMap['h'];
  const txFile = argMap['f'];
  if (txFile) txHex = fs.readFileSync(txFile, 'utf-8').toString().trim();
  const txid = await sendTransaction(rpcConf, txHex);
  console.log(`Send TXID: ${txid}`);
};

const createtransaction = async function(argMap) {
  // [-r <rpcConfigFile>] [-n <network>] -t <utxo txid> -v <utxo vout>
  // -p <privkey> -b <unblind key> -f <addr file> [-a <split amount>] [-o]
  const rpcConf = argMap['r'];
  const network = argMap['n'] || 'liquidv1';
  const output = argMap['o'];
  const utxoTxid = argMap['t'];
  const utxoVoutStr = argMap['v'] || '0';
  const privkey = argMap['p'];
  const blindingKey = argMap['b'];
  const addrListFile = argMap['f'];
  const splitAmountStr = argMap['a'] || '1000';
  const utxoVout = parseInt(utxoVoutStr, 10);
  const splitAmount = parseInt(splitAmountStr, 10);
  
  const feeRate = 0.1;  // sat/vb
  const minimumBits = 36;

  const addrList = convertAddressList(addrListFile, network);
  const utxoHex = await getUtxoTxHex(rpcConf, utxoTxid);
  const decodeUtxo = cfdjs.ElementsDecodeRawTransaction({hex: utxoHex, network});
  const unblindUtxoData = cfdjs.UnblindRawTransaction({
    tx: utxoHex,
    txouts: [{
      blindingKey,
      index: utxoVout,
    }],
  }).outputs[0];
  const pubkey = cfdjs.GetPubkeyFromPrivkey({privkey}).pubkey;

  const valuecommitment = decodeUtxo.vout[utxoVout].valuecommitment;
  const inputAmount = unblindUtxoData.amount;
  const asset = unblindUtxoData.asset;
  let calcAmount = inputAmount;
  let splitNum = 1;
  if (inputAmount < (splitAmount * 2)) {
    splitNum = 0;
  } else {
    const tempSplitNum = parseInt(inputAmount / splitAmount);
    // txout fee
    calcAmount = inputAmount - (200 * tempSplitNum);
    splitNum = parseInt(calcAmount / splitAmount);
  }
  if (addrList.length < splitNum) {
    throw Error(`address list count is low. ${addrList.length} < ${splitNum}`);
  }

  const txouts = [];
  let index = 0;
  let lastIndex = 0;
  if (splitNum > 0) {
    lastIndex = splitNum - 1;
    while (index < (splitNum - 1)) {
      txouts.push({
        address: addrList[index],
        amount: splitAmount,
        asset: asset,
      });
      index += 1;
    }
  }
  const baseTx = cfdjs.ElementsCreateRawTransaction({txouts});
  let fundTx;
  try {
    fundTx = cfdjs.FundRawTransaction({
      tx: baseTx.hex,
      isElements: true,
      utxos: [{
        txid: utxoTxid,
        vout: utxoVout,
        asset,
        amount: inputAmount,
        descriptor: `wpkh(${pubkey})`,
      }],
      network,
      targets: [{
        amount: 1,
        asset,
        reserveAddress: addrList[lastIndex],
      }],
      feeInfo: {
        feeRate,
        feeAsset: asset,
        knapsackMinChange: 0,
        minimumBits,
      }
    });
  } catch (e) {
    console.log('baseTx:', baseTx.hex);
    console.log(`splitNum: ${splitNum}`);
    throw e;
  }
  const blindTx = cfdjs.BlindRawTransaction({
    tx: fundTx.hex,
    txins: [{
      txid: utxoTxid,
      vout: utxoVout,
      asset,
      amount: inputAmount,
      assetBlindFactor: unblindUtxoData.assetBlindFactor,
      blindFactor: unblindUtxoData.blindFactor,
    }],
    minimumBits,
  });

  // privkey sign
  const signTx = cfdjs.SignWithPrivkey({
    tx: blindTx.hex,
    isElements: true,
    txin: {
      privkey,
      txid: utxoTxid,
      vout: utxoVout,
      hashType: 'p2wpkh',
      sighashType: 'all',
      confidentialValueCommitment: valuecommitment,
    }
  });

  // check fee
  const decodeTx = cfdjs.ElementsDecodeRawTransaction({hex: signTx.hex, network});
  const vsize = decodeTx.vsize;
  const feeAmount = fundTx.feeAmount;
  if ((vsize / 10) > feeAmount) {
    throw Error(`low fee. fee:${feeAmount}, vsize:${vsize}`);
  }
  const unblindDecodeTx = cfdjs.ElementsDecodeRawTransaction({hex: fundTx.hex, network});
  console.log('UnblindTx:', JSON.stringify(unblindDecodeTx, null, ' '));
  const changeTxOutAmount = unblindDecodeTx.vout[unblindDecodeTx.vout.length - 1].value;

  if (output) {
    // console.log('Tx:', JSON.stringify(decodeTx, null, ' '));
    console.log(`Fee: ${feeAmount}`);
    console.log(`Vsize: ${vsize}`);
    console.log(`Change Amount: ${changeTxOutAmount}`);

    const outputFile = `tx-${decodeTx.txid}.json`;
    console.log('File Output:', outputFile);
    if (fs.existsSync(outputFile)) throw Error('File already exists.');
    fs.writeFileSync(outputFile, signTx.hex);
  } else {
    console.log('Tx:', signTx.hex);
    console.log(`Fee: ${feeAmount}`);
    console.log(`Vsize: ${vsize}`);
    console.log(`Change Amount: ${changeTxOutAmount}`);
  }
};

const commandData = {
  getaddr: {
    name: 'getnewaddress',
    alias: 'getaddr',
    parameter: '[-n <network>] [-o <label name>]',
    function: getnewaddress,
  },
  gettx: {
    name: 'getrawtransaction',
    alias: 'gettx',
    parameter: '[-r <rpcConfigFile>] [-n <network>] -t <txid> [-b <unblind key>] [-i <unblind index>] [-o]',
    function: getrawtransaction,
  },
  sendtx: {
    name: 'sendrawtransaction',
    alias: 'sendtx',
    parameter: '[-r <rpcConfigFile>] [-h <tx hex>] [-f <tx file>]',
    function: sendrawtransaction,
  },
  createtx: {
    name: 'createtransaction',
    alias: 'createtx',
    parameter: '[-r <rpcConfigFile>] [-n <network>] -t <utxo txid> -v <utxo vout> -p <privkey> -b <unblind key> -f <addr file> [-a <split amount>] [-o]',
    function: createtransaction,
  },
};

const helpDump = function (nameObj) {
  if (!nameObj.parameter) {
    console.log(' ' + nameObj.name);
  } else {
    console.log(' ' + nameObj.name + ' ' + nameObj.parameter);
  }
  if (nameObj.alias) {
    console.log(' - alias: ' + nameObj.alias);
  }
};

const help = function () {
  console.log('usage:');
  for (const key in commandData) {
    if (commandData[key]) {
      helpDump(commandData[key]);
    }
  }
};

const readLineData = function (index, message, ignoreInput = false) {
  let value;
  if (process.argv.length <= index) {
    if (!ignoreInput) {
      value = readline.question(`${ message } > `);
    }
  } else {
    value = process.argv[index];
  }
  return value;
};

const analyzeArgs = function() {
  let result = {};
  let index = 2;
  while (index < process.argv.length) {
    if (process.argv[index].charAt(0) == '-') {
      const key = process.argv[index].substring(1);

      let value = true;
      if ((index + 1) < process.argv.length) {
        if (process.argv[index + 1].charAt(0) != '-') {
          value = process.argv[index + 1];
          index += 1;
        }
      }
      if (typeof value == 'string') {
        result[`${key}`] = value;
        if (key == 'r') {
          // read file & conv json
          const jsonData = fs.readFileSync(value, 'utf8');
          result[`${key}`] = JSON.parse(jsonData);
        }
      } else {
        result[`${key}`] = true;  // option only
      }
    } else {
      // invalid arg
    }
    index += 1;
  }
  return result;
};

// -----------------------------------------------------------------------------
const main = async () =>{
  try {
    if (process.argv.length > 2) {
      const argMap = analyzeArgs();
      const cmd = process.argv[2].trim();
      for (const key in commandData) {
        if (commandData[key]) {
          const cmdData = commandData[key];
          if (checkString(cmd, cmdData.name, cmdData.alias)) {
            await cmdData.function(argMap);
            return 0;
          }
        }
      }
    }

    for (let i = 0; i < process.argv.length; i++) {
      console.log('argv[' + i + '] = ' + process.argv[i]);
    }
    help();
  } catch (error) {
    console.log(error);
  }
  return 1;
};

main();
