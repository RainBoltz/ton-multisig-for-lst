/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { TONAPI_BASE_URL, IS_MAINNET } from "./constants";
import {
  SendMode,
  Address,
  Cell,
  internal,
  beginCell,
  Dictionary,
  storeMessageRelaxed,
  loadMessageRelaxed,
  TupleReader,
  TupleItem,
  toNano,
} from "@ton/core";
import { IPrepare } from "./components/types";
import { Op } from "./sdk/lst-v2/PoolConstants";
import {loadJettonMintMessage} from "./sdk/jetton/JettonMintMessage";

export async function retryLoop(func: any, ...args: any[]) {
  while (true) {
    try {
      return await func(...args);
    } catch (error) {
      console.log(error);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

// Transaction type definitions
export type TransactionType =
  /* jetton */
  | "jetton-master-change-owner"
  | "burn-jetton"
  | "mint-jetton"
  | "jetton-transfer"

  /* multisig */
  | "send-approve"

  /* lst v2 */
  | "lstv2-send-approve" // approver -> controller
  | "lstv2-update-interest-rate" // interest manager -> pool
  | "lstv2-send-donate" // anyone -> pool
  | "lstv2-update-governance-fee" // governor -> pool
  | "lstv2-update-pool-params" // interest manager -> pool
  // TODO
  | "lstv2-send-deposit" // anyone -> pool
  | "lstv2-send-withdraw" // anyone -> jetton wallet
  | "lstv2-update-deposit-settings" // governor -> pool
  | "lstv2-send-unhalt" // governor -> pool / controller
  | "lstv2-send-halt"; // halter -> pool / controller

// Types for multisig wallet and orders
export interface MultisigWallet {
  address: string;
  orders: Order[];
}
export interface Order {
  id: string;
  address: string;
  type: string;
  status: "pending" | "executed" | "expired";
  createdAt: string;
  details: {
    [key: string]: any;
  };
  approvals: {
    current: number;
    required: number;
    hasUserApproved: boolean;
  };
}

// any address format to readable
export function readableAddress(
  address: string,
  bounceable: boolean = false,
  shorten: boolean = true
): string {
  const addressInstance = Address.parse(address);
  const addressFriendly = addressInstance.toString({
    bounceable,
    testOnly: !IS_MAINNET(),
    urlSafe: true,
  });
  if (shorten) {
    return addressFriendly.slice(0, 6) + "..." + addressFriendly.slice(-4);
  } else {
    return addressFriendly;
  }
}

export function parseStackItem(item: any): TupleItem {
  if (item.type === "num") {
    const val = item.num as string;
    if (val.startsWith("-")) {
      return { type: "int", value: -BigInt(val.slice(1)) };
    } else {
      return { type: "int", value: BigInt(val) };
    }
  } else if (item.type === "null" || item.type === "nan") {
    return { type: "null" };
  } else if (item.type === "cell" && item.cell) {
    return {
      type: "cell",
      cell: Cell.fromHex(item.cell),
    };
  } else if (item.type === "tuple" && item.tuple) {
    const tupleItems = item.tuple.map((tuple: any) => parseStackItem(tuple));
    return { type: "tuple", items: tupleItems };
  } else {
    throw Error("Unsupported stack item type: " + item.type);
  }
}
export function parseStack(src: any[]): TupleReader {
  const stack: TupleItem[] = [];

  for (const item of src) {
    stack.push(parseStackItem(item));
  }

  return new TupleReader(stack);
}

export async function getMultisigsByAccount(address: string) {
  const url = `${TONAPI_BASE_URL()}/accounts/${address}/multisigs`;

  const result = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  return (await result.json()).multisigs;
}

export async function getTransactionByMultisig(
  address: string,
  limit: number = 10
) {
  const url = `${TONAPI_BASE_URL()}/blockchain/accounts/${address}/transactions?limit=${limit}&sort_order=desc`;

  const result = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  return (await result.json()).transactions;
}

export async function getMultisigData(address: string) {
  const url = `${TONAPI_BASE_URL()}/multisig/${address}`;

  const result = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  return await result.json();
}

export async function getOrderDataByOrder(address: string) {
  const url = `${TONAPI_BASE_URL()}/blockchain/accounts/${address}/methods/get_order_data?fix_order=true`;

  const responseRaw = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const response = await responseRaw.json();

  const { stack: stackRaw } = response;
  const stack = parseStack(stackRaw);
  const multisig = stack.readAddress();
  const orderSeqno = stack.readBigNumber();
  const threshold = stack.readNumberOpt();
  const executed = stack.readBooleanOpt();
  const signers = cellToArray(stack.readCellOpt());
  const approvals = stack.readBigNumberOpt();
  const approvalsNum = stack.readNumberOpt();
  const expirationDate = stack.readBigNumberOpt();
  const order = stack.readCellOpt();
  let approvalsArray: Array<boolean>;
  if (approvals !== null) {
    approvalsArray = Array(signers.length);
    for (let i = 0; i < signers.length; i++) {
      approvalsArray[i] = Boolean((1n << BigInt(i)) & approvals);
    }
  } else {
    approvalsArray = [];
  }
  return {
    multisigAddress: multisig,
    orderSeqno,
    threshold,
    executed,
    signers,
    approvals: approvalsArray,
    approvalsNum,
    expirationDate,
    order,
  };
}

export function isSignerApproved(
  signer: Address,
  signers: Address[],
  approvals: boolean[]
): boolean {
  let idx = -1;
  for (let i = 0; i < signers.length; i++) {
    if (signer.equals(signers[i])) {
      idx = i;
      break;
    }
  }
  return idx >= 0 && approvals[idx];
}

export async function e2eGetMultisigsAndOrdersByAccount(account: string) {
  const userAddress = Address.parse(account);

  const multisigs = await retryLoop(
    getMultisigsByAccount,
    userAddress.toString()
  );
  const sortedMultisigs = multisigs.sort(
    (a: any, b: any) => a.address < b.address
  );

  const multisigWallets: MultisigWallet[] = [];
  for (const multisig of sortedMultisigs) {
    const ordersParsed: Order[] = [];
    const orderSorted: any[] = multisig.orders.sort(
      (a: any, b: any) => Number(a.order_seqno) > Number(b.order_seqno)
    );
    const orderTruncated = orderSorted.slice(0, 3);
    for (const order of orderTruncated) {
      const {
        order: bodyCell,
        signers: signersAddressList,
        approvals: approvalList,
      } = await retryLoop(getOrderDataByOrder, order.address);
      const readableActions = parseActionViaOrdersCell(bodyCell);
      let readableAction: ActionReadable = {
        type: "UNKNOWN",
      };
      if (readableActions.length === 1) {
        readableAction = readableActions[0];
      }

      console.log(readableAction);

      const details: any = {};
      for (const [k, v] of Object.entries(readableAction)) {
        let val = v;
        try {
          const testValue = readableAddress(v.toString(), true);
          val = testValue;
        } catch (e) {
          //console.log(e);
        }
        try {
          const testValue = v
            .map((_v: Address) => readableAddress(_v.toString(), true))
            .join("\n");
          val = testValue;
        } catch (e) {
          //console.log(e);
        }
        details[k] = val.toString();
      }
      ordersParsed.push({
        id: order.order_seqno,
        address: readableAddress(order.address, true, false),
        type: readableAction.type,
        status:
          order.sent_for_execution === true
            ? "executed"
            : order.expiration_date <= ~~(Date.now() / 1000)
            ? "expired"
            : "pending",
        createdAt: new Date(Number(order.creation_date) * 1000).toISOString(),
        details: details,
        approvals: {
          current: Number(order.approvals_num),
          required: Number(order.threshold),
          hasUserApproved: isSignerApproved(
            userAddress,
            signersAddressList,
            approvalList
          ),
        },
      });
    }

    const multisigWallet: MultisigWallet = {
      address: readableAddress(multisig.address, false, false),
      orders: ordersParsed,
    };
    multisigWallets.push(multisigWallet);
  }

  return multisigWallets;
}

// Multisig V2 SDK
export interface OrderParams {
  multisigAddress: Address;
  orderSeqno: bigint;
  expirationDate: number;
}

export interface MultisigConfig {
  threshold: number;
  signers: Array<Address>;
  proposers: Array<Address>;
  seqno: bigint;
}

interface UpdateConfigActionReadable {
  type: "UPDATE_CONFIG";
  signers: Address[];
  proposers: Address[];
  threshold: number;
}

interface SendTonActionReadable {
  type: "SEND_TON";
  amount: bigint;
  recipient: Address;
  comment: string;
}

interface SendJettonActionReadable {
  type: "SEND_JETTON";
  amount: bigint;
  recipient: Address;
  jettonWallet: Address;
}

interface MintJettonActionReadable {
  type: "MINT_JETTON";
  amount: bigint;
  recipient: Address;
  jettonMaster: Address;
}

interface UpdateKtonExchangeRatesActionReadable {
  type: "UPDATE_KTON_EXCHANGE_RATES";
  mintExchangeRate: bigint;
  burnExchangeRate: bigint;
  ktonContract: Address;
}

interface UpdateKtonEnablesActionReadable {
  type: "UPDATE_KTON_ENABLES";
  mintable: boolean;
  burnable: boolean;
  ktonContract: Address;
}

interface ChangeJettonMinterOwnerActionReadable {
  type: "CHANGE_JETTON_MINTER_OWNER";
  newOwner: Address;
  ktonContract: Address;
}

interface KtonWithdrawAllActionReadable {
  type: "KTON_WITHDRAW_ALL";
  ktonContract: Address;
}

// LST V2
interface LSTV2ApproveControllerReadable {
  type: "APPROVE_CONTROLLER";
  controllerAddress: Address;
}
interface LSTV2DonateReadable {
  type: "POOL_DONATION";
  amount: bigint;
  poolAddress: Address;
}
interface LSTV2UpdateInterestRateReadable {
  type: "UPDATE_INTEREST_RATE";
  interestRate: number;
  poolAddress: Address;
}
interface LSTV2UpdateGovernanceFeeReadable {
  type: "UPDATE_GOVERNANCE_FEE";
  governanceFee: number;
  poolAddress: Address;
}

interface LSTV2UpdatePoolParamsReadable {
  type: "UPDATE_POOL_PARAMS";
  minValidatorLoan: bigint;
  maxValidatorLoan: bigint;
  disbalanceTolerance: number;
  creditStartBefore: number;
  poolAddress: Address;
}

interface UnknownActionReadable {
  type: "UNKNOWN";
}

type ActionReadable =
  | UpdateConfigActionReadable
  | SendTonActionReadable
  | SendJettonActionReadable
  | MintJettonActionReadable
  | UpdateKtonExchangeRatesActionReadable
  | UpdateKtonEnablesActionReadable
  | KtonWithdrawAllActionReadable
  | ChangeJettonMinterOwnerActionReadable
  | LSTV2ApproveControllerReadable
  | LSTV2DonateReadable
  | LSTV2UpdateInterestRateReadable
  | LSTV2UpdateGovernanceFeeReadable
  | LSTV2UpdatePoolParamsReadable
  | UnknownActionReadable;

export function createTransferMessage(
  receipient: Address,
  amount: bigint,
  payload?: Cell
) {
  return {
    type: "transfer",
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    message: internal({
      to: receipient,
      value: amount,
      body: payload ?? Cell.EMPTY,
    }),
  };
}

export function packTransferRequest(transfer: any): Cell {
  const messageBody = storeMessageRelaxed(transfer.message);
  const message = beginCell().store(messageBody).endCell();
  return beginCell()
    .storeUint(0xf1381e5b, 32)
    .storeUint(transfer.sendMode, 8)
    .storeRef(message)
    .endCell();
}
export function packOrder(action: any) {
  const order_dict = Dictionary.empty(
    Dictionary.Keys.Uint(8),
    Dictionary.Values.Cell()
  );

  const actionCell = packTransferRequest(
    createTransferMessage(action.to, action.value, action.body)
  );
  order_dict.set(0, actionCell);

  return beginCell().storeDictDirect(order_dict).endCell();
}

export function newOrderMessage(
  action: Cell,
  expirationDate: number,
  isSigner: boolean,
  addrIdx: number,
  order_id: bigint = 115792089237316195423570985008687907853269984665640564039457584007913129639935n,
  query_id: number | bigint = 0
) {
  const msgBody = beginCell()
    .storeUint(0xf718510f, 32)
    .storeUint(query_id, 64)
    .storeUint(order_id, 256)
    .storeBit(isSigner)
    .storeUint(addrIdx, 8)
    .storeUint(expirationDate, 48);

  return msgBody.storeRef(action).endCell();
}

export function prepareCreateOrder(
  fromAddress: Address,
  orderParams: OrderParams,
  multisigConfig: MultisigConfig,
  messageReceipient: Address,
  messageValue: bigint,
  messagePayload: Cell
): IPrepare {
  // check if orderSeqno is valid
  if (orderParams.orderSeqno === -1n) {
    orderParams.orderSeqno =
      115792089237316195423570985008687907853269984665640564039457584007913129639935n;
  }

  // check if sender is in signers or proposers
  const addrCmp = (x: Address) => x.equals(fromAddress);
  let addrIdx = multisigConfig.signers.findIndex(addrCmp);
  let isSigner = false; // default assume sender is a proposer
  if (addrIdx >= 0) {
    isSigner = true;
  } else {
    addrIdx = multisigConfig.proposers.findIndex(addrCmp);
    if (addrIdx < 0) {
      throw new Error("Sender is not a signer or proposer");
    }
  }

  // pack actions
  const newAction = packOrder({
    to: messageReceipient,
    value: messageValue,
    body: messagePayload,
  });

  return {
    sendToAddress: orderParams.multisigAddress,
    payload: newOrderMessage(
      newAction,
      orderParams.expirationDate,
      isSigner,
      addrIdx,
      orderParams.orderSeqno
    ),
    value: messageValue + toNano("0.05"),
  };
}

export async function e2ePrepareCreateOrder(
  senderAddress: Address,
  multisigAddress: Address,
  messageReceipient: Address,
  messageValue: bigint,
  messagePayload: Cell
): Promise<IPrepare> {
  const multisigData = await retryLoop(
    getMultisigData,
    multisigAddress.toString()
  );
  const multisigConfig: MultisigConfig = {
    threshold: Number(multisigData.threshold),
    signers: multisigData.signers.map((x: string) => Address.parse(x)),
    proposers: multisigData.proposers.map((x: string) => Address.parse(x)),
    seqno: BigInt(multisigData.seqno),
  };
  const orderParams: OrderParams = {
    multisigAddress: Address.parse(multisigData.address),
    orderSeqno: BigInt(multisigData.seqno),
    expirationDate: ~~(Date.now() / 1000) + 3 * 24 * 60 * 60,
  };

  return prepareCreateOrder(
    senderAddress,
    orderParams,
    multisigConfig,
    messageReceipient,
    messageValue,
    messagePayload
  );
}

export function cellToArray(addrDict: Cell | null): Array<Address> {
  let resArr: Array<Address> = [];
  if (addrDict !== null) {
    const dict = Dictionary.loadDirect(
      Dictionary.Keys.Uint(8),
      Dictionary.Values.Address(),
      addrDict
    );
    resArr = dict.values();
  }
  return resArr;
}

export function parseActionViaOrdersCell(orders: Cell): ActionReadable[] {
  // const orders = msgBodySlice.loadRef();
  const ordersSlice = orders.beginParse();
  const actions = ordersSlice.loadDictDirect(
    Dictionary.Keys.Uint(8),
    Dictionary.Values.Cell()
  );

  const actionsArray: ActionReadable[] = [];

  for (const index of actions.keys()) {
    const actionCell = actions.get(index);
    if (!actionCell) {
      actionsArray.push({
        type: "UNKNOWN",
      });
      continue;
    }
    const actionSlice = actionCell.beginParse();

    // check if action has enough bits to read opcode
    if (actionSlice.remainingBits > 32) {
      const actionOpcode = actionSlice.loadUint(32);

      if (
        // check if action is update config
        actionOpcode == 0x1d0cfbd3 &&
        actionSlice.remainingBits >= 8 &&
        actionSlice.remainingRefs >= 1
      ) {
        const threshold = actionSlice.loadUint(8);
        let signers: Address[] = [];
        const signersCell = actionSlice.loadRef();
        if (signersCell.asSlice().remainingBits > 1) {
          signers = cellToArray(signersCell);
        }
        let proposers: Address[] = [];
        if (actionSlice.remainingBits > 1) {
          proposers = cellToArray(actionSlice.asCell());
        }
        actionsArray.push({
          type: "UPDATE_CONFIG",
          signers,
          proposers,
          threshold,
        });
      } else if (
        actionOpcode == 0xf1381e5b && // send_transfer
        actionSlice.remainingBits >= 8 &&
        actionSlice.remainingRefs >= 1
      ) {
        actionSlice.loadUint(8); // send mode
        const message = loadMessageRelaxed(actionSlice.loadRef().beginParse());
        if (message.info.type === "internal") {
          const to = message.info.dest;
          const value = message.info.value.coins;
          const body = message.body;

          if (!to || typeof value !== "bigint") {
            actionsArray.push({
              type: "UNKNOWN",
            });
            continue;
          }

          const bodySlice = body.beginParse();

          if (
            bodySlice.remainingBits === 0 ||
            (bodySlice.remainingBits >= 32 && bodySlice.preloadUint(32) === 0)
          ) {
            let comment = "";
            if (bodySlice.remainingBits > 0) {
              bodySlice.loadUint(32); // opcode
              comment = bodySlice.loadStringTail();
            }
            actionsArray.push({
              type: "SEND_TON",
              amount: value,
              recipient: to,
              comment,
            });
          } else if (
            body &&
            body !== Cell.EMPTY &&
            bodySlice.remainingBits > 32 + 64 + 4 + 267 &&
            bodySlice.preloadUint(32) === 0x0f8a7ea5 // JettonTransfer
          ) {
            bodySlice.loadUint(32); // opcode
            bodySlice.loadUintBig(64); // queryId
            const jettonAmount = bodySlice.loadCoins();
            const destReal = bodySlice.loadAddress();
            actionsArray.push({
              type: "SEND_JETTON",
              amount: jettonAmount,
              recipient: destReal,
              jettonWallet: to,
            });
          } else if (
            body &&
            body !== Cell.EMPTY &&
            bodySlice.remainingBits >= 32 + 64 + 4 + 267 &&
            bodySlice.remainingRefs === 1 &&
            bodySlice.preloadUint(32) === 21 // mint
          ) {
            const mintMessage = loadJettonMintMessage(bodySlice);
            actionsArray.push({
              type: "MINT_JETTON",
              amount: mintMessage.amount,
              recipient: mintMessage.to,
              jettonMaster: to,
            });
          } else if (
            body &&
            body !== Cell.EMPTY &&
            bodySlice.remainingBits >= 32 + 64 + 267 &&
            bodySlice.preloadUint(32) === 3 // change owner
          ) {
            bodySlice.loadUintBig(64);
            const newAdmin = bodySlice.loadAddress();

            actionsArray.push({
              type: "CHANGE_JETTON_MINTER_OWNER",
              newOwner: newAdmin,
              ktonContract: to,
            });
          } else if (
            body &&
            body !== Cell.EMPTY &&
            bodySlice.remainingBits === 32 + 64 &&
            bodySlice.preloadUint(32) === Op.controller.approve // approve controller
          ) {
            actionsArray.push({
              type: "APPROVE_CONTROLLER",
              controllerAddress: to,
            });
          } else if (
            body &&
            body !== Cell.EMPTY &&
            bodySlice.remainingBits === 32 + 64 &&
            bodySlice.preloadUint(32) === Op.pool.donate // pool donation
          ) {
            actionsArray.push({
              type: "POOL_DONATION",
              amount: value,
              poolAddress: to,
            });
          } else if (
            body &&
            body !== Cell.EMPTY &&
            bodySlice.remainingBits === 32 + 64 + 24 &&
            bodySlice.preloadUint(32) === Op.interestManager.set_interest // set interest rate
          ) {
            bodySlice.skip(32 + 64);
            actionsArray.push({
              type: "UPDATE_INTEREST_RATE",
              interestRate: bodySlice.loadUint(24),
              poolAddress: to,
            });
          } else if (
            body &&
            body !== Cell.EMPTY &&
            bodySlice.remainingBits === 32 + 64 + 24 &&
            bodySlice.preloadUint(32) === Op.governor.set_governance_fee // set governance fee
          ) {
            bodySlice.skip(32 + 64);
            actionsArray.push({
              type: "UPDATE_GOVERNANCE_FEE",
              governanceFee: bodySlice.loadUint(24),
              poolAddress: to,
            });
          } else if (
            body &&
            body !== Cell.EMPTY &&
            bodySlice.remainingBits >= 32 + 64 + 4 + 4 + 8 + 48 &&
            bodySlice.preloadUint(32) ===
              Op.interestManager.set_operational_params // set operational params
          ) {
            bodySlice.skip(32 + 64);
            actionsArray.push({
              type: "UPDATE_POOL_PARAMS",
              minValidatorLoan: bodySlice.loadCoins(),
              maxValidatorLoan: bodySlice.loadCoins(),
              disbalanceTolerance: bodySlice.loadUint(8),
              creditStartBefore: bodySlice.loadUint(48),
              poolAddress: to,
            });
          } else {
            actionsArray.push({
              type: "UNKNOWN",
            });
            continue;
          }
        } else {
          // TODO: may be an external message out
          actionsArray.push({
            type: "UNKNOWN",
          });
          continue;
        }
      } else {
        // TODO: this is an unknown action type
        actionsArray.push({
          type: "UNKNOWN",
        });
        continue;
      }
    } else {
      // TODO: this is an broken action
      actionsArray.push({
        type: "UNKNOWN",
      });
      continue;
    }
  }
  return actionsArray;
}
