import { useState, useEffect } from "react";
import { TonConnectButton, useTonConnectUI } from "@tonconnect/ui-react";
import { Loader2, Wallet, ArrowRightLeft } from "lucide-react";
import {
  MultisigWallet,
  TransactionType,
  e2eGetMultisigsAndOrdersByAccount,
  e2ePrepareCreateOrder,
  readableAddress,
} from "./utils";
import { Address, beginCell, toNano } from "@ton/core";
import { TransactionSubmit, IPrepare } from "./components/types";
import SendApproveForm from "./components/SendApproveForm";
import SendApproveControllerForm from "./components/lst-v2/SendApproveControllerForm";
import SendDonateForm from "./components/lst-v2/SendDonateForm";
import UpdateInterestRateForm from "./components/lst-v2/UpdateInterestRateForm";
import UpdateGovernanceFeeForm from "./components/lst-v2/UpdateGovernanceFeeForm";
import { Op } from "./sdk/lst-v2/PoolConstants";
import UpdatePoolParamsForm from "./components/lst-v2/UpdatePoolParamsForm";
import { IS_MAINNET } from "./constants";

function App() {
  const [tonConnectUI] = useTonConnectUI();
  const [transactionType, setTransactionType] =
    useState<TransactionType>("lstv2-send-approve");

  // State for multisig wallets and selection
  const [multisigWallets, setMultisigWallets] = useState<MultisigWallet[]>([]);
  const [selectedWalletAddress, setSelectedWalletAddress] =
    useState<string>("");
  const [selectedOrderAddress, setSelectedOrderAddress] = useState<string>("");

  // Connection status
  const [isConnected, setIsConnected] = useState(false);
  const [walletInfo, setWalletInfo] = useState<{ address: string } | null>(
    null
  );

  // Add loading state
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const handleConnectionChange = () => {
      setIsConnected(tonConnectUI.connected);
      if (tonConnectUI.account) {
        setWalletInfo({
          address: tonConnectUI.account.address,
        });
        setIsLoading(true);
      } else {
        setWalletInfo(null);
        setMultisigWallets([]);
        setSelectedWalletAddress("");
        setSelectedOrderAddress("");
      }
    };

    handleConnectionChange();
    const unsubscribe = tonConnectUI.onStatusChange(handleConnectionChange);

    return () => {
      unsubscribe();
    };
  }, [tonConnectUI]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isUpdating) return;
      console.log(`fetchMultisigWallets -> ${walletInfo?.address}`);
      if (walletInfo?.address) {
        fetchMultisigWallets(walletInfo?.address);
      }
    }, 5000);
    return () => clearInterval(interval);
  });

  const fetchMultisigWallets = async (userAddress: string) => {
    setIsUpdating(true);
    try {
      const fetchedMultisigWallets = await e2eGetMultisigsAndOrdersByAccount(
        userAddress
      );

      // deepcheck if fetchedMultisigWallets is the same as multisigWallets
      if (
        JSON.stringify(fetchedMultisigWallets) ===
        JSON.stringify(multisigWallets)
      ) {
        return;
      }

      setMultisigWallets(fetchedMultisigWallets);
      if (fetchedMultisigWallets.length > 0) {
        if (
          selectedWalletAddress === "" ||
          fetchedMultisigWallets.find(
            (wallet) => wallet.address === selectedWalletAddress
          ) === undefined
        ) {
          setSelectedWalletAddress(fetchedMultisigWallets[0].address);
        }
      } else {
        setSelectedWalletAddress("");
      }
    } catch (error) {
      console.error("Error fetching multisig wallets:", error);
    } finally {
      setIsLoading(false);
      setIsUpdating(false);
    }
  };

  const handleTransactionSubmit = async (data: TransactionSubmit) => {
    console.log("Submitting transaction:", data);
    const validUntil = ~~(Date.now() / 1000) + 60 * 10;
    let preparation: IPrepare;

    // LSt v2
    if (data.type === "lstv2-send-approve") {
      preparation = {
        sendToAddress: Address.parse(data.contractAddress!),
        value: toNano("0.1"),
        payload: beginCell()
          .storeUint(Op.controller.approve, 32)
          .storeUint(Date.now(), 64)
          .endCell(),
      };
    } else if (data.type === "lstv2-send-donate") {
      preparation = {
        sendToAddress: Address.parse(data.contractAddress!),
        value: toNano("1"),
        payload: beginCell()
          .storeUint(Op.pool.donate, 32)
          .storeUint(Date.now(), 64)
          .endCell(),
      };
    } else if (data.type === "lstv2-update-interest-rate") {
      preparation = {
        sendToAddress: Address.parse(data.contractAddress!),
        value: toNano("0.3"),
        payload: beginCell()
          .storeUint(Op.interestManager.set_interest, 32)
          .storeUint(Date.now(), 64)
          .storeUint(Number(data.interestRate!), 24)
          .endCell(),
      };
    } else if (data.type === "lstv2-update-governance-fee") {
      preparation = {
        sendToAddress: Address.parse(data.contractAddress!),
        value: toNano("0.3"),
        payload: beginCell()
          .storeUint(Op.governor.set_governance_fee, 32)
          .storeUint(Date.now(), 64)
          .storeUint(Number(data.governanceFee!), 24)
          .endCell(),
      };
    } else if (data.type === "lstv2-update-pool-params") {
      preparation = {
        sendToAddress: Address.parse(data.contractAddress!),
        value: toNano("0.1"),
        payload: beginCell()
          .storeUint(Op.interestManager.set_operational_params, 32)
          .storeUint(Date.now(), 64)
          .storeCoins(toNano(data.minValidatorLoan!))
          .storeCoins(toNano(data.maxValidatorLoan!))
          .storeUint(Number(data.disbalanceTolerance!), 8)
          .storeUint(Number(data.creditStartBefore!), 48)
          .endCell(),
      };
    } else if (data.type === "send-approve") {
      preparation = {
        sendToAddress: Address.parse(data.orderAddress!),
        value: toNano("0.1"),
        payload: beginCell()
          .storeUint(0, 32)
          .storeStringTail("approve")
          .endCell(),
      };
    } else {
      throw new Error(`unknown TransactionType: ${data.type}`);
    }

    if (data.type !== "send-approve") {
      preparation = await e2ePrepareCreateOrder(
        Address.parse(walletInfo?.address || ""),
        Address.parse(data.multisigAddress!),
        preparation.sendToAddress,
        preparation.value!,
        preparation.payload
      );
    }

    await tonConnectUI.sendTransaction({
      messages: [
        {
          address: preparation.sendToAddress.toString(),
          amount: preparation.value!.toString(),
          payload: preparation.payload.toBoc().toString("base64"),
        },
      ],
      validUntil,
    });
  };

  const renderTransactionForm = () => {
    switch (transactionType) {
      // LSt v2
      case "lstv2-send-approve":
        return (
          <SendApproveControllerForm
            onSubmit={handleTransactionSubmit}
            multisigAddress={selectedWalletAddress}
          />
        );
      case "lstv2-update-interest-rate":
        return (
          <UpdateInterestRateForm
            onSubmit={handleTransactionSubmit}
            multisigAddress={selectedWalletAddress}
          />
        );
      case "lstv2-send-donate":
        return (
          <SendDonateForm
            onSubmit={handleTransactionSubmit}
            multisigAddress={selectedWalletAddress}
          />
        );
      case "lstv2-update-governance-fee":
        return (
          <UpdateGovernanceFeeForm
            onSubmit={handleTransactionSubmit}
            multisigAddress={selectedWalletAddress}
          />
        );
      case "lstv2-update-pool-params":
        return (
          <UpdatePoolParamsForm
            onSubmit={handleTransactionSubmit}
            multisigAddress={selectedWalletAddress}
          />
        );
      /*
      case "lstv2-send-unhalt":
        return <>not implemented</>;
      case "lstv2-send-halt":
        return <>not implemented</>;
      case "lstv2-update-deposit-settings":
        return <>not implemented</>;
      case "lstv2-update-pool-params":
        return <>not implemented</>;
      case "lstv2-send-deposit":
        return <>not implemented</>;
      case "lstv2-send-withdraw":
        return <>not implemented</>;
        */
      case "send-approve":
        return (
          <SendApproveForm
            onSubmit={handleTransactionSubmit}
            orderAddress={selectedOrderAddress}
          />
        );
      default:
        return null;
    }
  };

  const selectedWallet = multisigWallets.find(
    (w) => w.address === selectedWalletAddress
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <img
              src="https://rainboltz.github.io/ton-multisig-for-lst/ton-symbol.png"
              alt="Toncoin Icon"
              className="w-6 h-6"
            />
            <h1 className="text-xl font-bold text-gray-900">Multisig Viewer for LSt</h1>

            {IS_MAINNET() ? (
              <></>
            ) : (
              <div className="px-2 py-1 rounded-full font-bold text-xs bg-red-500 text-white mr-4">
                TESTNET
              </div>
            )}
          </div>
          <TonConnectButton />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left side - Transaction Form */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="mb-6">
              <label
                htmlFor="transaction-type"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Transaction Type
              </label>
              <select
                id="transaction-type"
                value={transactionType}
                onChange={(e) =>
                  setTransactionType(e.target.value as TransactionType)
                }
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="lstv2-send-approve">Approve Controller</option>
                <option value="lstv2-update-interest-rate">
                  Update Pool Interest Rate
                </option>
                <option value="lstv2-update-governance-fee">
                  Update Pool Governance Fee
                </option>
                <option value="lstv2-send-donate">Donate Pool</option>
                <option value="lstv2-update-pool-params">
                  Update Pool Params
                </option>
                {/*
                <option value="lstv2-send-unhalt">Send Unhalt</option>
                <option value="lstv2-send-halt">Send Halt</option>
                <option value="lstv2-update-deposit-settings">
                  Update Deposit Settings
                </option>
                <option value="lstv2-send-deposit">Send Deposit</option>
                */}

                {/*
                <option value="update-owner">Update Owner</option>
                <option value="send-withdraw">Send Withdraw</option>
                */}
                <option value="send-approve">Send Approve</option>
              </select>
            </div>

            {isConnected ? (
              renderTransactionForm()
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">
                  Please connect your wallet to send transactions
                </p>
              </div>
            )}
          </div>

          {/* Right side - Multisig Wallet Preview */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-gray-700" />
              Multisig Wallet Preview
            </h2>
            {isConnected ? (
              <div className="space-y-4">
                <div className="text-sm text-gray-500 mb-4">
                  Connected Address:{" "}
                  {readableAddress(walletInfo?.address || "")}
                </div>

                {isLoading ? (
                  <div className="flex flex-col justify-center items-center py-8 space-y-4">
                    <h3 className="text-sm text-black-500">
                      Fetching Multisigs and Orders (~5 sec.)
                    </h3>
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  </div>
                ) : (
                  <>
                    {/* Multisig Wallet Selector */}
                    <div className="mb-6">
                      <label
                        htmlFor="wallet-select"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Select Multisig Wallet
                      </label>
                      <select
                        id="wallet-select"
                        value={selectedWalletAddress}
                        onChange={(e) =>
                          setSelectedWalletAddress(e.target.value)
                        }
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      >
                        {multisigWallets.map((wallet) => (
                          <option key={wallet.address} value={wallet.address}>
                            {readableAddress(wallet.address)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Orders List */}
                    {selectedWallet ? (
                      <div className="space-y-4">
                        <h3 className="text-md font-medium text-gray-700 flex items-center gap-2">
                          <ArrowRightLeft className="w-5 h-5 text-gray-700" />
                          Orders (last 3 orders)
                        </h3>
                        {selectedWallet.orders.length > 0 ? (
                          <div className="space-y-3">
                            {selectedWallet.orders.map((order) => (
                              <div
                                key={order.id}
                                className={`p-4 border rounded-lg bg-gray-50 cursor-pointer ${
                                  selectedOrderAddress === order.address
                                    ? "ring-2 ring-blue-500"
                                    : ""
                                }`}
                                onClick={() =>
                                  setSelectedOrderAddress(order.address)
                                }
                              >
                                <div className="flex justify-between items-start mb-2">
                                  <span className="font-medium text-gray-900">
                                    {order.type
                                      .split("_")
                                      .map(
                                        (word) =>
                                          word.charAt(0).toUpperCase() +
                                          word.slice(1).toLowerCase()
                                      )
                                      .join(" ")}
                                  </span>
                                  <span
                                    className={`px-2 py-1 text-xs rounded-full ${
                                      order.status === "pending"
                                        ? "bg-yellow-100 text-yellow-800"
                                        : order.status === "executed"
                                        ? "bg-green-100 text-green-800"
                                        : "bg-red-100 text-red-800"
                                    }`}
                                  >
                                    {order.status.charAt(0).toUpperCase() +
                                      order.status.slice(1)}
                                  </span>
                                </div>
                                <div className="text-sm text-gray-600 mb-2">
                                  Order Address:{" "}
                                  {readableAddress(order.address, true)}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {Object.entries(order.details).map(
                                    ([key, value]) => {
                                      return (
                                        <div
                                          key={key}
                                          className="flex justify-between items-center"
                                        >
                                          <span>{key}:</span>
                                          <span className="font-mono">
                                            {value}
                                          </span>
                                        </div>
                                      );
                                    }
                                  )}
                                </div>
                                <div className="mt-2 flex justify-between items-center">
                                  <div className="text-xs text-gray-500">
                                    Created:{" "}
                                    {new Date(order.createdAt).toLocaleString()}
                                  </div>
                                  <div className="text-sm">
                                    <span
                                      className={
                                        order.approvals.hasUserApproved
                                          ? "text-green-600"
                                          : "text-gray-600"
                                      }
                                    >
                                      {order.approvals.current}/
                                      {order.approvals.required} signatures
                                      {order.approvals.hasUserApproved
                                        ? " (Approved)"
                                        : ""}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-gray-500 text-center py-4">
                            No orders found for this wallet
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-gray-500 text-center py-4">
                        No multisig wallet selected
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">
                  Connect your wallet to view multisig wallets
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
