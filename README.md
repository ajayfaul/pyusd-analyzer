# PYUSD Deep Transaction Analyzer & Historical Dashboard

**Analyze PYUSD interactions like never before! This tool leverages GCP's powerful Blockchain RPC and BigQuery public datasets to provide deep transaction tracing and historical context for PYUSD activity on Ethereum Mainnet and Sepolia testnet.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview 💡

Standard blockchain explorers provide valuable surface-level information about transactions (sender, receiver, value, basic logs). However, understanding the *internal execution flow* of complex smart contract interactions, especially those involving stablecoins like PYUSD within DeFi protocols, requires deeper analysis. Accessing computationally intensive RPC methods like `debug_traceTransaction` needed for this analysis is often cost-prohibitive.

This project tackles this problem by:

1.  **Leveraging GCP's Free Blockchain RPC Tier:** Utilizing the free access to methods like `debug_traceTransaction` to perform step-by-step EVM execution tracing for any given transaction hash.
2.  **Providing In-Depth Trace Analysis:** Parsing the raw trace data to extract meaningful insights such as internal calls, external calls (with heuristic function signature identification), storage changes, gas usage breakdowns (estimated per call frame), and decoded PYUSD/WETH transfer events.
3.  **Integrating Historical Context:** Querying GCP's BigQuery public Ethereum datasets (`token_transfers`, `transactions`) to display historical trends related to PYUSD activity (daily transfers, volume, active users) and network conditions (average gas price, gas limit usage).
4.  **Focusing on PYUSD:** While the trace analyzer is generic, specific attention is given to identifying and analyzing PYUSD-related interactions.
5.  **Offering Network Selection:** Allowing analysis on both Ethereum Mainnet and the Sepolia testnet.
6.  **Presenting Data Clearly:** Using a modern web interface built with Next.js, Shadcn UI, and Chart.js to present complex data in an accessible dashboard format.

This tool empowers developers, analysts, and researchers to gain a much deeper understanding of PYUSD transactions and the broader network context without incurring high RPC costs.

## Features 🤖

**1. Trace Analyzer:**

* **Network Selection:** Choose between Ethereum Mainnet and the Sepolia testnet for analysis. This flexibility allows developers to debug test transactions on Sepolia or analyze real-world interactions on Mainnet within the same interface.
* **Detailed Execution Trace:** Goes beyond surface data by utilizing the `debug_traceTransaction` RPC method. This provides a granular, step-by-step log (`structLogs`) of every EVM opcode executed during the transaction, forming the basis for all subsequent analysis.
* **Transaction Summary:** Get an immediate overview of the transaction's outcome. Displays the final status (Success or Fail/Reverted), the total gas consumed as reported by the trace, the maximum depth of nested calls (indicating complexity), and the final data returned by the transaction execution (if any).
* **Opcode Distribution:** Presents a frequency count of the top 10 most executed EVM opcodes. This insight helps identify potentially gas-intensive operations (like `SSTORE`, `CALL`) and understand the nature of the contract's logic (e.g., computation-heavy vs. storage-heavy).
* **External/Internal Calls:** Lists all identified `CALL`, `STATICCALL`, `DELEGATECALL`, and `CALLCODE` operations performed during the transaction. For each call, it shows:
    * The target contract address, linked to Etherscan for easy inspection.
    * A mapped contract name if the address is known (e.g., "PYUSD Contract", "Uniswap V3 Router"), providing immediate context.
    * A heuristically identified function signature (e.g., `transfer(address,uint256)`) based on common patterns, offering clues about the action performed (note: this is an estimation).
    * The amount of gas provided to the call versus an estimation of the gas actually consumed *within that specific call frame* (including nested calls initiated by it), useful for gas optimization analysis.
    * The amount of ETH sent along with the call (for standard `CALL`s).
    * Heuristically decoded arguments for common, simple functions like ERC20 `transfer` and `approve`, showing estimated parameters like recipient and amount (note: this is an estimation based on stack inspection).
    * A visual indicator highlighting calls likely related to DEX swaps (interacting with known routers or using "swap" function names).
* **Storage Writes:** Details every instance where the transaction modified contract storage using the `SSTORE` opcode. It lists the specific storage slot (address) and the new value written to that slot, providing a clear view of state changes.
* **Event Logs:** Captures events emitted via `LOGx` opcodes. It specifically decodes standard `Transfer` events for known PYUSD and WETH contracts (showing formatted amounts and symbols for the selected network). For other, unrecognized events, it displays the raw topic hashes and data, allowing for manual inspection or further analysis.

**2. Historical Dashboard:**

