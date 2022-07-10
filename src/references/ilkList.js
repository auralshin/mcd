import {
  ETH,
  BAT,
  USDC,
  WBTC,
  TUSD,
  ZRX,
  KNC,
  MANA,
  USDT,
  PAXUSD,
  COMP,
  LRC,
  LINK,
  YFI,
  BAL,
  GUSD,
  UNI,
  RENBTC,
  AAVE
} from '@makerdao/dai-plugin-mcd';

export default [
  {
    slug: 'eth-a', // URL param
    symbol: 'ETH-A', // how it's displayed in the UI
    key: 'ETH-A', // the actual ilk name used in the vat
    gem: 'ETH', // the actual asset that's being locked
    currency: ETH, // the associated dai.js currency type
    networks: ['kovan', 'mainnet', 'testnet', 'rinkeby', 'ropsten', 'goerli']
  },
  {
    slug: 'eth-b',
    symbol: 'ETH-B',
    key: 'ETH-B',
    gem: 'ETH',
    currency: ETH,
    networks: ['kovan', 'mainnet']
  },
  {
    slug: 'eth-c',
    symbol: 'ETH-C',
    key: 'ETH-C',
    gem: 'ETH',
    currency: ETH,
    networks: ['kovan', 'mainnet']
  },
  {
    slug: 'bat-a',
    symbol: 'BAT-A',
    key: 'BAT-A',
    gem: 'BAT',
    currency: BAT,
    networks: ['kovan', 'mainnet', 'testnet', 'rinkeby', 'ropsten', 'goerli']
  },
  {
    slug: 'usdc-a',
    symbol: 'USDC-A',
    key: 'USDC-A',
    gem: 'USDC',
    currency: USDC,
    networks: ['kovan', 'mainnet', 'testnet', 'rinkeby', 'ropsten', 'goerli'],
    decimals: 6
  },
  {
    slug: 'usdc-b',
    symbol: 'USDC-B',
    key: 'USDC-B',
    gem: 'USDC',
    currency: USDC,
    networks: ['kovan', 'mainnet'],
    decimals: 6
  },
  {
    slug: 'usdt-a',
    symbol: 'USDT-A',
    key: 'USDT-A',
    gem: 'USDT',
    currency: USDT,
    networks: ['mainnet', 'kovan'],
    decimals: 6
  }
 ];
