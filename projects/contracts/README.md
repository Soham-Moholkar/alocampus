# CREDENZA Smart Contracts

This project contains the Algorand smart contracts for the CREDENZA system:
1.  **CredentialMint**: Mints academic credentials as Algorand Standard Assets (ASAs).
2.  **TrustRegistry**: Stores trust scores for credential issuers.

## Prerequisites

-   [AlgoKit](https://github.com/algorandfoundation/algokit-cli) installed.
-   Docker running (for LocalNet).

## Setup

1.  Bootstrap the project dependencies:
    ```bash
    algokit project bootstrap all
    ```

## Build

Compile the smart contracts to TEAL:
```bash
algokit project run build
```

## Deploy

Deploy to LocalNet:
1.  Start LocalNet:
    ```bash
    algokit localnet start
    ```
2.  Deploy:
    ```bash
    algokit project deploy localnet
    ```

## Testing

Run the tests:
```bash
algokit project run test
```