* **Daily PYUSD Transfers:** Table showing the daily count and total volume (in PYUSD) of PYUSD transfers over the last 7 days (Data from BigQuery `token_transfers`).
* **Daily Active PYUSD Senders:** Table showing the number of unique addresses that initiated PYUSD transfers each day over the last 7 days (Data from BigQuery `token_transfers`).
* **Top 10 PYUSD Transfers:** Table listing the 10 largest PYUSD transfers (by amount) within the last 7 days, including sender, receiver, amount, timestamp, and transaction hash link (Data from BigQuery `token_transfers`).
* **Daily Average Gas Price:** Line chart displaying the average gas price (in Gwei) for successful transactions on Ethereum over the last 7 days (Data from BigQuery `transactions`).
* **Daily Average Gas Limit Usage:** Bar chart showing the average percentage of the gas limit consumed by successful transactions each day over the last 7 days, indicating network congestion or efficiency (Data from BigQuery `transactions`).

## How It Works 🔍

### Trace Analyzer (`debug_traceTransaction`)

The core of the trace analysis relies on the `debug_traceTransaction` RPC method provided by GCP's Blockchain RPC service.

1.  **API Call:** The frontend sends the transaction hash and selected network (Mainnet/Sepolia) to the `/api/trace` backend endpoint.
2.  **RPC Request:** The backend selects the appropriate GCP RPC URL based on the network and makes a JSON-RPC call to `debug_traceTransaction` with the transaction hash. This method is computationally intensive as the node needs to re-execute the transaction step-by-step.
3.  **Trace Processing:** The RPC call returns a large JSON object containing `structLogs` - an array where each element represents one step (opcode) in the EVM execution. This includes the opcode itself, program counter (PC), gas remaining, gas cost for the step, call stack depth, and potentially the EVM stack and memory contents at that step.
4.  **Backend Analysis (`analyzeStructLogs`):** The backend function iterates through these `structLogs`:
    * **Opcodes:** Counts the occurrence of each opcode.
    * **Calls:** Detects `CALL`, `DELEGATECALL`, etc. opcodes. It extracts the target address, gas provided, and value from the stack state *before* the call. It uses heuristics (looking back at recent `PUSH4` opcodes) to guess the function signature being called by matching against `KNOWN_FUNCTION_SELECTORS`. It estimates gas used within the call frame by summing `gasCost` of subsequent opcodes at a greater depth until the call returns. It attempts to decode simple arguments (like for `transfer`, `approve`) by looking at specific stack positions just before the call. Known contract addresses (`KNOWN_ADDRESSES_MAINNET`, `KNOWN_ADDRESSES_SEPOLIA`) are used to display names.
    * **Storage:** Detects `SSTORE` opcodes and extracts the storage slot and value from the stack.
    * **Events:** Detects `LOGx` opcodes. It extracts topics and data (potentially from memory using stack offset/length). It specifically attempts to decode standard ERC20 `Transfer` events using `viem`'s `decodeEventLog` if the topic0 matches, checking against known PYUSD/WETH addresses for the selected network to format the value correctly. Other events are displayed raw.
5.  **Summary:** The processed information (opcode counts, calls, storage writes, events, gas used, status, etc.) is packaged into an `AnalysisSummary` object and sent back to the frontend.
6.  **Frontend Display:** The `TraceAnalyzer.tsx` component receives the summary and displays it using Shadcn UI components (Cards, Tables, Accordions).

### Historical Dashboard (BigQuery)

The historical dashboard leverages GCP's public BigQuery datasets for Ethereum.

