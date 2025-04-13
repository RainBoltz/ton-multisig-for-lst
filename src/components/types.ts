import { TransactionType } from "../utils";
import { Address, Cell, StateInit } from "@ton/core";

export type TransactionSubmit = {
  type: TransactionType;
  multisigAddress?: string;
  contractAddress?: string;
  orderAddress?: string;
  mintExchangeRate?: string;
  burnExchangeRate?: string;
  newOwnerAddress?: string;
  mintable?: boolean;
  burnable?: boolean;
  amount?: string;
  interestRate?: string;
  governanceFee?: string;
  minValidatorLoan?: string;
  maxValidatorLoan?: string;
  disbalanceTolerance?: string;
  creditStartBefore?: string;
};

export interface TransactionFormProps {
  onSubmit: (data: TransactionSubmit) => void;
  multisigAddress?: string;
  orderAddress?: string;
}

export interface IPrepare {
  sendToAddress: Address;
  payload: Cell;
  value?: bigint;
  stateInit?: StateInit;
}