import React, { useState } from "react";
import { TransactionFormProps } from "../types";
import { Users } from "lucide-react";

// Update Governance Fee Form
const UpdateGovernanceFeeForm: React.FC<TransactionFormProps> = ({
  onSubmit,
  multisigAddress = "",
}) => {
  const [contractAddress, setContractAddress] = useState("");
  const [governanceFee, setGovernanceFee] = useState("2684355");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      type: "lstv2-update-interest-rate",
      multisigAddress,
      governanceFee,
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
          htmlFor="new-governance-fee"
          className="block text-sm font-medium text-gray-700"
        >
          New Governance Fee
        </label>
        <input
          type="number"
          id="new-governance-fee"
          value={governanceFee}
          onChange={(e) => setGovernanceFee(e.target.value.toString())}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="x% = (x/100)*(2^24)"
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

export default UpdateGovernanceFeeForm;