1.  **API Calls:** The `HistoricalDashboard.tsx` component makes multiple asynchronous `fetch` calls to the `/api/historical` backend endpoint on mount, using different `type` query parameters (`transfers`, `active_addresses`, `top_transfers`, `gas`, `congestion`).
2.  **Backend Query Execution:** The `/api/historical/route.ts` endpoint receives these requests:
    * It initializes the `@google-cloud/bigquery` client, authenticating using environment variables (`GOOGLE_PROJECT_ID`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`).
    * Based on the `type` parameter, it selects the appropriate pre-defined SQL query.
    * These queries target tables like `bigquery-public-data.crypto_ethereum.token_transfers` and `bigquery-public-data.crypto_ethereum.transactions`.
    * They perform aggregations (COUNT, SUM, AVG), filtering (by date, token address, status), ordering, and limiting as needed. `SAFE_CAST` and `SAFE_DIVIDE` are used for robust calculations.
    * The backend executes the query using `bigqueryClient.query()`.
3.  **Data Formatting:** The raw results from BigQuery are formatted into a consistent structure suitable for the frontend (e.g., converting BigQueryDate objects to strings, formatting numbers).
4.  **API Response:** The formatted data is sent back to the frontend as a JSON object, including the `type` field.
5.  **Frontend Display:** The `HistoricalDashboard.tsx` component receives the data for each analysis type, updates its state, and renders the information using Shadcn UI Cards and Tables, and Chart.js charts (`Line`, `Bar`). Loading and error states are handled for each data fetch.

## Technology Stack 🌐

* **Framework:** Next.js (App Router)
* **Language:** TypeScript
* **Styling:** Tailwind CSS
* **UI Components:** Shadcn UI
* **Charting:** Chart.js
* **Blockchain Interaction (Backend):** GCP Blockchain RPC (`debug_traceTransaction`) via `fetch`
* **Historical Data:** GCP BigQuery (`@google-cloud/bigquery`)
* **Core Libraries:** React, viem (for ABI parsing, decoding, formatting)
* **Deployment (Suggested):** Vercel / Netlify

## Setup and Installation (Local Development) ⚙️

1.  **Prerequisites:**
    * Node.js (LTS version recommended)
    * npm or yarn
    * Git
    * Google Cloud SDK (optional, for managing credentials)
    * Access to GCP Blockchain RPC (Mainnet & Sepolia endpoints) - Requires a GCP Project.
    * GCP Service Account Key with BigQuery permissions (BigQuery User role) for the project providing billing for BigQuery API usage (even on public data).

2.  **Clone Repository:**
    ```bash
    git clone https://github.com/ajayfaul/pyusd-analyzer.git
    cd pyusd-analyzer
    ```

3.  **Install Dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```

4.  **Set Up Environment Variables:**
    * Create a file named `.env.local` in the root of your project.
    * Add the following variables, replacing the placeholder values:

        ```dotenv
        # Required for Trace Analyzer
        GCP_RPC_URL_MAINNET=<your_gcp_or_other_mainnet_rpc_url>
        GCP_RPC_URL_SEPOLIA=<your_gcp_or_other_sepolia_rpc_url>
        # GCP_API_KEY=YOUR_GCP_RPC_API_KEY # Optional: Add if your RPC URL requires an API key appended

        # Required for BigQuery Historical Data (Choose ONE method)

        # Method 1: Separate Variables (Recommended for Deployment, works locally too)
        GOOGLE_PROJECT_ID=<your_gcp_project_id>
        GOOGLE_CLIENT_EMAIL=<your_service_account_email>
        # Copy the *entire* private key from the JSON file, preserving newlines
        GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nYOUR_MULTI_LINE_PRIVATE_KEY\n-----END PRIVATE KEY-----\n

        # Method 2: Using Credentials File Path (Easier for Local Dev ONLY)
        # Ensure the JSON file is at this path relative to your project root
        # GOOGLE_APPLICATION_CREDENTIALS=./path/to/your-service-account-key.json
        ```
    * **Important:** Obtain the Service Account Key JSON file from your Google Cloud Console (IAM & Admin -> Service Accounts).
    * Make sure the Service Account has the necessary BigQuery permissions (e.g., "BigQuery User").
    * **Never commit your `.env.local` file or your Service Account key file to Git.** Add them to your `.gitignore`.

5.  **Run Development Server:**
    ```bash
    npm run dev
    # or
    yarn dev
    ```
    Open [http://localhost:3000](http://localhost:3000) (or your configured port) in your browser.

## Usage 🚀
Here are the url of deployed app:  **[PYUSD Analyzer](https://pyusd-analyzer.vercel.app/)**

1.  **Navigate:** Use the sidebar menu to switch between "Trace Analyzer" and "Historical Data" views.
2.  **Trace Analyzer:**
    * Enter a valid Ethereum transaction hash (starting with `0x`) into the input field.
    * Select the appropriate network (Mainnet or Sepolia) from the dropdown.
    * Click the "Analyze" button.
    * Wait for the analysis to complete (indicated by a loading toast). Results will appear below, including summary info, opcode distribution, calls, storage writes, and events. Use the accordions to expand details. Hover over truncated hex values or use Etherscan links for more info.
3.  **Historical Dashboard:**
    * The dashboard automatically fetches and displays various historical metrics related to PYUSD and network conditions upon loading.
    * Review the tables and charts for insights.


## Inspiration & Differences 🧠

This project was developed independently for the GCP+PYUSD Hackathon. While general block explorers (Etherscan), transaction tracers (usually desktop tools or paid services), and DeFi dashboards (DefiLlama, Dune) exist, this project differentiates itself by:

1.  Providing **free, web-based access** to detailed EVM execution traces via `debug_traceTransaction`.
2.  **Combining** deep trace analysis with relevant historical on-chain data from BigQuery within a single interface.
3.  Having a specific (though not exclusive) **focus on analyzing PYUSD** interactions and historical trends.
4.  Offering analysis on **both Mainnet and Sepolia**.


## Future Improvements ✨

* More robust function argument decoding (potentially integrating ABIs).
* Decoding more event types beyond standard Transfers.
* More advanced BigQuery analyses (Liquidity Pool TVL/Volume trends, MEV signal detection).
* Adding more networks supported by GCP RPC.
* User accounts and saved analysis history.
* Enhanced chart interactivity and customization.
* API endpoint for programmatic access to analysis results.

## License ⚖️

This project is licensed under the [MIT License](LICENSE).