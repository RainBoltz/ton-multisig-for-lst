export const IS_MAINNET = () => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("testnet") === null;
};

export const TONAPI_BASE_URL = () => {
  return IS_MAINNET() ? "https://tonapi.io/v2" : "https://testnet.tonapi.io/v2";
};
