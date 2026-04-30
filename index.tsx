import React from "react";
import ReactDOM from "react-dom/client";
import { NuqsAdapter } from "nuqs/adapters/react";
import "./styles.css";
import App from "./App";
import Intro from "./components/Intro";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Could not find root element to mount to");

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <NuqsAdapter>
      <Intro />
      <App />
    </NuqsAdapter>
  </React.StrictMode>
);