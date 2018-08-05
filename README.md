# HUBII STRIIM CLI

## About the CLI

This is a command line interface that aims to make usage of the Striim APIs as
easy and convenient as possible, while maintaining the flexibility of the 
platform.

## About Striim

Striim is Hubii's scaling solution for the Ethereum block chain. It is a 
hybrid centralized/decentralized solution that enables instant 
(micro-) payments, trading and trustless settlements.

## About Hubii

See www.hubii.com for more information.

## Installation

To install and make the command part of your path:

    npm install -g striim-cli

## Configuration

To use the *striim* CLI tool you need to first create a configuration in your 
home folder as `.striim/config.yaml`

Use the `init` command to create a new config file:

    striim init

The `config.yaml` file is a YAML file where you will need to specify the 
following properties:

- apiRoot - The root domain for Hubii's APIs.
- appId - The application ID created in Hubii's identity server.
- appSecret - The matching secret for the application ID.
- wallet:
    - address - The address of your wallet.
    - secret - The pass-phrase for your wallet's UTC file.

The CLI tool will give a warning in the shell if the configuration file is 
accessible by anyone besides the owner. To keep your wallet and API access 
secure, make sure **only you** have access to the config file.

Example file:
    
```yaml
apiRoot: api2.dev.hubii.net
appId: 123456789012345678901234
appSecret: ********************
wallet:
    address: 1234567890123456789012345678901234567890
    secret: ********************
```

The UTC file is expected to be found in `~/.striim/keystore`.

## Usage

To show the built-in help:

    striim --help

or to show help for a specific sub-command:

    striim <command> --help

### Initialize configuration

This will create a config folder and file if it doesnt already exist:

    striim init

To recreate and discard previous settings add the `--force` flag:

    striim init --force

### Check configuration

    striim configuration

### Make a payment

    striim pay 100 TT1 to 0a24740dcb4ba8fb8469ef4cfe22eeedcf069076

Results are printed as JSON. It is recommended to pipe the result through `jq` 
to get a pretty output in the shell.

### Show pending payments

    striim show payments

Results are printed as JSON. It is recommended to pipe the result through `jq` 
to get a pretty output in the shell.
    
### Show executed payments

    striim show receipts

Results are printed as JSON. It is recommended to pipe the result through `jq` 
to get a pretty output in the shell.

### Get a list of supported currencies

    striim show tokens

Results are printed as JSON. It is recommended to pipe the result through `jq` 
to get a pretty output in the shell.
