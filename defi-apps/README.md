# Sample Hardhat Project: DeFi Apps

This is the project created for the book **Building Full-stack DeFi Application**. Please follow the instruction in the book to go through the code in this project.

## How to use the project

Before reading each chapter, please check if there is a branch with the name ***chapterXX-start***. Please checkout the branch if there is.

Once reading this chapter, you can work with the branch ***chapterXX-start*** by adding or updating the code in your local repository. If you are stucked or need references, please check the code in the branch named ***chapterXX-end*** for that chapter.

The main branch of this repository contains the completed code for all of the 14 chapters of the book.

Prior to running the code in the project, please make sure [node.js](https://nodejs.org/) is installed.

## Useful Commands

The following commands are helpful for your to go through the examples in the book (Note, you should run these commands in current directory):

Install all dependencies for the project:

```shell
npm install
```

Compile smart contracts in this project (it is helpful to verify if there are syntax error or missing dependencies):

```shell
npx hardhat compile
```

Start local EVM:

```shell
npx hardhat node
```

Deploying Smart Contracts of the project:

```shell
npx hardhat run scripts/deploy.js --network localhost # Deploy on local EVM
npx hardhat run scripts/deploy.js --network sepolia    # Deploy on Sepolia Network (TestNet)

# OR

npm run deploy localhost # Deploy on local EVM
npm run deploy sepolia    # Deploy on Sepolia Network (TestNet)
```

Start Hardhat console with local EVM:

```shell
npx hardhat console --network localhost
```
Run test cases with Hardhat:

```shell
npx hardhat test
```

Start React Web UI:

```shell
npm start
```

If you want to simulate mining blocks on local environment, run the following command:

```shell
npm run mine localhost --npm_config_blocks 5  # Mines 5 blocks
```

If you want to run Price Oracle for crypto loan on local environment, run the following command:

```shell
npm run price-oracle-update localhost
```

**Enjoy the exploration!**
