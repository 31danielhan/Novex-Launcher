import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/inter";
import "./styles.css";
import App from "./App";

// macOS draws the window buttons over the top of the page; leave room for them.
document.documentElement.dataset.platform = navigator.userAgent.includes("Mac") ? "mac" : "other";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
