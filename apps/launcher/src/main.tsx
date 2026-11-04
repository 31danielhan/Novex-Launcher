// Must run first: in a ?mock dev preview it stands in for the desktop backend.
import "./lib/devMock";
import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/bricolage-grotesque";
import "./styles.css";
import App from "./App";

// macOS draws the window buttons over the top of the page; leave room for them.
document.documentElement.dataset.platform = navigator.userAgent.includes("Mac") ? "mac" : "other";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
