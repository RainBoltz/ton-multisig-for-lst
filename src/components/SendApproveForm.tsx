import React from "react";
import { TransactionFormProps } from "./types";
import { Send } from "lucide-react";

// Send Approve Form
const SendApproveForm: React.FC<TransactionFormProps> = ({
  onSubmit,
  orderAddress = "",
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ type: "send-approve", orderAddress });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="address"
          className="block text-sm font-medium text-gray-700"
        >
          Order Address
        </label>
        <input
          type="text"
          id="address"
          value={orderAddress}
          disabled
          className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm"
        />
      </div>
      <button
        type="submit"
        className="w-full flex justify-center items-center space-x-2 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <Send className="w-4 h-4" />
        <span>Approve Order</span>
      </button>
    </form>
  );
};

export default SendApproveForm;
