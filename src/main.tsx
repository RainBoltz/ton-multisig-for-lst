import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import App from "./App.tsx";
import "./index.css";

// Manifest for dApp configuration
const manifestUrl =
  "https://gist.githubusercontent.com/RainBoltz/f161ba634ae8141413459224c0660c01/raw/873d5182a17b811ad273b94fbdcd1ad4f370541e/ton-multisig-for-lst-tonconnect-manifest.json";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <App />
    </TonConnectUIProvider>
  </StrictMode>
);
