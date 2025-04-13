import React, { useState } from "react";
import { TransactionFormProps } from "../types";
import { Users } from "lucide-react";

// Update Interest Rate Form
const UpdatePoolParamsForm: React.FC<TransactionFormProps> = ({
  onSubmit,
  multisigAddress = "",
}) => {
  const [contractAddress, setContractAddress] = useState("");
  const [minValidatorLoan, setMinValidatorLoan] = useState("1");
  const [maxValidatorLoan, setMaxValidatorLoan] = useState("2000000");
  const [disbalanceTolerance, setDisbalanceTolerance] = useState("30");
  const [creditStartBefore, setCreditStartBefore] = useState("0");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      type: "lstv2-update-pool-params",
      multisigAddress,
      minValidatorLoan,
      maxValidatorLoan,
      disbalanceTolerance,
      creditStartBefore,
      contractAddress,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="multisig-address"
          className="block text-sm font-medium text-gray-700"
        >
          Multisig Wallet Address
        </label>
        <input
          type="text"
          id="multisig-address"
          value={multisigAddress}
          disabled
          className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm"
        />
      </div>
      <div>
        <label
          htmlFor="contract-address"
          className="block text-sm font-medium text-gray-700"
        >
          Pool Address
        </label>
        <input
          type="text"
          id="contract-address"
          value={contractAddress}
          onChange={(e) => setContractAddress(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="Enter contract address (pool)"
          required
        />
      </div>
      <div>
        <label
          htmlFor="min-loan-per-validator"
          className="block text-sm font-medium text-gray-700"
        >
          Min Loan per Validator
        </label>
        <input
          type="number"
          id="min-loan-per-validator"
          value={minValidatorLoan}
          onChange={(e) => setMinValidatorLoan(e.target.value.toString())}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="41000000000000"
          required
        />
      </div>
      <div>
        <label
          htmlFor="max-loan-per-validator"
          className="block text-sm font-medium text-gray-700"
        >
          Max Loan per Validator
        </label>
        <input
          type="number"
          id="max-loan-per-validator"
          value={maxValidatorLoan}
          onChange={(e) => setMaxValidatorLoan(e.target.value.toString())}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="43000000000000"
          required
        />
      </div>
      <div>
        <label
          htmlFor="disbalance-tolerance"
          className="block text-sm font-medium text-gray-700"
        >
          Disbalance Tolerance
        </label>
        <input
          type="number"
          id="disbalance-tolerance"
          value={disbalanceTolerance}
          onChange={(e) => setDisbalanceTolerance(e.target.value.toString())}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="0 <= x < 256, x% = (x/100)*(2^9)"
          required
        />
      </div>
      <div>
        <label
          htmlFor="credit-start-before"
          className="block text-sm font-medium text-gray-700"
        >
          Credit Start Before Election
        </label>
        <input
          type="number"
          id="credit-start-before"
          value={creditStartBefore}
          onChange={(e) => setCreditStartBefore(e.target.value.toString())}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder=""
          required
        />
      </div>
      <button
        type="submit"
        className="w-full flex justify-center items-center space-x-2 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <Users className="w-4 h-4" />
        <span>Create Order</span>
      </button>
    </form>
  );
};

export default UpdatePoolParamsForm;
