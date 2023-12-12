# Sample Hardhat Project: DeFi Apps

This is the project created for the book **Building Full-stack DeFi Application**. Please follow the instruction in the book to go through the code in this project.

## How to use the project

Before reading each chapter, please check if there is a branch with the name ***chapterXX-start***. Please checkout the branch if there is.

Once reading this chapter, you can work with the branch ***chapterXX-start*** by adding or updating the code in your local repository. If you are stucked or need references, please check the code in the branch named ***chapterXX-end*** for that chapter.

## Useful Commands

The following commands are helpful for your to go through the examples in the book (Note, you should run these commands in current directory):

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

Install all dependencies for the project:

```shell
npm install
```

Start React Web UI:

```shell
npm start
```

**Enjoy the exploration!**
